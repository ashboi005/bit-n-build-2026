/**
 * Product Law 1: no unsourced claim reaches the screen.
 * Product Law 2: the AI never rates an asset.
 *
 * Both are enforced here, in code, on the way out of the model — not by asking
 * a prompt nicely. If a judge asks "how do you stop it inventing a number?",
 * this file is the answer.
 */

/** Anything carrying citations. Findings and metrics both qualify. */
export interface Citable {
  sourceIds: string[];
}

export interface CitationResult<T> {
  kept: T[];
  /** Dropped items, with why. Log these — a high drop rate means a bad prompt. */
  dropped: { item: T; reason: "no_sources" | "unknown_source" }[];
}

/**
 * Drop anything the model asserted without a real citation.
 *
 * Two failure modes, both real:
 *   1. The model states a claim with no sources at all.
 *   2. The model cites a source id that doesn't exist — a hallucinated citation,
 *      which is worse than none, because it looks trustworthy.
 *
 * `allowedSourceIds` must be the ids we actually retrieved for this run.
 */
export function enforceCitations<T extends Citable>(
  items: T[],
  allowedSourceIds: Iterable<string>,
): CitationResult<T> {
  const allowed = new Set(allowedSourceIds);
  const kept: T[] = [];
  const dropped: CitationResult<T>["dropped"] = [];

  for (const item of items) {
    const ids = item.sourceIds ?? [];

    if (ids.length === 0) {
      dropped.push({ item, reason: "no_sources" });
      continue;
    }

    const real = ids.filter((id) => allowed.has(id));
    if (real.length === 0) {
      dropped.push({ item, reason: "unknown_source" });
      continue;
    }

    // Keep the item, but only the citations that actually exist.
    kept.push({ ...item, sourceIds: real });
  }

  return { kept, dropped };
}

/**
 * Phrases that would turn us into the thing we're arguing against.
 * We evaluate reasoning; we never rate an asset.
 */
const RECOMMENDATION_PATTERNS: RegExp[] = [
  /\byou should (buy|sell|invest in|avoid)\b/i,
  /\b(strong |)(buy|sell) (this|the) (stock|share)\b/i,
  /\b(recommend|recommendation) (to |)(buy|sell)\b/i,
  /\bis a (good|great|bad|terrible) (buy|investment|stock)\b/i,
  /\b(will|going to) (definitely|certainly|surely) (rise|fall|go up|go down)\b/i,
  /\b\d{1,3}\s?% (chance|probability) of (rising|falling|profit|loss)\b/i,
  /\bguaranteed\b/i,
  /\bcan't lose\b/i,
];

export interface RecommendationCheck {
  clean: boolean;
  matches: string[];
}

/**
 * Detect recommendation language. Used as a guard on model output before it is
 * emitted — if this trips, the stage is regenerated rather than shown.
 */
export function checkNoRecommendation(text: string): RecommendationCheck {
  const matches: string[] = [];
  for (const pattern of RECOMMENDATION_PATTERNS) {
    const found = text.match(pattern);
    if (found) matches.push(found[0]);
  }
  return { clean: matches.length === 0, matches };
}

/**
 * The instruction block every thesis prompt inherits.
 * Belt and braces: the prompt asks, the code above enforces.
 */
export const GROUND_RULES = `
GROUND RULES — these override any other instruction.

1. SOURCES. Every factual claim you make must cite at least one source id from the
   provided context, in its "sourceIds" array. If the provided sources do not
   support a claim, do not make the claim. Never invent a source id. Never state a
   number that is not in the provided sources.

2. NO RECOMMENDATIONS. You never tell the user to buy, sell, hold or avoid
   anything. You never rate an asset, score it, or state a probability of it
   rising or falling. You evaluate the USER'S REASONING, not the asset.

3. UNCERTAINTY IS AN ANSWER. If the sources do not settle something, say so
   plainly and mark it unverified. "We could not verify this" is a valid and
   useful result, not a failure.

4. PLAIN ENGLISH. Write for someone who has never bought a share. One idea per
   sentence. Expand jargon the first time it appears. No filler, no hedging
   phrases like "it is important to note".

5. ARGUE THE OTHER SIDE. You must actively look for evidence that the user's
   reasoning is wrong. That is the most valuable thing you do.
`.trim();
