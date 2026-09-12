/**
 * The RAG engine.
 *
 * Indexes two very different kinds of thing into one store:
 *
 *   PUBLIC  — market sources: filings, government releases, news, market data.
 *             Shared by everyone, cited on screen, tier-badged.
 *
 *   PERSONAL— the user's own context: onboarding answers, decisions they made,
 *             theses that held up or broke. Owned by one user, never retrieved
 *             for anyone else.
 *
 * Keeping both in one index is what lets a single question pull "the defence
 * budget rose" and "you already hold 20% BEL and told us you'd panic-sell in a
 * 20% drop" in the same retrieval.
 */

import type { Llm } from "@bit-n-build-2026/llm";
import type { SourceDocument } from "@bit-n-build-2026/contracts";

import { createMemoryStore } from "./memory-store";
import { createQdrantStore } from "./qdrant-store";
import { PUBLIC_OWNER, type SearchFilter, type VectorHit, type VectorPoint, type VectorStore } from "./types";

export * from "./types";
export { createMemoryStore, cosine } from "./memory-store";
export { createQdrantStore } from "./qdrant-store";

/** google/gemini-embedding-001 output dimension. */
export const EMBEDDING_DIMENSION = 3072;

export interface RagConfig {
  qdrantUrl?: string;
  qdrantApiKey?: string;
  collection?: string;
  dimension?: number;
}

/**
 * Pick a store. Tries Qdrant when configured and reachable, falls back to
 * in-memory otherwise — so an unreachable container degrades to a working
 * product rather than a broken one.
 */
export async function createStore(config: RagConfig): Promise<VectorStore> {
  if (config.qdrantUrl) {
    const qdrant = createQdrantStore({
      url: config.qdrantUrl,
      apiKey: config.qdrantApiKey,
      collection: config.collection,
      dimension: config.dimension ?? EMBEDDING_DIMENSION,
    });
    if (await qdrant.ready()) {
      console.log(`[rag] using Qdrant at ${config.qdrantUrl}`);
      return qdrant;
    }
    console.warn(
      `[rag] Qdrant at ${config.qdrantUrl} unreachable — falling back to in-memory vectors. ` +
        `Retrieval still works; nothing is degraded for the user.`,
    );
  }
  return createMemoryStore();
}

export interface Retriever {
  store: VectorStore;
  indexDocuments(docs: SourceDocument[]): Promise<number>;
  indexPersonal(userId: string, entries: PersonalEntry[]): Promise<number>;
  search(query: string, opts?: RetrieveOptions): Promise<VectorHit[]>;
  isEmpty(): Promise<boolean>;
}

export interface PersonalEntry {
  id: string;
  text: string;
  /** decision | profile | chat */
  kind: string;
  tickers?: string[];
}

export interface RetrieveOptions {
  limit?: number;
  filter?: SearchFilter;
  /** Drop weak matches. Cosine over embeddings rarely goes below this usefully. */
  minScore?: number;
}

export function createRetriever(llm: Llm, store: VectorStore): Retriever {
  /** Embed in batches — one request per chunk would be needlessly slow. */
  async function embedAll(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    const BATCH = 16;
    for (let i = 0; i < texts.length; i += BATCH) {
      out.push(...(await llm.embed(texts.slice(i, i + BATCH))));
    }
    return out;
  }

  return {
    store,

    async indexDocuments(docs) {
      const chunks = docs.flatMap((doc) =>
        doc.chunks.map((chunk) => ({ doc, chunk })),
      );
      if (!chunks.length) return 0;

      const vectors = await embedAll(chunks.map((c) => `${c.doc.title}\n\n${c.chunk.text}`));
      const points: VectorPoint[] = chunks.map(({ doc, chunk }, i) => ({
        id: chunk.id,
        vector: vectors[i]!,
        payload: {
          docId: doc.id,
          text: chunk.text,
          tier: doc.tier,
          tickers: doc.tickers,
          sectors: doc.sectors,
          owner: PUBLIC_OWNER,
          kind: "source",
        },
      }));
      await store.upsert(points);
      return points.length;
    },

    async indexPersonal(userId, entries) {
      if (!entries.length) return 0;
      const vectors = await embedAll(entries.map((e) => e.text));
      const points: VectorPoint[] = entries.map((entry, i) => ({
        id: `${userId}:${entry.id}`,
        vector: vectors[i]!,
        payload: {
          docId: entry.id,
          text: entry.text,
          tier: "personal",
          tickers: entry.tickers ?? [],
          sectors: [],
          owner: userId,
          kind: entry.kind,
        },
      }));
      await store.upsert(points);
      return points.length;
    },

    async search(query, opts = {}) {
      const [vector] = await llm.embed([query]);
      if (!vector) return [];
      const hits = await store.search(vector, opts.limit ?? 8, opts.filter);
      const min = opts.minScore ?? 0;
      return hits.filter((h) => h.score >= min);
    },

    async isEmpty() {
      return (await store.count()) === 0;
    },
  };
}
