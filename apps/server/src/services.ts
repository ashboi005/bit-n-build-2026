import { createAuth as createConfiguredAuth } from "@bit-n-build-2026/auth";
import { type Database, createDb } from "@bit-n-build-2026/db";
import type { DemoStage, UserProfile } from "@bit-n-build-2026/contracts";
import type { ProfilePort } from "@bit-n-build-2026/engine";
import { createLlm } from "@bit-n-build-2026/llm";
import { createRetriever, createStore, type Retriever } from "@bit-n-build-2026/rag";
import { sources } from "@bit-n-build-2026/sources";
import { chatMessage, userDecision } from "@bit-n-build-2026/db/schema/activity";
import { userProfile } from "@bit-n-build-2026/db/schema/profile";
import { eq } from "drizzle-orm";

import { DEMO_PERSONAS, type PersonaDecision } from "./demo-personas";
import { env } from "./env.server";

const db = createDb(env);

export function getDb(): Database {
  return db;
}

export const auth = createConfiguredAuth(env, db);
export const llm = createLlm(env);
export const fastModel = env.MERGE_MODEL_FAST;
export { sources };

/* ------------------------------------------------------------------ RAG */

let retrieverPromise: Promise<Retriever> | null = null;

/**
 * Built lazily and once. Indexing embeds every source chunk, which costs a few
 * seconds and a few API calls — doing it at import time would make the server
 * slow to boot and would run again on every hot reload.
 */
export function getRetriever(): Promise<Retriever> {
  retrieverPromise ??= (async () => {
    const store = await createStore({
      qdrantUrl: env.QDRANT_URL || undefined,
      qdrantApiKey: env.QDRANT_API_KEY || undefined,
    });
    const retriever = createRetriever(llm, store);

    if (await retriever.isEmpty()) {
      // Everything we hold. Tushar shipped listDocuments() so a document that
      // no stock happens to link to is still retrievable.
      const docs = sources.listDocuments();

      try {
        const count = await retriever.indexDocuments(docs);
        console.log(`[rag] indexed ${count} chunks from ${docs.length} documents`);
      } catch (error) {
        console.warn(
          "[rag] indexing failed — falling back to keyword search:",
          error instanceof Error ? error.message : error,
        );
      }
    }
    return retriever;
  })();
  return retrieverPromise;
}

/* -------------------------------------------------------------- profiles */

export async function getProfile(userId: string): Promise<UserProfile> {
  const { getProfile: read } = await import("./store");
  return read(userId);
}

/**
 * The Time Machine.
 *
 * Rewrites everything we know about this user to match a scripted persona:
 * profile, onboarding answers, decisions, and their vector memories. Chat
 * history is cleared too, so the next conversation starts clean.
 *
 * It writes through the SAME tables the product uses normally — there is no
 * demo-only code path. What it does NOT touch is the investigation itself:
 * every stage still runs live against real sources and real models.
 *
 * Day 0 is therefore a full reset: no holdings, no history, knows nothing.
 */
