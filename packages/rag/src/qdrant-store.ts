/**
 * Qdrant vector store, over its REST API with plain fetch.
 *
 * On the internal-URL question: a Coolify internal hostname resolves inside the
 * Coolify network, so it works when the server runs there and does not from a
 * laptop. That is handled rather than worked around — `ready()` probes on
 * startup and the factory falls back to the in-memory store when it can't
 * connect, so local development and the deployed service both work without a
 * code change or a different env file.
 */

import type { SearchFilter, VectorHit, VectorPoint, VectorStore } from "./types";

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collection?: string;
  /** Must match the embedding model's output dimension. */
  dimension: number;
}

export function createQdrantStore(config: QdrantConfig): VectorStore {
  const base = config.url.replace(/\/$/, "");
  const collection = config.collection ?? "mind_over_money";

  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { "api-key": config.apiKey } : {}),
        ...init.headers,
      },
      signal: init.signal ?? AbortSignal.timeout(15000),
    });
  }

  async function ensureCollection(): Promise<void> {
    const existing = await call(`/collections/${collection}`);
    if (existing.ok) return;

    const created = await call(`/collections/${collection}`, {
      method: "PUT",
      body: JSON.stringify({
        vectors: { size: config.dimension, distance: "Cosine" },
      }),
    });
    if (!created.ok) {
      throw new Error(`Qdrant: could not create collection (${created.status})`);
    }
  }

  /** Qdrant wants its own filter DSL; translate ours. */
  function toQdrantFilter(filter?: SearchFilter) {
    if (!filter) return undefined;
    const must: unknown[] = [];
    const should: unknown[] = [];

    if (filter.owner) {
      // The user's own points OR public ones — never another user's.
      should.push(
        { key: "owner", match: { value: filter.owner } },
        { key: "owner", match: { value: "public" } },
      );
    }
    if (filter.kinds?.length) must.push({ key: "kind", match: { any: filter.kinds } });
    if (filter.tiers?.length) must.push({ key: "tier", match: { any: filter.tiers } });
    if (filter.tickers?.length) must.push({ key: "tickers", match: { any: filter.tickers } });

    if (!must.length && !should.length) return undefined;
    return {
      ...(must.length ? { must } : {}),
      ...(should.length ? { should, minimum_should_match: 1 } : {}),
    };
  }

  return {
    name: "qdrant",

    async ready() {
      try {
        const res = await call("/collections", { signal: AbortSignal.timeout(6000) });
        if (!res.ok) return false;
        // A proxy in front of Qdrant returns HTML; Qdrant always returns JSON.
        const type = res.headers.get("content-type") ?? "";
        if (!type.includes("json")) return false;
        await ensureCollection();
        return true;
      } catch {
        return false;
      }
    },

    async upsert(points: VectorPoint[]) {
      if (!points.length) return;
      // Qdrant ids must be an unsigned int or a UUID, so our string ids live in
      // the payload and we hash them for the id.
      const res = await call(`/collections/${collection}/points?wait=true`, {
        method: "PUT",
        body: JSON.stringify({
          points: points.map((p) => ({
            id: hashId(p.id),
            vector: p.vector,
            payload: { ...p.payload, originalId: p.id },
          })),
        }),
      });
      if (!res.ok) {
        throw new Error(`Qdrant upsert failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      }
    },

    async search(vector, limit, filter): Promise<VectorHit[]> {
      const res = await call(`/collections/${collection}/points/search`, {
        method: "POST",
        body: JSON.stringify({
          vector,
          limit,
          with_payload: true,
          filter: toQdrantFilter(filter),
        }),
      });
      if (!res.ok) {
        throw new Error(`Qdrant search failed (${res.status})`);
      }
      const json = (await res.json()) as {
        result?: { id: number; score: number; payload: Record<string, unknown> }[];
      };
      return (json.result ?? []).map((r) => ({
        id: String(r.payload.originalId ?? r.id),
        score: r.score,
        payload: r.payload as unknown as VectorHit["payload"],
      }));
    },

    async count() {
      const res = await call(`/collections/${collection}`);
      if (!res.ok) return 0;
      const json = (await res.json()) as { result?: { points_count?: number } };
      return json.result?.points_count ?? 0;
    },

    async reset() {
      await call(`/collections/${collection}`, { method: "DELETE" });
      await ensureCollection();
    },

    async deleteOwner(owner: string) {
      await call(`/collections/${collection}/points/delete?wait=true`, {
        method: "POST",
        body: JSON.stringify({ filter: { must: [{ key: "owner", match: { value: owner } }] } }),
      });
    },
  };
}

/** Stable 53-bit hash — Qdrant needs a numeric id, we key on strings. */
function hashId(input: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 2097152 * (h2 >>> 0) + (h1 >>> 11);
}
