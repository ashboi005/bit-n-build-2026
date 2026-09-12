/**
 * "What changed since you last looked."
 *
 * Deliberately NOT a cron job. Everything here is a diff between figures we
 * already hold and documents we already have, so computing it on request takes
 * milliseconds and is always current. A scheduled job would add a second source
 * of truth, a staleness window, and a thing that can silently stop running the
 * night before a demo — for no benefit.
 *
 * ⚠️ Every signal is derived in CODE and carries its citations. The model's only
 * job is phrasing the one-line headline at the user's level. It never decides
 * what changed, and it never says buy or sell — this reviews the REASONING the
 * user gave, not the asset.
 */

import {
  CHANGES_DISCLAIMER,
  CONCENTRATION_WARNING,
  PRICE_MOVE_ATTENTION,
  PRICE_MOVE_WARNING,
  type ChangeItem,
  type ChangeReport,
  type ChangeSignal,
  type Decision,
  type SourceRef,
  type ThesisStatus,
} from "@bit-n-build-2026/contracts";
import type { Llm } from "@bit-n-build-2026/llm";

import type { UserContext } from "./context";
import type { SourcesPort } from "./ports";

export interface ChangesDeps {
  sources: SourcesPort & { listDocuments?: () => ReturnType<SourcesPort["getDocument"]>[] };
  llm?: Llm;
  /** Cheap model for the headlines. */
  model?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const pct = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
const inr = (n: number) => `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;

/** Documents about this company published after the user decided. */
function documentsSince(
  deps: ChangesDeps,
  ticker: string,
  since: Date,
  limit = 3,
): SourceRef[] {
  const all = deps.sources.listDocuments?.() ?? [];
  return all
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .filter((d) => d.tickers.includes(ticker))
    // Market-data snapshots carry today's date on every refresh, so they would
    // show up as "new" forever. Only things that actually happened count.
    .filter((d) => d.tier !== "market_data")
    .filter((d) => {
      if (!d.publishedAt) return false;
      const at = new Date(d.publishedAt);
      return !Number.isNaN(at.getTime()) && at >= since;
    })
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, limit)
    .map((d) => ({
      id: d.id,
      title: d.title,
      publisher: d.publisher,
      url: d.url,
      tier: d.tier,
      publishedAt: d.publishedAt,
      snippet: d.chunks[0]?.text.slice(0, 220) ?? d.text.slice(0, 220),
    }));
}

/**
 * Grade the user's REASONING, not the company.
 *
 * A price fall alone never means the thesis broke — markets move for reasons
 * nobody stated. What matters is whether the thing they said would happen has,
 * and whether they had a mechanism at all.
 */
function gradeThesis(
  decision: Decision,
  priceChange: number | null,
  daysAgo: number,
  hasNewFilings: boolean,
): ThesisStatus {
  if (!decision.thesis) return "unclear";

  // Reasoning with no mechanism — "everyone is talking about it" — was never
  // testable. Say so rather than pretending the price settles it.
  const hypeOnly =
    /everyone|every one|people are|trending|viral|reels?|instagram|twitter|telegram|tip|hot stock|will explode|to the moon/i.test(
      decision.thesis,
    );

  if (daysAgo < 3 && !hasNewFilings) return "too_early";

  if (hypeOnly) {
    if (priceChange !== null && priceChange <= -PRICE_MOVE_ATTENTION) return "broken";
    return "weakening";
  }

  if (priceChange === null) return "unclear";
  if (priceChange <= -PRICE_MOVE_WARNING) return "weakening";
  if (priceChange >= PRICE_MOVE_ATTENTION) return "holding";
  return "holding";
}

const STATUS_FALLBACK: Record<ThesisStatus, string> = {
  holding: "Nothing so far contradicts the reason you gave.",
  weakening: "Some of what you assumed has not played out yet.",
  broken: "The specific reason you gave has not held up.",
  too_early: "Too early to tell — nothing has happened since you decided.",
  unclear: "There is not enough here to test your reasoning either way.",
};

export async function computeChanges(
  deps: ChangesDeps,
  ctx: UserContext,
): Promise<ChangeReport> {
  const now = Date.now();
  const items: ChangeItem[] = [];

  // One entry per company, using their most recent decision about it.
  const latest = new Map<string, Decision>();
  for (const d of ctx.decisions) {
    const existing = latest.get(d.ticker);
    if (!existing || d.decidedAt > existing.decidedAt) latest.set(d.ticker, d);
  }

  for (const decision of latest.values()) {
    const stock = deps.sources.getStock(decision.ticker);
    const decidedAt = new Date(decision.decidedAt);
    const daysAgo = Math.max(0, Math.round((now - decidedAt.getTime()) / DAY_MS));
    const signals: ChangeSignal[] = [];

    const priceSource = stock?.price?.sourceId ? [stock.price.sourceId] : [];
    const nowPrice = stock?.price?.last ?? null;

    // Reference price: what they paid, else the market price when they decided.
    const thenPrice = decision.pricePerShare ?? null;

    let price: ChangeItem["price"] = null;
    let priceChange: number | null = null;

    if (thenPrice !== null && nowPrice !== null && thenPrice > 0) {
      priceChange = (nowPrice - thenPrice) / thenPrice;
      price = {
        then: thenPrice,
        now: nowPrice,
        changePct: priceChange,
        direction: Math.abs(priceChange) < 0.01 ? "flat" : priceChange > 0 ? "up" : "down",
      };

      const magnitude = Math.abs(priceChange);
      if (magnitude >= PRICE_MOVE_ATTENTION) {
        signals.push({
          kind: "price_move",
          severity: magnitude >= PRICE_MOVE_WARNING ? "warning" : "attention",
          label: priceChange > 0 ? "Price up" : "Price down",
          detail:
            `${decision.ticker} has moved ${pct(priceChange)} since you ` +
            `${decision.action === "bought" ? "bought" : "looked"}, ` +
            `from ₹${thenPrice.toLocaleString("en-IN")} to ₹${nowPrice.toLocaleString("en-IN")}.`,
          sourceIds: priceSource,
        });
      }
    }

    // What the company has actually said since.
    const newDocuments = documentsSince(deps, decision.ticker, decidedAt);
    for (const doc of newDocuments.filter((d) => d.tier === "filing" || d.tier === "official")) {
      signals.push({
        kind: "new_filing",
        severity: "info",
        label: doc.tier === "official" ? "Official update" : "Company filing",
        detail: `${doc.publisher} published "${doc.title}" on ${doc.publishedAt}.`,
        sourceIds: [doc.id],
      });
    }

    // Valuation relative to real peers.
    const pe = stock?.metrics.find((m) => m.key === "pe");
    if (pe?.value != null && pe.sectorMedian != null && pe.sectorMedian > 0) {
      const gap = (pe.value - pe.sectorMedian) / pe.sectorMedian;
      if (Math.abs(gap) >= 0.2) {
        signals.push({
          kind: "valuation_shift",
          severity: gap > 0.3 ? "attention" : "info",
          label: gap > 0 ? "Priced above peers" : "Priced below peers",
          detail:
            `Its P/E of ${pe.value} sits ${pct(gap)} against the ${stock!.sector} ` +
            `sector median of ${pe.sectorMedian}.`,
          sourceIds: pe.sourceIds,
        });
      }
    }

    // Position size and unrealised P/L.
    const held = ctx.portfolio.positions.find((p) => p.ticker === decision.ticker);
    let position: ChangeItem["position"] = null;

    if (held && held.currentValue !== null) {
      const profitLoss = held.currentValue - held.investedValue;
      position = {
        quantity: held.quantity,
        investedValue: held.investedValue,
        currentValue: held.currentValue,
        profitLoss,
        profitLossPct: held.investedValue > 0 ? profitLoss / held.investedValue : 0,
        weight: held.weight,
      };

      if (held.weight >= CONCENTRATION_WARNING) {
        signals.push({
          kind: "concentration",
          severity: held.weight >= 0.5 ? "warning" : "attention",
          label: "Large share of your portfolio",
          detail:
            `${decision.ticker} is ${Math.round(held.weight * 100)}% of what you have ` +
            `invested — ${inr(held.investedValue)} of ${inr(ctx.portfolio.totalInvested)}.`,
          sourceIds: [],
        });
      }
    }

    const hasNewFilings = newDocuments.some((d) => d.tier === "filing" || d.tier === "official");
    const thesisStatus = gradeThesis(decision, priceChange, daysAgo, hasNewFilings);

    if (thesisStatus === "weakening" || thesisStatus === "broken") {
      signals.push({
        kind: "thesis_untested",
        severity: thesisStatus === "broken" ? "warning" : "attention",
        label: "Your reasoning",
        detail:
          decision.thesis
            ? `You said: "${decision.thesis}". ${STATUS_FALLBACK[thesisStatus]}`
            : STATUS_FALLBACK[thesisStatus],
        sourceIds: [],
      });
    }

    items.push({
      ticker: decision.ticker,
      companyName: decision.companyName,
      decision: {
        id: decision.id,
        action: decision.action,
        thesis: decision.thesis,
        reasoning: decision.reasoning,
        decidedAt: decision.decidedAt,
        daysAgo,
        quantity: decision.quantity,
        pricePerShare: decision.pricePerShare,
      },
      price,
      position,
      newDocuments,
      signals,
      thesisStatus,
      headline: STATUS_FALLBACK[thesisStatus],
      nextChecks: buildNextChecks(decision, thesisStatus, stock?.sector ?? null),
    });
  }

  // Most worth attention first: warnings, then attention, then recency.
  const weight = (i: ChangeItem) =>
    i.signals.some((s) => s.severity === "warning")
      ? 0
      : i.signals.some((s) => s.severity === "attention")
        ? 1
        : 2;
  items.sort((a, b) => weight(a) - weight(b) || a.decision.daysAgo - b.decision.daysAgo);

  if (deps.llm) await addHeadlines(deps, ctx, items);

  const held = ctx.portfolio.positions.filter((p) => p.currentValue !== null);
  const invested = held.reduce((sum, p) => sum + p.investedValue, 0);
  const current = held.reduce((sum, p) => sum + (p.currentValue ?? 0), 0);

  return {
    generatedAt: new Date().toISOString(),
    items,
    summary: {
      reviewed: items.length,
      needsAttention: items.filter((i) => i.signals.some((s) => s.severity !== "info")).length,
      portfolioProfitLoss: held.length ? current - invested : null,
      portfolioProfitLossPct: held.length && invested > 0 ? (current - invested) / invested : null,
    },
    disclaimer: CHANGES_DISCLAIMER,
  };
}

/** Specific things to go and verify. Teaches research; never concludes. */
function buildNextChecks(
  decision: Decision,
  status: ThesisStatus,
  sector: string | null,
): string[] {
  const checks: string[] = [];

  if (status === "broken" || status === "weakening") {
    checks.push(
      "What would have to be true for your original reason to still hold? Can you find evidence of it?",
    );
  }
  if (decision.action === "bought") {
    checks.push(
      "Has anything about the business changed, or only the price? They are different questions.",
    );
  }
  if (sector) {
    checks.push(`How have other ${sector} companies moved over the same period?`);
  }
  checks.push("If you were deciding today, with what you now know, would you decide the same way?");

  return checks.slice(0, 3);
}

/** One plain sentence per item, at the user's level. Phrasing only. */
async function addHeadlines(deps: ChangesDeps, ctx: UserContext, items: ChangeItem[]) {
  if (!deps.llm) return;

  await Promise.all(
    items.map(async (item) => {
      const facts = item.signals.map((s) => `- ${s.detail}`).join("\n") || "- Nothing has changed.";
      try {
        const text = await deps.llm!.chat({
          messages: [
            {
              role: "user",
              content:
                `A beginner investor ${item.decision.action} ${item.ticker} ` +
                `${item.decision.daysAgo} days ago.\n` +
                (item.decision.thesis ? `Their stated reason: "${item.decision.thesis}"\n` : "") +
                `\nWhat has happened since:\n${facts}\n\n` +
                `Write ONE sentence, at most 25 words, telling them whether their REASONING ` +
                `still holds.\n\n` +
                `HARD RULES:\n` +
                `- Use ONLY the facts listed above. State nothing else as true.\n` +
                `- If the list does not say whether the thing they assumed happened, say it is ` +
                `unverified. Never claim something "has not changed" — an absence of news is ` +
                `not evidence, and inventing one is the worst thing you can do here.\n` +
                `- Plain English, no markdown, do not restate the numbers.\n` +
                `- Never say buy, sell or hold. Never rate the company, and never call a ` +
                `decision lucky or smart. You are grading their reasoning, not the outcome.`,
            },
          ],
          model: deps.model,
          maxTokens: 160,
          temperature: 0.3,
        });

        const clean = text
          .replace(/[*_`#>]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (clean && clean.length < 300) item.headline = clean;
      } catch {
        // Keep the computed fallback — it is accurate, just less personal.
      }
    }),
  );

  void ctx;
}
