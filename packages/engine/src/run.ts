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

import type { ProfilePort, SourcesPort } from "./ports";
import {
  challengePrompt,
  explainMetricPrompt,
  linkExposurePrompt,
  PARSE_SYSTEM,
  profileBlock,
  verdictPrompt,
  verifyTriggerPrompt,
} from "./prompts";
import { claimSchema, findingsSchema, verdictSchema } from "./schemas";

export interface EngineDeps {
  llm: Llm;
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
  const { llm, sources, profile } = deps;
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

  /**
   * A stage that needs evidence must not quietly report success with nothing in
   * it. If gather found nothing, say so where the user can see it.
   */
  function requireSources() {
    if (sourceRefs.length === 0) {
      throw new Error("No sources available to check this against.");
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

  // --------------------------------------------------------------- gather
  yield* stage("gather", async function* () {
    const ticker = claim?.asset?.ticker;
    const hits = sources.searchSources(claim?.trigger?.text ?? opts.query, {
      tickers: ticker ? [ticker] : undefined,
      limit: 8,
    });

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

  // ------------------------------------------------------- verify_trigger
  yield* stage("verify_trigger", async function* () {
    if (!claim) throw new Error("No claim to verify");
    requireSources();
    const result = await llm.structured({
      messages: [
        { role: "system", content: PARSE_SYSTEM },
        { role: "user", content: verifyTriggerPrompt(claim, sourceRefs) },
      ],
      schema: findingsSchema,
      schemaName: "findings",
      signal: opts.signal,
    });
    yield* emitFindings("verify_trigger", result);
  });

  // -------------------------------------------------------- link_exposure
  yield* stage("link_exposure", async function* () {
    if (!claim) throw new Error("No claim to link");
    requireSources();
    const result = await llm.structured({
      messages: [
        { role: "system", content: PARSE_SYSTEM },
        { role: "user", content: linkExposurePrompt(claim, sourceRefs) },
      ],
      schema: findingsSchema,
      schemaName: "findings",
      signal: opts.signal,
    });
    yield* emitFindings("link_exposure", result);
  });

  // --------------------------------------------------------- fundamentals
  // No AI decides these numbers. They come straight from the data layer.
  // The model only writes the one-line explanation, at the user's level.
  yield* stage("fundamentals", async function* () {
    const ticker = claim?.asset?.ticker;
    const stock = ticker ? sources.getStock(ticker) : null;
    if (!stock) throw new Error("No fundamentals available for this company.");

    metrics = await Promise.all(
      stock.metrics.map(async (metric) => {
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
            maxTokens: 160,
            temperature: 0.3,
            signal: opts.signal,
          });
          return { ...metric, explanation: explanation.trim() };
        } catch {
          // Keep the number even if the explanation fails — the figure is the fact.
          return metric;
        }
      }),
    );

    yield { type: "metrics.ready", metrics };
  });

  // ------------------------------------------------------------ challenge
  yield* stage("challenge", async function* () {
    if (!claim) throw new Error("No claim to challenge");
    requireSources();
    const summary = metrics.map((m) => `${m.label} ${m.display}`).join(", ") || "not available";

    const result = await llm.structured({
      messages: [
        { role: "system", content: PARSE_SYSTEM },
        { role: "user", content: challengePrompt(claim, sourceRefs, summary) },
      ],
      schema: findingsSchema,
      schemaName: "findings",
      signal: opts.signal,
    });
    yield* emitFindings("challenge", result);
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
