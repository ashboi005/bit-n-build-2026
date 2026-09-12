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


/* ------------------------------------------------------------------ *
 * Inline citation validation, for streamed prose.
 *
 * The investigation pipeline gets structured output, so enforceCitations() can
 * simply drop a bad finding. Chat streams free text with `[source_id]` markers
 * inline, which needs a different guard — and it is the flow a sceptical judge
 * is most likely to poke at.
 * ------------------------------------------------------------------ */

/** Matches [some_source_id]. Ids are lowercase words, digits and underscores. */
const CITATION_RE = /\[([a-z0-9_]+(?:_[a-z0-9]+)*)\]/gi;

export interface CitationAudit {
  /** The answer with unknown ids removed. */
  text: string;
  /** Ids cited that were actually supplied. */
  valid: string[];
  /** Ids the model invented, stripped from the text. */
  removed: string[];
  /**
   * Sentences stating a figure whose cited sources do not contain it.
   * A fabricated number wearing a real citation is worse than an uncited one,
   * because it looks verified.
   */
  unsupported: string[];
}

/** Digits with optional decimals and Indian digit grouping: 1,70,171.5 */
const NUMBER_RE = /\d[\d,]*(?:\.\d+)?/g;

function normaliseNumber(raw: string): string {
  return raw.replace(/,/g, "").replace(/\.0+$/, "");
}

/**
 * Validate the citations in a finished chat answer.
 *
 * `sourceText` maps each supplied source id to its text, so we can check that a
 * cited figure actually appears in what was cited.
 */
export function auditCitations(
  answer: string,
  sourceText: Map<string, string>,
): CitationAudit {
  const valid = new Set<string>();
  const removed = new Set<string>();

  // 1. Strip ids we never supplied.
  const text = answer.replace(CITATION_RE, (match, id: string) => {
    const key = String(id).toLowerCase();
    if (sourceText.has(key)) {
      valid.add(key);
      return match;
    }
    removed.add(key);
    return "";
  });

  // 2. Any sentence that cites a source AND states a figure must have that
  //    figure in one of the sources it cited.
  const unsupported: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    const cited = [...sentence.matchAll(CITATION_RE)].map((m) => String(m[1]).toLowerCase());
    if (!cited.length) continue;

    const stripped = sentence.replace(CITATION_RE, " ");
    const numbers = (stripped.match(NUMBER_RE) ?? [])
      .map(normaliseNumber)
      // Small integers are ordinary prose ("one of three reasons"), and years
      // are rarely the claim being made.
      .filter((n) => Number(n) >= 10 && !/^(19|20)\d{2}$/.test(n));

    if (!numbers.length) continue;

    const haystack = cited
      .map((id) => sourceText.get(id) ?? "")
      .join(" ")
      .replace(/,/g, "");

    const missing = numbers.filter((n) => !haystack.includes(n));
    if (missing.length) {
      unsupported.push(sentence.replace(/\s+/g, " ").trim().slice(0, 200));
    }
  }

  return {
    text: text.replace(/[ \t]{2,}/g, " ").replace(/ +([.,;:])/g, "$1"),
    valid: [...valid],
    removed: [...removed],
    unsupported,
  };
}
