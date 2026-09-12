import { createAuth as createConfiguredAuth } from "@bit-n-build-2026/auth";
import { type Database, createDb } from "@bit-n-build-2026/db";
import { userProfile } from "@bit-n-build-2026/db/schema/profile";
import { eq } from "drizzle-orm";
import { createLlm } from "@bit-n-build-2026/llm";
import type { ProfilePort } from "@bit-n-build-2026/engine";
import type { DemoStage, UserProfile } from "@bit-n-build-2026/contracts";

import { DEMO_PERSONAS } from "./demo-personas";
import { env } from "./env.server";
import { sources } from "@bit-n-build-2026/sources";

const db = createDb(env);

export function getDb(): Database {
  return db;
}

export const auth = createConfiguredAuth(env, db);

export const llm = createLlm(env);
export const fastModel = env.MERGE_MODEL_FAST;

export { sources };

/**
 * Profiles live in Postgres.
 *
 * Deliberately a real table rather than a memory map: the demo seed is then a
 * genuine database write, so if a judge asks to see the user's state, there is
 * state to show. The Time Machine reads and writes the same rows the product
 * uses in normal operation — there is no separate "demo mode" code path.
 */

function toProfile(row: typeof userProfile.$inferSelect): UserProfile {
  return {
    level: row.level as UserProfile["level"],
    knownConcepts: row.knownConcepts,
    holdings: row.holdings as UserProfile["holdings"],
    pastTheses: row.pastTheses as UserProfile["pastTheses"],
    startedAt: row.startedAt,
    dayIndex: row.dayIndex,
  };
}

function toRow(userId: string, profile: UserProfile) {
  return {
    userId,
    level: profile.level,
    knownConcepts: profile.knownConcepts,
    holdings: profile.holdings,
    pastTheses: profile.pastTheses,
    startedAt: profile.startedAt,
    dayIndex: profile.dayIndex,
  };
}

/** Read the profile, creating a day-0 one on first sight. */
export async function getProfile(userId: string): Promise<UserProfile> {
  const [row] = await db.select().from(userProfile).where(eq(userProfile.userId, userId));
  if (row) return toProfile(row);

  const seeded = structuredClone(DEMO_PERSONAS.day0);
  await db.insert(userProfile).values(toRow(userId, seeded)).onConflictDoNothing();
  return seeded;
}

/** Time Machine: overwrite the profile with a scripted persona. */
export async function seedProfile(userId: string, stage: DemoStage): Promise<UserProfile> {
  const seeded = structuredClone(DEMO_PERSONAS[stage]);
  const row = toRow(userId, seeded);
  await db
    .insert(userProfile)
    .values(row)
    .onConflictDoUpdate({ target: userProfile.userId, set: row });
  return seeded;
}

export function createProfilePort(userId: string): ProfilePort {
  return {
    get: () => getProfile(userId),
    learnConcepts: async (keys) => {
      const profile = await getProfile(userId);
      const known = new Set(profile.knownConcepts);
      for (const key of keys) known.add(key);
      await db
        .update(userProfile)
        .set({ knownConcepts: [...known] })
        .where(eq(userProfile.userId, userId));
    },
  };
}
