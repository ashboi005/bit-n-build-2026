import { createAuth as createConfiguredAuth } from "@bit-n-build-2026/auth";
import { type Database, createDb } from "@bit-n-build-2026/db";
import type { DemoStage, UserProfile } from "@bit-n-build-2026/contracts";
import type { ProfilePort } from "@bit-n-build-2026/engine";
import { createLlm } from "@bit-n-build-2026/llm";
import { createRetriever, createStore, type Retriever } from "@bit-n-build-2026/rag";
import { sources } from "@bit-n-build-2026/sources";
import { userProfile } from "@bit-n-build-2026/db/schema/profile";

import { DEMO_PERSONAS } from "./demo-personas";
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
      /**
       * Collect every document we can reach through the public sources API.
       *
       * `SourcesApi` has no listDocuments() yet, so this walks each stock's
       * documentIds. A document that no stock links to is therefore invisible
       * to retrieval — asked Tushar for listDocuments() in
       * docs/handoff-sources-integration.md; this workaround needs no change
       * on his side to run today.
       */
      const docs = [
        ...new Map(
          sources
            .listStocks()
            .flatMap((s) => sources.getStock(s.ticker)?.documentIds ?? [])
            .map((id) => sources.getDocument(id))
            .filter((d): d is NonNullable<typeof d> => d !== null)
            .map((d) => [d.id, d] as const),
        ).values(),
      ];

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

export async function seedProfile(userId: string, stage: DemoStage): Promise<UserProfile> {
  const seeded = structuredClone(DEMO_PERSONAS[stage]);
  const row = {
    userId,
    level: seeded.level,
    knownConcepts: seeded.knownConcepts,
    holdings: seeded.holdings,
    pastTheses: seeded.pastTheses,
    startedAt: seeded.startedAt,
    dayIndex: seeded.dayIndex,
  };
  await db
    .insert(userProfile)
    .values(row)
    .onConflictDoUpdate({ target: userProfile.userId, set: row });
  return seeded;
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
