/**
 * The thesis investigation engine.
 *
 * Yields the exact ThesisEvent stream the frontend consumes. Written as an async
 * generator rather than wrapped in a workflow framework, because every stage here
 * needs to emit several partial events as it goes (sources landing one at a time,
 * findings appearing individually) and that granular control IS the product —
 * it's what makes the investigation visibly assemble on screen.
 */

import {
  type Concept,
  type Finding,
  type Level,
  type Metric,
  type ParsedClaim,
  type SourceRef,
  type StageId,
  type ThesisEvent,
  STAGE_LABELS,
  VERDICT_DISCLAIMER,
} from "@bit-n-build-2026/contracts";
import { type Llm, checkNoRecommendation, enforceCitations } from "@bit-n-build-2026/llm";

import type { Retriever } from "@bit-n-build-2026/rag";

import type { ProfilePort, SourcesPort } from "./ports";
import {
  challengePrompt,
  explainMetricPrompt,
  sanitiseMetricExplanation,
  linkExposurePrompt,
  PARSE_SYSTEM,
  profileBlock,
  verdictPrompt,
  verifyTriggerPrompt,
} from "./prompts";
import { claimSchema, findingsSchema, verdictSchema } from "./schemas";

export interface EngineDeps {
  llm: Llm;
  /** Cheap model for short, high-volume rewrites. Falls back to the default. */
  fastModel?: string;
  /** Vector retrieval. Falls back to the sources layer's keyword search. */
  retriever?: Retriever;
  sources: SourcesPort;
  profile: ProfilePort;
  /** Optional: log dropped claims so we can see the citation guard working. */
  onDrop?: (stage: StageId, reason: string, text: string) => void;
}

export interface RunOptions {
  query: string;
  signal?: AbortSignal;
}

