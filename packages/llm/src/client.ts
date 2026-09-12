import { z } from "zod";

import { type LlmConfig } from "./config";

export type Role = "system" | "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
}

export interface ChatOptions {
  messages: Message[];
  /** Defaults to the configured "smart" model. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/** Retry on transient failures — a 12-hour demo shouldn't die on a 503. */
const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Max requests in flight against the gateway at once.
 *
 * Measured: single calls take ~2s, and 2-3 concurrent are fine, but at 4+ the
 * gateway intermittently drops the connection (ECONNRESET) and the call hangs
 * for ~18s before failing. Capping here means callers can fire off as many
 * requests as they like without having to know that.
 */
const MAX_IN_FLIGHT = 3;

/** Generous enough for a slow structured call, short enough to fail visibly. */
const REQUEST_TIMEOUT_MS = 90_000;

let inFlight = 0;
const waiting: (() => void)[] = [];

async function acquire(): Promise<void> {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight++;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
  inFlight++;
}

function release(): void {
  inFlight--;
  waiting.shift()?.();
}

export function createLlm(env: LlmConfig) {
  const baseUrl = env.MERGE_BASE_URL.replace(/\/$/, "");

  async function request(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
    let lastError: LlmError | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }

      await acquire();
      let res: Response;
      try {
        /**
         * Hard timeout on every call.
         *
         * Without one, a hung gateway request stalls the generator forever and
         * the SSE stream just stops mid-investigation — no error, no failed
         * stage, nothing in the log. Seen once at the verdict stage. Failing
         * loudly after 90s is far better than a demo that quietly truncates.
         */
        const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
        res = await fetch(`${baseUrl}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.MERGE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
      } catch (error) {
        // fetch THROWS on connection reset rather than returning a status, so
        // without this a dropped socket would skip the retry loop entirely.
        if (signal?.aborted) throw error;
        const reason = error instanceof Error ? error.message : "unknown";
        lastError = new LlmError(
          `${path} ${reason.includes("timed out") || reason.includes("aborted") ? `timed out after ${REQUEST_TIMEOUT_MS / 1000}s` : `network error: ${reason}`}`,
        );
        continue;
      } finally {
        release();
      }

      if (res.ok) return res;

      const text = await res.text().catch(() => "");
      lastError = new LlmError(`${path} failed: ${res.status}`, res.status, text.slice(0, 500));
      if (!RETRY_STATUSES.has(res.status)) throw lastError;
    }

    throw lastError ?? new LlmError(`${path} failed`);
  }

  /** Plain completion. Returns the assistant's text. */
  async function chat(opts: ChatOptions): Promise<string> {
    const res = await request(
      "/chat/completions",
      {
        model: opts.model ?? env.MERGE_MODEL_SMART,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 1500,
      },
      opts.signal,
    );

    const json = (await res.json()) as {
      model?: string;
      choices?: { message?: { content?: string | null }; finish_reason?: string }[];
    };
    const choice = json.choices?.[0];
    const content = choice?.message?.content;

    if (typeof content !== "string" || content === "") {
      // Reasoning models can spend the whole budget on an internal `thinking`
      // field and return null content. Say so plainly — a silent "" would show
      // up as a blank explanation on screen with no clue why.
      throw new LlmError(
        `Empty content from ${json.model ?? "unknown model"} ` +
          `(finish_reason: ${choice?.finish_reason ?? "none"}). ` +
          `If this is a reasoning model, raise max_tokens or use a non-reasoning one.`,
        res.status,
      );
    }
    return content;
  }

  /**
   * Streaming completion, yielding text deltas.
   * Used where we want tokens to reach the UI as they're produced.
   */
  async function* chatStream(opts: ChatOptions): AsyncGenerator<string> {
    const res = await request(
      "/chat/completions",
      {
        model: opts.model ?? env.MERGE_MODEL_SMART,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 1500,
        stream: true,
      },
      opts.signal,
    );

    if (!res.body) throw new LlmError("No response body for stream");

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;

      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const line = frame.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") return;

        try {
          const json = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // Ignore malformed keep-alive frames rather than killing the stream.
        }
      }
    }
  }

  /**
   * Completion constrained to a zod schema.
   *
   * This is the workhorse for the thesis engine: every stage returns structured
   * data, never prose we have to parse by hand. Asks the gateway for JSON schema
   * output, and if the model still returns something invalid, retries once with
   * the validation error fed back to it.
   */
  async function structured<T extends z.ZodType>(opts: {
    messages: Message[];
    schema: T;
    schemaName: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  }): Promise<z.infer<T>> {
    const jsonSchema = z.toJSONSchema(opts.schema, { io: "output" });
    let messages = [...opts.messages];

    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await request(
        "/chat/completions",
        {
          model: opts.model ?? env.MERGE_MODEL_SMART,
          messages,
          temperature: opts.temperature ?? 0.1,
          max_tokens: opts.maxTokens ?? 2000,
          response_format: {
            type: "json_schema",
            json_schema: { name: opts.schemaName, schema: jsonSchema, strict: true },
          },
        },
        opts.signal,
      );

      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = json.choices?.[0]?.message?.content ?? "";

      const parsed = opts.schema.safeParse(extractJson(raw));
      if (parsed.success) return parsed.data;

      if (attempt === 1) {
        throw new LlmError(
          `Structured output failed validation: ${parsed.error.message.slice(0, 300)}`,
        );
      }

      // Feed the error back and let it correct itself.
      messages = [
        ...messages,
        { role: "assistant", content: raw.slice(0, 2000) },
        {
          role: "user",
          content: `That did not match the required schema. Errors:\n${parsed.error.message.slice(
            0,
            600,
          )}\n\nReturn ONLY corrected JSON matching the schema.`,
        },
      ];
    }

    throw new LlmError("Structured output failed");
  }

  /** Embeddings, for semantic search over source chunks. */
  async function embed(input: string[], model?: string): Promise<number[][]> {
    const res = await request("/embeddings", {
      model: model ?? env.MERGE_MODEL_EMBED,
      input,
    });
    const json = (await res.json()) as { data?: { embedding: number[] }[] };
    const data = json.data;
    if (!data) throw new LlmError("No embeddings in response");
    return data.map((d) => d.embedding);
  }

  /**
   * Every model id this gateway key can reach.
   *
   * Note the response shape: the id field is `model`, not `id` as OpenAI uses,
   * and the list is cursor-paginated (289 models at the time of writing).
   */
  async function listModels(): Promise<string[]> {
    const ids: string[] = [];
    let cursor: string | null = null;

    for (let page = 0; page < 25; page++) {
      const url = new URL(`${baseUrl}/models`);
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${env.MERGE_API_KEY}` },
      });
      if (!res.ok) {
        throw new LlmError(`/models failed: ${res.status}`, res.status, await res.text());
      }

      const json = (await res.json()) as {
        data?: { model: string }[];
        has_more?: boolean;
        next_cursor?: string | null;
      };
      ids.push(...(json.data ?? []).map((m) => m.model));

      if (!json.has_more || !json.next_cursor) break;
      cursor = json.next_cursor;
    }
    return ids;
  }

  return { chat, chatStream, structured, embed, listModels };
}

export type Llm = ReturnType<typeof createLlm>;

/**
 * Models sometimes wrap JSON in prose or a ```json fence even when asked not to.
 * Pull the JSON out rather than failing the whole stage over formatting.
 */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // fall through
    }
  }

  const start = trimmed.search(/[[{]/);
  const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      // fall through
    }
  }

  return null;
}
