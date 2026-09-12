import {
  AGE_BANDS,
  DECISION_ACTIONS,
  DEMO_STAGES,
  EXPERIENCES,
  HORIZONS,
  PRIMARY_GOALS,
  RISK_COMFORTS,
  type DecisionAction,
  type DemoStage,
  type OnboardingAnswers,
} from "@bit-n-build-2026/contracts";
import { runChat, runDiscovery, runThesis } from "@bit-n-build-2026/engine";
import { extensionTrustedOrigin } from "@bit-n-build-2026/auth/extension-oauth";
import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { DEMO_PROMPTS } from "./demo-personas";
import { env } from "./env.server";
import {
  auth,
  createProfilePort,
  fastModel,
  getRetriever,
  llm,
  seedProfile,
  sources,
  verifyExtensionAccessToken,
} from "./services";
import { bearerToken, isAllowedBrowserOrigin, oauthSubject } from "./extension-auth";
import {
  getOnboarding,
  getPortfolio,
  getProfile,
  getUserContext,
  listDecisions,
  listMessages,
  newId,
  recordDecision,
  saveMessage,
  saveOnboarding,
} from "./store";

async function currentUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user) return session.user;

  const token = bearerToken(request.headers);
  if (!token) return null;
  try {
    const subject = oauthSubject(await verifyExtensionAccessToken(token));
    return subject ? { id: subject } : null;
  } catch {
    return null;
  }
}

const extensionOrigin = extensionTrustedOrigin(env.EXTENSION_CHROME_ID);

/** Shared SSE plumbing. Every streaming endpoint uses this. */
function sse(produce: (emit: (event: unknown) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        await produce(emit);
      } catch (error) {
        emit({
          type: "run.failed",
          message: error instanceof Error ? error.message : "Stream failed",
        });
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
      // Stops nginx/Traefik buffering the stream, which would collapse the
      // stage-by-stage assembly into one lump and ruin the whole effect.
      "X-Accel-Buffering": "no",
    },
  });
}

const oneOf = <T extends readonly string[]>(list: T, value: unknown): T[number] | null =>
  typeof value === "string" && (list as readonly string[]).includes(value)
    ? (value as T[number])
    : null;

