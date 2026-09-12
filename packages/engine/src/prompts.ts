import { GROUND_RULES } from "@bit-n-build-2026/llm";
import type { Level, ParsedClaim, SourceRef } from "@bit-n-build-2026/contracts";
import type { UserProfile } from "@bit-n-build-2026/contracts";

/** How much explanation each level wants. Drives the Time Machine demo. */
const LEVEL_GUIDANCE: Record<Level, string> = {
  new: "The user has never bought a share. Expand every term the first time it appears, and say why it matters. 2-3 sentences per idea.",
  learning:
    "The user knows the basic terms but not how to apply them. Skip definitions, focus on what the number means for THIS company. 1-2 sentences.",
  practicing:
    "The user can read a stock page. Be direct and comparative. One sentence. No definitions.",
  independent:
    "The user researches on their own. Terse. Numbers and the comparison only. No explanation unless something is genuinely non-obvious.",
};

export function profileBlock(profile: UserProfile): string {
  const known = profile.knownConcepts.length
    ? profile.knownConcepts.join(", ")
    : "nothing yet";

  const holdings = profile.holdings.length
    ? profile.holdings
        .map((h) => `${h.ticker} (${Math.round(h.weight * 100)}% of portfolio)`)
        .join(", ")
    : "none";

  const past = profile.pastTheses.length
    ? profile.pastTheses
        .map((t) => `- ${t.at}: "${t.query}" -> ${t.outcome}. Lesson: ${t.lesson}`)
        .join("\n")
    : "- none yet";

  return `
ABOUT THIS USER (day ${profile.dayIndex} of using this product)
Level: ${profile.level}. ${LEVEL_GUIDANCE[profile.level]}
Concepts already explained to them: ${known}
Current holdings: ${holdings}
Their past reasoning:
${past}

Use this. If they already know a term, do not re-explain it. If a past thesis of
theirs is relevant to this one, reference it directly — you are the only thing
that remembers what they got right and wrong.`.trim();
}

export function sourcesBlock(sources: SourceRef[]): string {
  if (!sources.length) return "SOURCES: none retrieved.";
  return [
    "SOURCES — cite these by id. Do not cite anything not in this list.",
    ...sources.map(
      (s) =>
        `[${s.id}] (${s.tier}) ${s.publisher}, ${s.publishedAt ?? "undated"} — ${s.title}\n    "${s.snippet}"`,
    ),
  ].join("\n");
}

export const PARSE_SYSTEM = `${GROUND_RULES}

You break a beginner investor's sentence into the reasoning it contains.

They will say something like "defence spending is up so I should buy HAL". Your job
is to separate:
- the TRIGGER: the event they believe happened
- the ASSET: the company they are considering
- the MECHANISM: the causal step they are assuming, even if they did not say it out loud
- the HORIZON: how long they intend to hold, if stated

Return nulls for anything genuinely absent. Do not guess a ticker you are not
confident about. Infer the mechanism even when unstated — making the hidden
assumption visible is the point of this step.`;

export function verifyTriggerPrompt(claim: ParsedClaim, sources: SourceRef[]): string {
  return `${sourcesBlock(sources)}

THE USER'S TRIGGER: "${claim.trigger?.text ?? claim.raw}"

Did this actually happen? Answer only from the sources above.
- If an official source confirms it, that is a strong "supports" finding.
- If no source confirms it, that is an "unverified" finding, and say so plainly.
- If a source contradicts it, say that.

Return at most 2 findings.`;
}

export function linkExposurePrompt(claim: ParsedClaim, sources: SourceRef[]): string {
  return `${sourcesBlock(sources)}

THE USER'S ASSUMED MECHANISM: "${claim.mechanism ?? "not stated"}"
COMPANY: ${claim.asset?.name ?? "unknown"} (${claim.asset?.ticker ?? "?"})

Does the trigger actually reach this company's earnings? Test the mechanism, not
the vibe. Consider specifically:
- Is the company genuinely exposed to this? Cite the evidence.
- Does the step from "sector benefits" to "this company benefits" actually hold?
  A bigger budget is not the same as bigger orders for one firm.

Return at most 3 findings.`;
}

export function challengePrompt(claim: ParsedClaim, sources: SourceRef[], metricsSummary: string): string {
  return `${sourcesBlock(sources)}

THE USER'S REASONING: "${claim.raw}"
THE NUMBERS: ${metricsSummary}

This is the most important step. Actively look for reasons the user's reasoning is
WRONG. Consider:
- Is this already priced in? Public news usually is.
- Does the valuation already assume this good news?
- Do competitors benefit equally or more?
- Is there a gap between the announcement and actual revenue?

Every finding here should have stance "contradicts" or "neutral". If you genuinely
cannot find a challenge in the sources, return an empty list rather than inventing
a weak one.

Return at most 3 findings.`;
}

export function verdictPrompt(claim: ParsedClaim, findingsSummary: string): string {
  return `THE USER'S REASONING: "${claim.raw}"

WHAT THE INVESTIGATION FOUND:
${findingsSummary}

Summarise where their reasoning stands. You are grading the REASONING, not the stock.

- holdsOn: the parts the evidence actually supports
- weakOn: the parts the evidence undermines
- unverified: what we could not check
- nextChecks: specific, actionable questions they should go and answer themselves.
  These should teach them how to research, not what to conclude.

Never say buy, sell, hold or avoid. Never give a score or a probability.`;
}

export function explainMetricPrompt(
  label: string,
  display: string,
  sectorMedian: number | null,
  level: Level,
): string {
  const comparison =
    sectorMedian === null ? "No sector median available." : `Sector median: ${sectorMedian}.`;
  return `Explain this one number to the user.

${label}: ${display}. ${comparison}

${LEVEL_GUIDANCE[level]}

Return only the explanation text. No preamble, no "this means that".`;
}
