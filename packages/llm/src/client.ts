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

/** One retry on transient failures — a 12-hour demo shouldn't die on a 503. */
const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export function createLlm(env: LlmConfig) {
  const baseUrl = env.MERGE_BASE_URL.replace(/\/$/, "");

  async function request(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
    let lastError: LlmError | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }

      const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.MERGE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });

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
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new LlmError("No content in response", res.status, JSON.stringify(json).slice(0, 500));
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
   * List the model ids this gateway key can actually reach.
   * Run this once at the start of the build and pin what it returns —
   * the defaults in config.ts are a guess until you do.
   */
  async function listModels(): Promise<string[]> {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${env.MERGE_API_KEY}` },
    });
    if (!res.ok) {
      throw new LlmError(`/models failed: ${res.status}`, res.status, await res.text());
    }
    const json = (await res.json()) as { data?: { id: string }[] };
    return (json.data ?? []).map((m) => m.id);
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
