import { createAuth as createConfiguredAuth } from "@bit-n-build-2026/auth";
import { type Database, createDb } from "@bit-n-build-2026/db";
import { createLlm } from "@bit-n-build-2026/llm";
import type { ProfilePort } from "@bit-n-build-2026/engine";
import type { DemoStage, UserProfile } from "@bit-n-build-2026/contracts";

import { DEMO_PERSONAS } from "./demo-personas";
import { env } from "./env.server";
// TODO: replace with `packages/sources` when Tushar's snapshot lands.
// This is the only line that needs to change.
import { sourcesStub as sources } from "./sources-stub";

const db = createDb(env);

export function getDb(): Database {
  return db;
}

export const auth = createConfiguredAuth(env, db);

export const llm = createLlm(env);

export { sources };

/**
 * Profiles live in memory, keyed by user id.
 *
 * Deliberate: the Time Machine resets profiles constantly during a demo, and a
 * process-lifetime map is the right amount of durability for that. If we need it
 * to survive a restart, it becomes a Drizzle table — the ProfilePort interface
 * does not change.
 */
const profiles = new Map<string, UserProfile>();

export function getProfile(userId: string): UserProfile {
  const existing = profiles.get(userId);
  if (existing) return existing;
  const seeded = structuredClone(DEMO_PERSONAS.day0);
  profiles.set(userId, seeded);
  return seeded;
}

export function seedProfile(userId: string, stage: DemoStage): UserProfile {
  const seeded = structuredClone(DEMO_PERSONAS[stage]);
  profiles.set(userId, seeded);
  return seeded;
}

export function createProfilePort(userId: string): ProfilePort {
  return {
    get: () => getProfile(userId),
    learnConcepts: (keys) => {
      const profile = getProfile(userId);
      const known = new Set(profile.knownConcepts);
      for (const key of keys) known.add(key);
      profiles.set(userId, { ...profile, knownConcepts: [...known] });
    },
  };
}