new Elysia()
  .use(
    cors({
      origin: (request) =>
        isAllowedBrowserOrigin(request.headers.get("origin"), env.CORS_ORIGIN, extensionOrigin),
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  )
  .get("/.well-known/oauth-authorization-server/api/auth", ({ request }) =>
    oauthProviderAuthServerMetadata(auth)(request),
  )
  .get("/.well-known/openid-configuration/api/auth", ({ request }) =>
    oauthProviderOpenIdConfigMetadata(auth)(request),
  )
  .all("/api/auth/*", async (context) => {
    const { request, status } = context;
    if (["POST", "GET"].includes(request.method)) return auth.handler(request);
    return status(405);
  })

  /* ------------------------------------------------------------ onboarding */

  .get("/api/onboarding", async ({ request, status }) => {
    const user = await currentUser(request);
    if (!user) return status(401);
    return getOnboarding(user.id);
  })

  .post("/api/onboarding", async ({ request, status }) => {
    const user = await currentUser(request);
    if (!user) return status(401);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return status(400);
    }

    const budget = Number(body.monthlyBudget);
    const answers: OnboardingAnswers = {
      ageBand: oneOf(AGE_BANDS, body.ageBand),
      primaryGoal: oneOf(PRIMARY_GOALS, body.primaryGoal),
      riskComfort: oneOf(RISK_COMFORTS, body.riskComfort),
      experience: oneOf(EXPERIENCES, body.experience),
      monthlyBudget: Number.isFinite(budget) && budget > 0 ? Math.round(budget) : null,
      horizon: oneOf(HORIZONS, body.horizon),
      notes: typeof body.notes === "string" ? body.notes.slice(0, 1000) : null,
    };

    const saved = await saveOnboarding(user.id, answers);

    // Index their answers so retrieval can surface them later — "you told us
    // you'd panic-sell in a drop" has to be findable, not just in a prompt.
    try {
      const retriever = await getRetriever();
      const text = [
        answers.primaryGoal && `Their goal: ${answers.primaryGoal}`,
        answers.horizon && `They may need the money: ${answers.horizon}`,
        answers.riskComfort && `If down 20% they would: ${answers.riskComfort}`,
        answers.experience && `Experience level: ${answers.experience}`,
        answers.notes && `In their words: ${answers.notes}`,
      ]
        .filter(Boolean)
        .join(". ");
      if (text) {
        await retriever.indexPersonal(user.id, [
          { id: "onboarding", text, kind: "profile" },
        ]);
      }
    } catch {
      // Indexing is an enhancement — never fail onboarding over it.
    }

    return saved;
  })

  /* ------------------------------------------------- thesis + discovery SSE */

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

    const retriever = await getRetriever().catch(() => undefined);

    return sse(async (emit) => {
      let needsDiscovery = false;

      for await (const event of runThesis(
        {
          llm,
          fastModel,
          sources,
          retriever,
          profile: createProfilePort(user.id),
          onDrop: (stage, reason, text) =>
            console.log(`[guard] dropped in ${stage} (${reason}): ${text.slice(0, 80)}`),
        },
        { query },
      )) {
        emit(event);
        if (event.type === "run.needs_discovery") needsDiscovery = true;
      }

      // No company named — continue the same stream with discovery.
      if (needsDiscovery) {
        for await (const event of runDiscovery({ llm, sources }, { query })) {
          emit(event);
        }
      }
    });
  })

  /* ------------------------------------------------------------------ chat */

  .post("/api/chat/stream", async ({ request, status }) => {
    const user = await currentUser(request);
    if (!user) return status(401);

    let message = "";
    let threadId = "";
    try {
      const body = (await request.json()) as { message?: unknown; threadId?: unknown };
      if (typeof body.message === "string") message = body.message.trim();
      if (typeof body.threadId === "string") threadId = body.threadId;
    } catch {
      return status(400);
    }
    if (!message) return status(400);
    if (!threadId) threadId = newId("thr");

    const [retriever, context, history] = await Promise.all([
      getRetriever(),
      getUserContext(user.id),
      listMessages(user.id, threadId, 12),
    ]);

    await saveMessage({ userId: user.id, threadId, role: "user", content: message });
    const messageId = newId("msg");

    return sse(async (emit) => {
      let content = "";
      let sourceIds: string[] = [];

      for await (const event of runChat(
        { llm, retriever, sources, model: fastModel },
        { userId: user.id, threadId, messageId, message, context, history },
      )) {
        emit(event);
        if (event.type === "chat.completed") content = event.content;
        if (event.type === "chat.sources") sourceIds = event.sources.map((s) => s.id);
      }

      if (content) {
        await saveMessage({
          userId: user.id,
          threadId,
          role: "assistant",
          content,
          sourceIds,
        });
      }
    });
  })

  .get("/api/chat/:threadId", async ({ request, params, status }) => {
    const user = await currentUser(request);
    if (!user) return status(401);
    return listMessages(user.id, params.threadId, 100);
  })

  /* ------------------------------------------------------------- decisions */

  .get("/api/decisions", async ({ request, status }) => {
    const user = await currentUser(request);
    if (!user) return status(401);
    return listDecisions(user.id);
  })

  .post("/api/decisions", async ({ request, status }) => {
    const user = await currentUser(request);
    if (!user) return status(401);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return status(400);
    }

    const ticker = typeof body.ticker === "string" ? body.ticker.trim().toUpperCase() : "";
    const action = oneOf(DECISION_ACTIONS, body.action) as DecisionAction | null;
    if (!ticker || !action) return status(400);

    const quantity = Number(body.quantity);
    const price = Number(body.pricePerShare);

    const decision = await recordDecision(user.id, {
      ticker,
      action,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : null,
      pricePerShare: Number.isFinite(price) && price > 0 ? price : null,
      thesis: typeof body.thesis === "string" ? body.thesis.slice(0, 2000) : null,
      investigationSummary:
        typeof body.investigationSummary === "string"
          ? body.investigationSummary.slice(0, 4000)
          : null,
      reasoning: typeof body.reasoning === "string" ? body.reasoning.slice(0, 2000) : null,
    });

    // Make the decision retrievable — this is the memory the product is built on.
    try {
      const retriever = await getRetriever();
      const summary =
        `On ${decision.decidedAt.slice(0, 10)} they ${decision.action} ` +
        `${decision.ticker} (${decision.companyName})` +
        (decision.quantity ? `, ${decision.quantity} shares` : "") +
        (decision.pricePerShare ? ` at ₹${decision.pricePerShare}` : "") +
        (decision.thesis ? `. Their thesis: "${decision.thesis}"` : "") +
        (decision.reasoning ? `. Their reasoning: "${decision.reasoning}"` : "");
      await retriever.indexPersonal(user.id, [
        { id: decision.id, text: summary, kind: "decision", tickers: [decision.ticker] },
      ]);
    } catch {
      // Never fail the write because indexing failed.
    }

    return decision;
  })

  .get("/api/portfolio", async ({ request, status }) => {
    const user = await currentUser(request);
    if (!user) return status(401);
    return getPortfolio(user.id);
  })

  /* ------------------------------------------------------ stocks + glossary */

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

  /* ----------------------------------------------------- profile + demo */

  .get("/api/profile", async ({ request, status }) => {
    const user = await currentUser(request);
    if (!user) return status(401);
    return getProfile(user.id);
  })

  .post("/api/demo/seed", async ({ request, status }) => {
    const user = await currentUser(request);
    if (!user) return status(401);

    let stage: DemoStage;
    try {
      const body = (await request.json()) as { stage?: unknown };
      const parsed = oneOf(DEMO_STAGES, body.stage);
      if (!parsed) return status(400);
      stage = parsed;
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

  .get("/api/health", async () => {
    let vectors: { store: string; points: number } | null = null;
    try {
      const retriever = await getRetriever();
      vectors = { store: retriever.store.name, points: await retriever.store.count() };
    } catch {
      vectors = null;
    }
    return {
      ok: true,
      stocks: sources.listStocks().length,
      models: { smart: env.MERGE_MODEL_SMART, fast: env.MERGE_MODEL_FAST },
      llmConfigured: env.MERGE_API_KEY !== "replace-me",
      vectors,
    };
  })

  .get("/", () => "OK")
  .listen(Number(process.env.PORT ?? 3000), ({ port }) => {
    console.log(`Server is running on http://localhost:${port}`);
  });
