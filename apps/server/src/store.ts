/**
 * Everything that reads or writes user state.
 *
 * Kept in one file so the shape of "what we know about a user" is visible in
 * one place — that's the product's core asset, not an incidental detail.
 */

import {
  type Decision,
  type DecisionAction,
  type OnboardingAnswers,
  type OnboardingState,
  type Portfolio,
  type PortfolioPosition,
  type RecordDecisionRequest,
  type UserProfile,
  deriveLevel,
} from "@bit-n-build-2026/contracts";
import { chatMessage, userDecision, userProfile } from "@bit-n-build-2026/db/schema";
import type { UserContext } from "@bit-n-build-2026/engine";
import { and, asc, desc, eq } from "drizzle-orm";

import { getDb, sources } from "./services";

const db = () => getDb();
const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/* ----------------------------------------------------------------- profile */

function rowToProfile(row: typeof userProfile.$inferSelect): UserProfile {
  return {
    level: row.level as UserProfile["level"],
    knownConcepts: row.knownConcepts,
    holdings: row.holdings as UserProfile["holdings"],
    pastTheses: row.pastTheses as UserProfile["pastTheses"],
    startedAt: row.startedAt,
    dayIndex: row.dayIndex,
  };
}

async function ensureRow(userId: string): Promise<typeof userProfile.$inferSelect> {
  const [existing] = await db().select().from(userProfile).where(eq(userProfile.userId, userId));
  if (existing) return existing;

  // A brand new user starts blank: no level assumptions, no holdings, no
  // history. Onboarding fills in who they are; the Time Machine can overwrite
  // all of it with a scripted persona.
  const [created] = await db()
    .insert(userProfile)
    .values({
      userId,
      level: "new",
      knownConcepts: [],
      holdings: [],
      pastTheses: [],
      startedAt: new Date().toISOString().slice(0, 10),
      dayIndex: 0,
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;
  const [row] = await db().select().from(userProfile).where(eq(userProfile.userId, userId));
  return row!;
}

export async function getProfile(userId: string): Promise<UserProfile> {
  return rowToProfile(await ensureRow(userId));
}

export async function learnConcepts(userId: string, keys: string[]): Promise<void> {
  if (!keys.length) return;
  const row = await ensureRow(userId);
  const known = new Set(row.knownConcepts);
  for (const key of keys) known.add(key);
  await db()
    .update(userProfile)
    .set({ knownConcepts: [...known] })
    .where(eq(userProfile.userId, userId));
}

/* -------------------------------------------------------------- onboarding */

export async function getOnboarding(userId: string): Promise<OnboardingState> {
  const row = await ensureRow(userId);
  const answers: OnboardingAnswers = {
    ageBand: row.ageBand as OnboardingAnswers["ageBand"],
    primaryGoal: row.primaryGoal as OnboardingAnswers["primaryGoal"],
    riskComfort: row.riskComfort as OnboardingAnswers["riskComfort"],
    experience: row.experience as OnboardingAnswers["experience"],
    monthlyBudget: row.monthlyBudget,
    horizon: row.horizon as OnboardingAnswers["horizon"],
    notes: row.notes,
  };
  return {
    ...answers,
    complete: row.onboardedAt !== null,
    onboardedAt: row.onboardedAt?.toISOString() ?? null,
    derivedLevel: deriveLevel(answers),
  };
}

export async function saveOnboarding(
  userId: string,
  answers: OnboardingAnswers,
): Promise<OnboardingState> {
  await ensureRow(userId);
  const level = deriveLevel(answers);

  await db()
    .update(userProfile)
    .set({
      ageBand: answers.ageBand,
      primaryGoal: answers.primaryGoal,
      riskComfort: answers.riskComfort,
      experience: answers.experience,
      monthlyBudget: answers.monthlyBudget,
      horizon: answers.horizon,
      notes: answers.notes,
      onboardedAt: new Date(),
      // Onboarding sets the STARTING level. Concepts they learn move them up
      // from here; we never move them back down.
      level,
    })
    .where(eq(userProfile.userId, userId));

  return getOnboarding(userId);
}

/* --------------------------------------------------------------- decisions */

function rowToDecision(row: typeof userDecision.$inferSelect): Decision {
  return {
    id: row.id,
    ticker: row.ticker,
    companyName: row.companyName,
    action: row.action as DecisionAction,
    quantity: row.quantity,
    pricePerShare: row.pricePerShare,
    thesis: row.thesis,
    investigationSummary: row.investigationSummary,
    reasoning: row.reasoning,
    outcome: row.outcome as Decision["outcome"],
    outcomeNote: row.outcomeNote,
    decidedAt: row.decidedAt.toISOString(),
  };
}

export async function listDecisions(userId: string): Promise<Decision[]> {
  const rows = await db()
    .select()
    .from(userDecision)
    .where(eq(userDecision.userId, userId))
    .orderBy(desc(userDecision.decidedAt));
  return rows.map(rowToDecision);
}

export async function recordDecision(
  userId: string,
  input: RecordDecisionRequest,
): Promise<Decision> {
  const ticker = input.ticker.toUpperCase();
  const stock = sources.getStock(ticker);

  const [row] = await db()
    .insert(userDecision)
    .values({
      id: newId("dec"),
      userId,
      ticker,
      companyName: stock?.name ?? ticker,
      action: input.action,
      quantity: input.quantity ?? null,
      pricePerShare: input.pricePerShare ?? null,
      thesis: input.thesis ?? null,
      investigationSummary: input.investigationSummary ?? null,
      reasoning: input.reasoning ?? null,
    })
    .returning();

  return rowToDecision(row!);
}

/**
 * Portfolio derived from decisions. We never ask the user to maintain the same
 * information twice — what they told us they did IS the portfolio.
 */
export async function getPortfolio(userId: string): Promise<Portfolio> {
  const decisions = await listDecisions(userId);

  const held = new Map<string, { name: string; qty: number; cost: number }>();
  for (const d of [...decisions].reverse()) {
    if (d.action === "bought" && d.quantity) {
      const entry = held.get(d.ticker) ?? { name: d.companyName, qty: 0, cost: 0 };
      entry.qty += d.quantity;
      entry.cost += d.quantity * (d.pricePerShare ?? 0);
      held.set(d.ticker, entry);
    }
    if (d.action === "sold" && d.quantity) {
      const entry = held.get(d.ticker);
      if (entry) {
        const sold = Math.min(entry.qty, d.quantity);
        // Reduce cost proportionally so avgPrice stays meaningful.
        entry.cost -= entry.qty > 0 ? (entry.cost / entry.qty) * sold : 0;
        entry.qty -= sold;
        if (entry.qty <= 0) held.delete(d.ticker);
      }
    }
  }

  const positions: PortfolioPosition[] = [];
  let totalInvested = 0;
  let totalCurrent = 0;
  let havePrices = true;

  for (const [ticker, entry] of held) {
    const stock = sources.getStock(ticker);
    const last = stock?.price?.last ?? null;
    if (last === null) havePrices = false;

    const investedValue = entry.cost;
    totalInvested += investedValue;
    if (last !== null) totalCurrent += entry.qty * last;

    positions.push({
      ticker,
      companyName: entry.name,
      quantity: entry.qty,
      avgPrice: entry.qty > 0 ? entry.cost / entry.qty : 0,
      investedValue,
      currentValue: last === null ? null : entry.qty * last,
      weight: 0,
    });
  }

  for (const p of positions) {
    p.weight = totalInvested > 0 ? p.investedValue / totalInvested : 0;
  }
  positions.sort((a, b) => b.weight - a.weight);

  const seenSkip = new Set<string>();
  const skipped = decisions
    .filter((d) => d.action === "skipped" && !held.has(d.ticker))
    .filter((d) => (seenSkip.has(d.ticker) ? false : (seenSkip.add(d.ticker), true)))
    .map((d) => ({ ticker: d.ticker, companyName: d.companyName, reasoning: d.reasoning }));

  const seenWatch = new Set<string>();
  const watching = decisions
    .filter((d) => d.action === "watching" && !held.has(d.ticker))
    .filter((d) => (seenWatch.has(d.ticker) ? false : (seenWatch.add(d.ticker), true)))
    .map((d) => ({ ticker: d.ticker, companyName: d.companyName }));

  return {
    positions,
    totalInvested,
    totalCurrent: havePrices && positions.length ? totalCurrent : null,
    skipped,
    watching,
  };
}

/** Everything the prompts need about a user, in one call. */
export async function getUserContext(userId: string): Promise<UserContext> {
  const [profile, onboarding, portfolio, decisions] = await Promise.all([
    getProfile(userId),
    getOnboarding(userId),
    getPortfolio(userId),
    listDecisions(userId),
  ]);
  return { profile, onboarding, portfolio, decisions };
}

/* -------------------------------------------------------------------- chat */

export async function listMessages(userId: string, threadId: string, limit = 20) {
  const rows = await db()
    .select()
    .from(chatMessage)
    .where(and(eq(chatMessage.userId, userId), eq(chatMessage.threadId, threadId)))
    .orderBy(asc(chatMessage.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    threadId: r.threadId,
    role: r.role as "user" | "assistant",
    content: r.content,
    sourceIds: r.sourceIds,
    conceptKeys: r.conceptKeys,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function saveMessage(args: {
  userId: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  sourceIds?: string[];
}): Promise<string> {
  const id = newId("msg");
  await db().insert(chatMessage).values({
    id,
    userId: args.userId,
    threadId: args.threadId,
    role: args.role,
    content: args.content,
    sourceIds: args.sourceIds ?? [],
  });
  return id;
}

export { newId };
