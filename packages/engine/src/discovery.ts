/**
 * Generalised intent: "I want to invest long term", with no company named.
 *
 * ⚠️ THE CRITICAL DESIGN POINT
 *
 * This is not a recommendation engine, and it must never become one. Our second
 * product law is that we never rate or recommend an asset — that is the thing
 * that separates us from "AI says BUY RELIANCE 🚀".
 *
 * So the filtering is done in CODE, against real numbers, not by asking a model
 * to pick favourites. The model's only job is (a) reading the user's sentence
 * into structured wants, and (b) writing the plain-English business summary.
 * Which companies match is arithmetic over Tushar's data, and every match line
 * carries the figure it came from.
 *
 * Output reads as: "these companies in our coverage have the characteristics you
 * described — here are the numbers, here's what to watch out for, pick one and
 * we'll test your reasoning." Never "buy these".
 */

import {
  DISCOVERY_DISCLAIMER,
  DISCOVERY_NEXT_STEP,
  type DiscoveryCandidate,
  type DiscoveryEvent,
  type DiscoveryIntent,
  type Metric,
  type SourceRef,
  type StockRecord,
} from "@bit-n-build-2026/contracts";
import type { Llm } from "@bit-n-build-2026/llm";
import { z } from "zod";

import type { SourcesPort } from "./ports";

export const intentSchema = z.object({
  goal: z.string().nullable().describe("What they said they want, in their own words"),
  horizon: z.enum(["intraday", "short", "long", "unspecified"]),
  sectors: z.array(z.string()).describe("Sectors they named. Empty if none."),
  wants: z.object({
    lowDebt: z.boolean(),
    lowVolatility: z.boolean(),
    dividendIncome: z.boolean(),
    largeEstablished: z.boolean(),
    cheapValuation: z.boolean(),
  }),
});

const INTENT_SYSTEM = `You turn a beginner's sentence about investing into structured preferences.

They might say "I want to invest long term" or "something safe that pays me regularly"
or "I want to try short term trading in defence".

Set a "wants" flag to true ONLY if their words actually imply it:
- lowDebt / lowVolatility: they mentioned safety, steadiness, not losing money, or a
  long horizon with low risk tolerance
- dividendIncome: they mentioned income, regular payouts, or dividends
- largeEstablished: they mentioned big, well-known, trusted or established companies
- cheapValuation: they mentioned cheap, value, or not overpaying

Do not infer aggressively. If they only said "long term", that implies lowVolatility
and largeEstablished, and nothing else. Never invent a sector they did not mention.`;

/** Does this sentence name no company, i.e. is it a discovery question? */
export function isGeneralQuery(claim: { asset: { ticker: string } | null }): boolean {
  return claim.asset === null;
}

const metric = (stock: StockRecord, key: string): Metric | undefined =>
  stock.metrics.find((m) => m.key === key);

const value = (stock: StockRecord, key: string): number | null => metric(stock, key)?.value ?? null;

/**
 * Score a company against the stated wants.
 *
 * Returns null when we simply don't have the data to judge — we would rather
 * show fewer companies than pretend to know something we don't.
 */
function evaluate(
  stock: StockRecord,
  intent: DiscoveryIntent,
): { score: number; matchedOn: DiscoveryCandidate["matchedOn"] } | null {
  const matchedOn: DiscoveryCandidate["matchedOn"] = [];
  let score = 0;
  let testable = 0;

  if (intent.sectors.length) {
    const sector = stock.sector.toLowerCase();
    if (!intent.sectors.some((s) => sector.includes(s.toLowerCase()))) return null;
    matchedOn.push({
      label: "Sector",
      detail: `Operates in ${stock.sector}, which you asked about.`,
      sourceIds: [],
    });
    score += 1;
  }

  if (intent.wants.lowDebt) {
    const de = value(stock, "debt_to_equity");
    const median = stock.sectorMedians.debt_to_equity ?? null;
    if (de !== null) {
      testable++;
      if (median !== null && de < median) {
        score += 1;
        matchedOn.push({
          label: "Low debt",
          detail: `Debt to equity of ${de}, below the sector median of ${median}.`,
          sourceIds: metric(stock, "debt_to_equity")?.sourceIds ?? [],
        });
      }
    }
  }

  if (intent.wants.cheapValuation) {
    const pe = value(stock, "pe");
    const median = stock.sectorMedians.pe ?? null;
    if (pe !== null) {
      testable++;
      if (median !== null && pe < median) {
        score += 1;
        matchedOn.push({
          label: "Valuation below sector",
          detail: `P/E of ${pe}, below the sector median of ${median}.`,
          sourceIds: metric(stock, "pe")?.sourceIds ?? [],
        });
      }
    }
  }

  if (intent.wants.dividendIncome) {
    const dy = value(stock, "dividend_yield");
    if (dy !== null) {
      testable++;
      if (dy > 0) {
        score += 1;
        matchedOn.push({
          label: "Pays a dividend",
          detail: `Dividend yield of ${dy}%.`,
          sourceIds: metric(stock, "dividend_yield")?.sourceIds ?? [],
        });
      }
    }
  }

  if (intent.wants.lowVolatility) {
    const risk = stock.risk.find((r) => r.key === "volatility");
    if (risk) {
      testable++;
      // Only genuinely low volatility counts. Calling a 66% annual swing
      // "steady" because it is mid-range for the sector would be exactly the
      // kind of reassuring half-truth this product exists to remove.
      if (risk.level === "low") {
        score += 1;
        matchedOn.push({
          label: "Price steadiness",
          detail: risk.reason,
          sourceIds: risk.sourceIds,
        });
      }
    }
  }

  if (intent.wants.largeEstablished) {
    const cap = value(stock, "market_cap");
    if (cap !== null) {
      testable++;
      // Above roughly ₹50,000 Cr is unambiguously large-cap in India.
      if (cap > 50000) {
        score += 1;
        matchedOn.push({
          label: "Large, established company",
          detail: `Market capitalisation of ₹${Math.round(cap).toLocaleString("en-IN")} Cr.`,
          sourceIds: metric(stock, "market_cap")?.sourceIds ?? [],
        });
      }
    }
  }

  // Nothing we could actually test against — don't pretend it matched.
  if (testable === 0 && !intent.sectors.length) return null;
  if (!matchedOn.length) return null;

  return { score, matchedOn };
}

