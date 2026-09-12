/**
 * In-memory vector store.
 *
 * Not a toy fallback — for our dataset it is the correct default. 20 companies
 * is a few hundred chunks; brute-force cosine over that takes well under a
 * millisecond, which beats a network round trip to any vector database.
 *
 * It also means the product works with zero infrastructure, which is what you
 * want at 3am when a container has gone down.
 */

import { PUBLIC_OWNER, type SearchFilter, type VectorHit, type VectorPoint, type VectorStore } from "./types";

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function matchesFilter(payload: VectorPoint["payload"], filter?: SearchFilter): boolean {
  if (!filter) return true;

  // Personal context is private. A user's own points, or public ones — never
  // another user's.
  if (filter.owner && payload.owner !== filter.owner && payload.owner !== PUBLIC_OWNER) {
    return false;
  }
  if (filter.kinds?.length && !filter.kinds.includes(payload.kind)) return false;
  if (filter.tiers?.length && !filter.tiers.includes(payload.tier)) return false;
  if (filter.tickers?.length && !filter.tickers.some((t) => payload.tickers.includes(t))) {
    return false;
  }
  return true;
}

export function createMemoryStore(): VectorStore {
  const points = new Map<string, VectorPoint>();

  return {
    name: "in-memory",
    async ready() {
      return true;
    },
    async upsert(batch) {
      for (const point of batch) points.set(point.id, point);
    },
    async search(vector, limit, filter) {
      const hits: VectorHit[] = [];
      for (const point of points.values()) {
        if (!matchesFilter(point.payload, filter)) continue;
        hits.push({ id: point.id, score: cosine(vector, point.vector), payload: point.payload });
      }
      return hits.sort((a, b) => b.score - a.score).slice(0, limit);
    },
    async count() {
      return points.size;
    },
    async reset() {
      points.clear();
    },
  };
}
