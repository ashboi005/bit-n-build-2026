/**
 * Builds the "what we know about this user" block that every prompt inherits.
 *
 * This is the product's actual differentiator in one function. A friend giving
 * advice knows none of this; a trainer forgets it; a generic chatbot never had
 * it. Everything here came from the user's own answers and their own decisions.
 */

import type {
  Decision,
  OnboardingState,
  Portfolio,
  UserProfile,
} from "@bit-n-build-2026/contracts";
import { ONBOARDING_LABELS } from "@bit-n-build-2026/contracts";

export interface UserContext {
  profile: UserProfile;
  onboarding: OnboardingState;
  portfolio: Portfolio;
  decisions: Decision[];
}

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Who they are — from onboarding. */
export function onboardingBlock(o: OnboardingState): string {
  if (!o.complete) return "ABOUT THIS USER: they have not completed onboarding yet.";

  const lines: string[] = ["ABOUT THIS USER (their own answers when they signed up)"];
  if (o.ageBand) lines.push(`- Age: ${o.ageBand}`);
  if (o.experience) lines.push(`- Experience: ${ONBOARDING_LABELS.experience[o.experience]}`);
  if (o.primaryGoal) lines.push(`- What they want: ${ONBOARDING_LABELS.primaryGoal[o.primaryGoal]}`);
  if (o.horizon) lines.push(`- When they may need the money: ${ONBOARDING_LABELS.horizon[o.horizon]}`);
  if (o.riskComfort) {
    lines.push(`- If their investment dropped 20%: "${ONBOARDING_LABELS.riskComfort[o.riskComfort]}"`);
  }
  if (o.monthlyBudget) {
    lines.push(`- Roughly ${rupees(o.monthlyBudget)} a month available to invest`);
  }
  if (o.notes) lines.push(`- In their words: "${o.notes}"`);

  lines.push("");
  lines.push(
    "Use this. If their stated horizon contradicts what they are asking about, say so — " +
      "someone who may need the money within a year is in a different position from someone " +
      "who won't touch it for five. If they told you they would panic-sell in a drop, a " +
      "volatile company is a bigger deal for them than the number alone suggests.",
  );
  return lines.join("\n");
}

/** What they hold — derived entirely from decisions they recorded. */
export function portfolioBlock(portfolio: Portfolio): string {
  const lines: string[] = ["THEIR PORTFOLIO (from decisions they recorded here)"];

  if (!portfolio.positions.length) {
    lines.push("- They hold nothing yet.");
  } else {
    for (const p of portfolio.positions) {
      lines.push(
        `- ${p.ticker} (${p.companyName}): ${p.quantity} shares at avg ${rupees(p.avgPrice)}, ` +
          `${rupees(p.investedValue)} invested — ${Math.round(p.weight * 100)}% of their portfolio`,
      );
    }
    lines.push(`- Total invested: ${rupees(portfolio.totalInvested)}`);
  }

  if (portfolio.skipped.length) {
    lines.push("");
    lines.push("They investigated these and chose NOT to buy:");
    for (const s of portfolio.skipped) {
      lines.push(`- ${s.ticker}${s.reasoning ? `: "${s.reasoning}"` : ""}`);
    }
  }
  if (portfolio.watching.length) {
    lines.push(`Watching: ${portfolio.watching.map((w) => w.ticker).join(", ")}`);
  }

  lines.push("");
  lines.push(
    "Concentration matters more than any single metric. If they are about to add to " +
      "something that is already a large share of their portfolio, that is worth saying " +
      "out loud, plainly, before anything else.",
  );
  return lines.join("\n");
}

/** What they decided before, and how it turned out. The memory nobody else has. */
export function historyBlock(decisions: Decision[], profile: UserProfile): string {
  const lines: string[] = ["THEIR HISTORY"];

  const past = [
    ...profile.pastTheses.map((t) => ({
      at: t.at,
      text: `"${t.query}" -> ${t.outcome}. ${t.lesson}`,
    })),
    ...decisions.map((d) => ({
      at: d.decidedAt.slice(0, 10),
      text:
        `${d.action.toUpperCase()} ${d.ticker}` +
        (d.quantity ? ` (${d.quantity} shares)` : "") +
        (d.thesis ? ` — thesis: "${d.thesis}"` : "") +
        (d.reasoning ? ` — their reasoning: "${d.reasoning}"` : "") +
        (d.outcome !== "unresolved" ? ` — outcome: ${d.outcome}.` : ""),
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  if (!past.length) {
    lines.push("- Nothing yet. This may be their first decision.");
  } else {
    for (const p of past) lines.push(`- ${p.at}: ${p.text}`);
    lines.push("");
    lines.push(
      "If any of this is relevant to what they are asking now, reference it directly and " +
        "specifically. Being able to say 'this is the same reasoning that broke for you in " +
        "September' is the single most useful thing you can do — no friend, trainer or " +
        "generic assistant remembers their history.",
    );
  }
  return lines.join("\n");
}

export function knownConceptsBlock(profile: UserProfile): string {
  const known = profile.knownConcepts.length ? profile.knownConcepts.join(", ") : "nothing yet";
  return (
    `CONCEPTS ALREADY EXPLAINED TO THEM: ${known}\n` +
    `Do not re-explain these. Use them as shared vocabulary. Explain anything else the ` +
    `first time it comes up.`
  );
}

/** Everything, assembled. Used by chat and the verdict stage. */
export function fullContextBlock(ctx: UserContext): string {
  return [
    onboardingBlock(ctx.onboarding),
    "",
    portfolioBlock(ctx.portfolio),
    "",
    historyBlock(ctx.decisions, ctx.profile),
    "",
    knownConceptsBlock(ctx.profile),
  ].join("\n");
}