/** Always populated. Nothing here is ever presented as safe. */
function watchOuts(stock: StockRecord): DiscoveryCandidate["watchOut"] {
  const out: DiscoveryCandidate["watchOut"] = [];

  for (const risk of stock.risk) {
    // Medium counts too. A watch-out list that only fires on "high" quietly
    // tells the user everything else is fine, which is not what the data says.
    if (risk.level === "high" || risk.level === "medium") {
      out.push({ label: risk.label, detail: risk.reason, sourceIds: risk.sourceIds });
    }
  }

  // The stock's own risk list may already carry a valuation flag; saying the
  // same thing twice makes the list look padded.
  const hasValuationFlag = out.some((o) => o.label === "Valuation");
  const pe = value(stock, "pe");
  const peMedian = stock.sectorMedians.pe ?? null;
  if (!hasValuationFlag && pe !== null && peMedian !== null && pe > peMedian) {
    out.push({
      label: "Priced above its sector",
      detail: `P/E of ${pe} against a sector median of ${peMedian} — the market already expects more from it than from its peers.`,
      sourceIds: metric(stock, "pe")?.sourceIds ?? [],
    });
  }

  if (!out.length) {
    out.push({
      label: "Absence of a flag is not a green light",
      detail:
        "Nothing in the figures we hold stands out as a concern. That is not the same as safe — " +
        "we only hold a handful of numbers about this company. Investigate your own reasoning before acting.",
      sourceIds: [],
    });
  }
  return out;
}

export interface DiscoveryDeps {
  llm: Llm;
  sources: SourcesPort & { listStocks(): { ticker: string }[] };
}

export async function* runDiscovery(
  deps: DiscoveryDeps,
  opts: { query: string; limit?: number; signal?: AbortSignal },
): AsyncGenerator<DiscoveryEvent> {
  const { llm, sources } = deps;
  yield { type: "discovery.started", query: opts.query };

  let intent: DiscoveryIntent;
  try {
    const parsed = await llm.structured({
      messages: [
        { role: "system", content: INTENT_SYSTEM },
        { role: "user", content: opts.query },
      ],
      schema: intentSchema,
      schemaName: "discovery_intent",
      signal: opts.signal,
    });
    intent = { raw: opts.query, ...parsed };
  } catch (error) {
    yield {
      type: "discovery.failed",
      message: error instanceof Error ? error.message : "Could not read that request",
    };
    return;
  }

  yield { type: "discovery.intent", intent };

  const universe = sources
    .listStocks()
    .map((s) => sources.getStock(s.ticker))
    .filter((s): s is StockRecord => s !== null);

  const scored = universe
    .map((stock) => ({ stock, result: evaluate(stock, intent) }))
    .filter((x): x is { stock: StockRecord; result: NonNullable<ReturnType<typeof evaluate>> } =>
      x.result !== null,
    )
    // Ordered by how many stated characteristics they match — NOT by how good
    // an investment they are. That distinction is the whole point.
    .sort((a, b) => b.result.score - a.result.score)
    .slice(0, opts.limit ?? 4);

  const emittedSources = new Set<string>();
  for (const { stock, result } of scored) {
    for (const line of [...result.matchedOn, ...watchOuts(stock)]) {
      for (const id of line.sourceIds) {
        if (emittedSources.has(id)) continue;
        emittedSources.add(id);
        const doc = sources.getDocument(id);
        if (!doc) continue;
        const ref: SourceRef = {
          id: doc.id,
          title: doc.title,
          publisher: doc.publisher,
          url: doc.url,
          tier: doc.tier,
          publishedAt: doc.publishedAt,
          snippet: doc.chunks[0]?.text.slice(0, 300) ?? doc.text.slice(0, 300),
        };
        yield { type: "discovery.source", source: ref };
      }
    }
  }

  for (const { stock, result } of scored) {
    yield {
      type: "discovery.candidate",
      candidate: {
        ticker: stock.ticker,
        name: stock.name,
        sector: stock.sector,
        business: stock.business,
        matchedOn: result.matchedOn,
        watchOut: watchOuts(stock),
      },
    };
  }

  yield {
    type: "discovery.completed",
    universeSize: universe.length,
    matched: scored.length,
    disclaimer: DISCOVERY_DISCLAIMER,
    nextStep: DISCOVERY_NEXT_STEP,
  };
}