let counter = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${counter++}`;

export async function* runThesis(
  deps: EngineDeps,
  opts: RunOptions,
): AsyncGenerator<ThesisEvent> {
  const { llm, sources, profile, fastModel, retriever } = deps;
  const runId = nextId("run");
  const startedAt = Date.now();

  const userProfile = await profile.get();
  const level: Level = userProfile.level;

  yield {
    type: "run.started",
    runId,
    query: opts.query,
    level,
    at: new Date().toISOString(),
  };

  // Collected as we go, so later stages can see earlier results.
  const sourceRefs: SourceRef[] = [];
  const allFindings: Finding[] = [];
  // Assigned inside the parse stage's nested generator, which TS can't track —
  // hence the explicit annotation and the non-null assertions below.
  let claim: ParsedClaim | null = null;
  let metrics: Metric[] = [];

  /** Run one stage, converting a thrown error into stage.failed rather than killing the run. */
  async function* stage(
    id: StageId,
    body: () => AsyncGenerator<ThesisEvent>,
  ): AsyncGenerator<ThesisEvent> {
    yield { type: "stage.started", stage: id, label: STAGE_LABELS[id] };
    try {
      yield* body();
      yield { type: "stage.completed", stage: id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      yield { type: "stage.failed", stage: id, message };
    }
  }

  /** Validate model findings against the sources we actually have, then emit. */
  function* emitFindings(id: StageId, raw: unknown, limit = 3): Generator<ThesisEvent> {
    const parsed = findingsSchema.safeParse(raw);
    if (!parsed.success) {
      // Never fail silently — a stage producing nothing must be visible.
      deps.onDrop?.(id, "schema_mismatch", parsed.error.message.slice(0, 200));
      return;
    }

    const candidates = parsed.data.findings.slice(0, limit).map((f) => ({
      id: nextId("f"),
      stage: id,
      text: f.text,
      stance: f.stance,
      strength: f.strength,
      sourceIds: f.sourceIds,
    }));

    const { kept, dropped } = enforceCitations(
      candidates,
      sourceRefs.map((s) => s.id),
    );

    for (const d of dropped) {
      deps.onDrop?.(id, d.reason, d.item.text);
    }

    for (const finding of kept) {
      // Law 2 guard: regenerating is expensive mid-stream, so we drop instead.
      if (!checkNoRecommendation(finding.text).clean) {
        deps.onDrop?.(id, "recommendation_language", finding.text);
        continue;
      }
      allFindings.push(finding);
      yield { type: "finding.added", finding };
      for (const sourceId of finding.sourceIds) {
        yield { type: "source.checked", sourceId, stance: finding.stance };
      }
    }
  }

  // ---------------------------------------------------------------- parse
  yield* stage("parse", async function* () {
    const parsed = await llm.structured({
      messages: [
        { role: "system", content: PARSE_SYSTEM },
        { role: "user", content: opts.query },
      ],
      schema: claimSchema,
      schemaName: "parsed_claim",
      signal: opts.signal,
    });

    // Trust our own ticker resolution over the model's if they disagree.
    const resolved = sources.resolveTicker(parsed.asset?.ticker ?? opts.query);

    claim = {
      raw: opts.query,
      trigger: parsed.trigger,
      asset: resolved ?? parsed.asset,
      mechanism: parsed.mechanism,
      horizon: parsed.horizon,
    };

    yield { type: "claim.parsed", claim };
  });

  /**
   * No company named — "I want to invest long term". There is no thesis to
   * test yet, so hand off to discovery rather than failing six stages in a row.
   */
  if (!claim || (claim as ParsedClaim).asset === null) {
    yield { type: "run.needs_discovery", query: opts.query };
    return;
  }

  /**
   * They named a company we hold nothing about.
   *
   * Without this the run limps through five consecutive stage failures, which
   * reads as broken software rather than honest scope. Stop here and say what
   * we do cover — a judge typing a random ticker is a demonstration of the
   * product's core promise, not a bug.
   */
  {
    const named = (claim as ParsedClaim).asset!;
    if (!sources.getStock(named.ticker)) {
      yield {
        type: "run.not_covered",
        ticker: named.ticker,
        name: named.name,
        covered: sources
          .listStocks()
          .map((s) => ({ ticker: s.ticker, name: s.name, sector: s.sector })),
      };
      return;
    }
  }

  // --------------------------------------------------------------- gather
  yield* stage("gather", async function* () {
    const ticker = claim?.asset?.ticker;
    const query = claim?.trigger?.text ?? opts.query;

    /**
     * Vector retrieval first, keyword as the fallback. The fallback is not
     * dead code — it is what runs if the vector store is unreachable, and it
     * keeps the investigation working rather than failing.
     */
    let hits: { docId: string; text: string }[] = [];
    if (retriever) {
      try {
        const results = await retriever.search(query, {
          limit: 8,
          filter: { kinds: ["source"], tickers: ticker ? [ticker] : undefined },
        });
        hits = results.map((r) => ({ docId: r.payload.docId, text: r.payload.text }));
      } catch (error) {
        console.warn(
          "[engine] vector search failed, using keyword search:",
          error instanceof Error ? error.message : error,
        );
      }
    }
    if (!hits.length) {
      hits = sources
        .searchSources(query, { tickers: ticker ? [ticker] : undefined, limit: 8 })
        .map((h) => ({ docId: h.docId, text: h.text }));
    }

    const seen = new Set<string>();
    for (const hit of hits) {
      if (seen.has(hit.docId)) continue;
      seen.add(hit.docId);

      const doc = sources.getDocument(hit.docId);
      if (!doc) continue;

      const ref: SourceRef = {
        id: doc.id,
        title: doc.title,
        publisher: doc.publisher,
        url: doc.url,
        tier: doc.tier,
        publishedAt: doc.publishedAt,
        snippet: hit.text.slice(0, 300),
      };
      sourceRefs.push(ref);
      yield { type: "source.found", source: ref };
    }

    if (sourceRefs.length === 0) {
      throw new Error("We don't have verified coverage for this company or claim yet.");
    }
  });

  /* ------------------------------------------------------------------ *
   * The next three stages are independent of one another: each needs only the
   * claim, the sources, and the raw (pre-explanation) metrics. Run them as one
   * concurrent wave and yield the results in stage order, so the UI still sees
   * an ordered investigation while we pay for one round trip instead of four.
   * Cuts a run from ~40s to ~15s, which is the difference between a demo that
   * holds a room and one that doesn't.
   * ------------------------------------------------------------------ */

  const parsedClaim = claim as ParsedClaim | null;
  const stock = parsedClaim?.asset?.ticker ? sources.getStock(parsedClaim.asset.ticker) : null;

  /** Settle rather than reject, so an early failure can't become an unhandled rejection. */
  const settle = <T>(p: Promise<T>) =>
    p.then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    );

  const findingsCall = (prompt: string) =>
    settle(
      llm.structured({
        messages: [
          { role: "system", content: PARSE_SYSTEM },
          { role: "user", content: prompt },
        ],
        schema: findingsSchema,
        schemaName: "findings",
        signal: opts.signal,
      }),
    );

  const haveInput = Boolean(parsedClaim) && sourceRefs.length > 0;
  const metricsSummary =
    stock?.metrics.map((m) => `${m.label} ${m.display}`).join(", ") || "not available";

  const verifyWave = haveInput ? findingsCall(verifyTriggerPrompt(parsedClaim!, sourceRefs)) : null;
  const linkWave = haveInput ? findingsCall(linkExposurePrompt(parsedClaim!, sourceRefs)) : null;
  const challengeWave = haveInput
    ? findingsCall(challengePrompt(parsedClaim!, sourceRefs, metricsSummary))
    : null;
  const metricsWave = stock ? settle(explainMetrics(stock.metrics)) : null;

  async function explainMetrics(raw: Metric[]): Promise<Metric[]> {
    return Promise.all(
      raw.map(async (metric) => {
        try {
          const explanation = await llm.chat({
            messages: [
              {
                role: "user",
                content: explainMetricPrompt(
                  metric.label,
                  metric.display,
                  metric.sectorMedian,
                  level,
                ),
              },
            ],
            model: fastModel,
            maxTokens: 200,
            temperature: 0.3,
            signal: opts.signal,
          });
          return {
            ...metric,
            explanation: sanitiseMetricExplanation(explanation, level),
          };
        } catch {
          // Keep the number even if the explanation fails — the figure is the fact.
          return metric;
        }
      }),
    );
  }

  /** Await one wave result and emit it, turning a failure into stage.failed. */
  async function* emitWave(
    id: StageId,
    wave: Awaited<ReturnType<typeof findingsCall>> | null,
  ): AsyncGenerator<ThesisEvent> {
    if (!wave) throw new Error("No sources available to check this against.");
    if (!wave.ok) {
      throw wave.error instanceof Error ? wave.error : new Error("Model call failed");
    }
    yield* emitFindings(id, wave.value);
  }

  yield* stage("verify_trigger", async function* () {
    yield* emitWave("verify_trigger", verifyWave ? await verifyWave : null);
  });

  yield* stage("link_exposure", async function* () {
    yield* emitWave("link_exposure", linkWave ? await linkWave : null);
  });

  // No AI decides these numbers — they come straight from the data layer.
  // The model only writes the one-line explanation, at the user's level.
  yield* stage("fundamentals", async function* () {
    if (!stock) throw new Error("No fundamentals available for this company.");
    const result = metricsWave ? await metricsWave : null;
    metrics = result?.ok ? result.value : stock.metrics;
    yield { type: "metrics.ready", metrics };
  });

  yield* stage("challenge", async function* () {
    yield* emitWave("challenge", challengeWave ? await challengeWave : null);
  });

  // ---------------------------------------------------------------- learn
  yield* stage("learn", async function* () {
    const mentioned = conceptsMentioned(allFindings, metrics);
    const taught: string[] = [];

    for (const key of mentioned) {
      const entry = sources.getGlossary(key);
      if (!entry) continue;

      const alreadyKnown = userProfile.knownConcepts.includes(key);
      const concept: Concept = {
        key: entry.key,
        term: entry.term,
        oneLiner: entry.oneLiner,
        explanation: entry.byLevel[level] ?? entry.oneLiner,
        alreadyKnown,
      };
      taught.push(key);
      yield { type: "concept.taught", concept };
    }

    if (taught.length) await profile.learnConcepts(taught);
  });

  // -------------------------------------------------------------- verdict
  yield* stage("verdict", async function* () {
    if (!claim) throw new Error("No claim to judge");

    const summary = allFindings
      .map((f) => `- [${f.stance}] ${f.text}`)
      .join("\n") || "- nothing verified";

    const result = await llm.structured({
      messages: [
        { role: "system", content: `${PARSE_SYSTEM}\n\n${profileBlock(userProfile)}` },
        { role: "user", content: verdictPrompt(claim, summary) },
      ],
      schema: verdictSchema,
      schemaName: "verdict",
      signal: opts.signal,
    });

    yield {
      type: "verdict.ready",
      verdict: { ...result, disclaimer: VERDICT_DISCLAIMER },
    };
  });

  yield { type: "run.completed", runId, durationMs: Date.now() - startedAt };
}

/** Which glossary terms actually came up, so we only teach what was used. */
function conceptsMentioned(findings: Finding[], metrics: Metric[]): string[] {
  const keys = new Set<string>(metrics.map((m) => m.key));
  const text = findings.map((f) => f.text.toLowerCase()).join(" ");

  const phrases: [string, string][] = [
    ["priced in", "priced_in"],
    ["order book", "order_book"],
    ["grey market", "gmp"],
    ["offer for sale", "ofs"],
    ["valuation", "valuation"],
    ["volatil", "volatility"],
  ];
  for (const [needle, key] of phrases) {
    if (text.includes(needle)) keys.add(key);
  }
  return [...keys];
}
