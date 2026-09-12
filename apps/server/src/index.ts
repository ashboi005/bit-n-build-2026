import { DEMO_STAGES, type DemoStage } from "@bit-n-build-2026/contracts";
import { runThesis } from "@bit-n-build-2026/engine";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { DEMO_PROMPTS } from "./demo-personas";
import { env } from "./env.server";
import {
  auth,
  createProfilePort,
  fastModel,
  getProfile,
  llm,
  seedProfile,
  sources,
} from "./services";

/** Resolve the signed-in user, or null. */
async function currentUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}

new Elysia()
  .use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  )
  .all("/api/auth/*", async (context) => {
    const { request, status } = context;
    if (["POST", "GET"].includes(request.method)) {
      return auth.handler(request);
    }
    return status(405);
  })

  /**
   * The hero endpoint. Streams the investigation as Server-Sent Events so the
   * frontend can render each stage as it lands rather than waiting for the whole
   * thing. Event shapes are exactly `ThesisEvent` from packages/contracts.
   */
  .post("/api/thesis/stream", async ({ request, status }) => {
    const user = await currentUser(request);
    if (!user) return status(401);

    let query = "";
    try {
      const body = (await request.json()) as { query?: unknown };
      if (typeof body.query === "string") query = body.query.trim();
    } catch {
      return status(400);
    }
    if (!query) return status(400);

    const encoder = new TextEncoder();
    const send = (data: unknown) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of runThesis(
            {
              llm,
              fastModel,
              sources,
              profile: createProfilePort(user.id),
              onDrop: (stage, reason, text) => {
                // Visible proof the guards are doing work. Useful on demo day.
                console.log(`[guard] dropped in ${stage} (${reason}): ${text.slice(0, 80)}`);
              },
            },
            { query },
          )) {
            controller.enqueue(send(event));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Investigation failed";
          controller.enqueue(send({ type: "run.failed", message }));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        // Stops nginx/Coolify buffering the stream and ruining the whole effect.
        "X-Accel-Buffering": "no",
      },
    });
  })

  .get("/api/stocks", () => sources.listStocks())

  .get("/api/stocks/:ticker", ({ params, status }) => {
    const stock = sources.getStock(params.ticker);
    return stock ?? status(404);
  })

  .get("/api/glossary/:term", ({ params, query, status }) => {
    const entry = sources.getGlossary(params.term);
    if (!entry) return status(404);
    const level = typeof query.level === "string" ? query.level : "new";
    return {
      ...entry,
      explanation: entry.byLevel[level as keyof typeof entry.byLevel] ?? entry.oneLiner,
    };
  })

  .get("/api/profile", async ({ request, status }) => {
    const user = await currentUser(request);
    if (!user) return status(401);
    return await getProfile(user.id);
  })

  /** The Time Machine. Resets the profile to a scripted persona. */
  .post("/api/demo/seed", async ({ request, status }) => {
    const user = await currentUser(request);
    if (!user) return status(401);

    let stage: DemoStage = "day0";
    try {
      const body = (await request.json()) as { stage?: unknown };
      if (typeof body.stage === "string" && (DEMO_STAGES as readonly string[]).includes(body.stage)) {
        stage = body.stage as DemoStage;
      } else {
        return status(400);
      }
    } catch {
      return status(400);
    }

    return {
      stage,
      profile: await seedProfile(user.id, stage),
      // A question to prefill, NOT a scripted answer — the pipeline runs live.
      suggestedPrompt: DEMO_PROMPTS[stage],
    };
  })

  .get("/api/health", () => ({
    ok: true,
    stocks: sources.listStocks().length,
    model: env.MERGE_MODEL_SMART,
    llmConfigured: env.MERGE_API_KEY !== "replace-me",
  }))

  .get("/", () => "OK")
  // Coolify (and most PaaS) inject PORT. Default to 3000 for local dev.
  .listen(Number(process.env.PORT ?? 3000), ({ port }) => {
    console.log(`Server is running on http://localhost:${port}`);
  });