export async function seedProfile(userId: string, stage: DemoStage): Promise<UserProfile> {
  const persona = DEMO_PERSONAS[stage];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const startedAt = new Date(now - persona.dayIndex * dayMs).toISOString().slice(0, 10);

  // Wipe prior state first — reseeding must not leave the previous persona's
  // decisions or conversation behind.
  await db.delete(userDecision).where(eq(userDecision.userId, userId));
  await db.delete(chatMessage).where(eq(chatMessage.userId, userId));

  /**
   * Resolve each persona's price offset against the CURRENT snapshot price, so
   * the story ("BEL is down, Infosys is up") holds whatever the real numbers are.
   */
  const priceFor = (d: PersonaDecision): number | null => {
    if (d.priceOffsetPct === null) return null;
    const last = sources.getStock(d.ticker)?.price?.last;
    if (!last) return null;
    return Math.round(last * (1 + d.priceOffsetPct) * 100) / 100;
  };

  // Insert this persona's decisions, dated relative to today.
  const rows = persona.decisions.map((d, i) => ({
    id: `seed_${stage}_${i}_${userId.slice(0, 8)}`,
    userId,
    ticker: d.ticker,
    companyName: d.companyName,
    action: d.action,
    quantity: d.quantity,
    pricePerShare: priceFor(d),
    thesis: d.thesis,
    investigationSummary: null,
    reasoning: d.reasoning,
    outcome: d.outcome,
    outcomeNote: d.outcomeNote,
    decidedAt: new Date(now - d.daysAgo * dayMs),
  }));
  if (rows.length) await db.insert(userDecision).values(rows);

  // Past theses carry "day-N" placeholders so the script stays readable;
  // resolve them to real dates now.
  const pastTheses = persona.pastTheses.map((t) => ({
    ...t,
    at: t.at.startsWith("day-")
      ? new Date(now - Number(t.at.slice(4)) * dayMs).toISOString().slice(0, 10)
      : t.at,
  }));

  /**
   * Holdings are derived from the decisions above, never listed separately —
   * a persona whose profile disagrees with its own portfolio is worse than no
   * persona at all.
   */
  const holdings = buildHoldings(persona.decisions, priceFor);

  const profileRow = {
    userId,
    level: persona.level,
    knownConcepts: persona.knownConcepts,
    holdings,
    pastTheses,
    startedAt,
    dayIndex: persona.dayIndex,
    ageBand: persona.onboarding.ageBand,
    primaryGoal: persona.onboarding.primaryGoal,
    riskComfort: persona.onboarding.riskComfort,
    experience: persona.onboarding.experience,
    monthlyBudget: persona.onboarding.monthlyBudget,
    horizon: persona.onboarding.horizon,
    notes: persona.onboarding.notes,
    // Day 0 has no answers, so it must not look onboarded — otherwise the app
    // skips onboarding and the assistant claims to know things it does not.
    onboardedAt: persona.onboarding.experience
      ? new Date(now - persona.dayIndex * dayMs)
      : null,
  };

  await db
    .insert(userProfile)
    .values(profileRow)
    .onConflictDoUpdate({ target: userProfile.userId, set: profileRow });

  // Refresh this user's vector memories so retrieval matches the new persona.
  try {
    const retriever = await getRetriever();
    await retriever.store.deleteOwner(userId);

    const entries = persona.decisions.map((d, i) => ({
      id: `seed_${stage}_${i}`,
      kind: "decision",
      tickers: [d.ticker],
      text:
        `They ${d.action} ${d.ticker} (${d.companyName})` +
        (d.quantity ? `, ${d.quantity} shares` : "") +
        (priceFor(d) ? ` at ₹${priceFor(d)}` : "") +
        (d.thesis ? `. Their thesis: "${d.thesis}"` : "") +
        (d.reasoning ? `. Their reasoning: "${d.reasoning}"` : "") +
        (d.outcomeNote ? `. Outcome: ${d.outcomeNote}` : ""),
    }));

    const o = persona.onboarding;
    if (o.primaryGoal || o.horizon || o.riskComfort) entries.push({
      id: "onboarding",
      kind: "profile",
      tickers: [],
      text:
        [
          o.primaryGoal && `Their goal: ${o.primaryGoal}`,
          o.horizon && `They may need the money: ${o.horizon}`,
          o.riskComfort && `If down 20% they would: ${o.riskComfort}`,
          o.experience && `Experience: ${o.experience}`,
          o.monthlyBudget && `About ₹${o.monthlyBudget} a month to invest`,
          o.notes && `In their words: ${o.notes}`,
        ]
          .filter(Boolean)
          .join(". "),
    });

    if (entries.length) await retriever.indexPersonal(userId, entries);
  } catch (error) {
    // Never fail a demo reset because indexing hiccuped.
    console.warn("[demo] reindex failed:", error instanceof Error ? error.message : error);
  }

  return {
    level: persona.level,
    knownConcepts: persona.knownConcepts,
    holdings,
    pastTheses,
    startedAt,
    dayIndex: persona.dayIndex,
  };
}

/** Net quantity and average cost per ticker, from bought/sold decisions. */
function buildHoldings(
  decisions: PersonaDecision[],
  priceFor: (d: PersonaDecision) => number | null,
): UserProfile["holdings"] {
  const held = new Map<string, { name: string; qty: number; cost: number }>();

  for (const d of [...decisions].sort((a, b) => b.daysAgo - a.daysAgo)) {
    if (d.action !== "bought" || !d.quantity) continue;
    const entry = held.get(d.ticker) ?? { name: d.companyName, qty: 0, cost: 0 };
    entry.qty += d.quantity;
    entry.cost += d.quantity * (priceFor(d) ?? 0);
    held.set(d.ticker, entry);
  }

  const total = [...held.values()].reduce((sum, e) => sum + e.cost, 0);
  return [...held.entries()].map(([ticker, e]) => ({
    ticker,
    name: e.name,
    quantity: e.qty,
    avgPrice: e.qty > 0 ? e.cost / e.qty : 0,
    weight: total > 0 ? e.cost / total : 0,
  }));
}

export function createProfilePort(userId: string): ProfilePort {
  return {
    get: async () => {
      const { getProfile: read } = await import("./store");
      return read(userId);
    },
    learnConcepts: async (keys) => {
      const { learnConcepts } = await import("./store");
      await learnConcepts(userId, keys);
    },
  };
}
