/**
 * Disk cache for every outbound request.
 *
 * Not an optimisation — a safety rail. During development we will hit these
 * endpoints hundreds of times, and screener.in is a small free site that is our
 * product's backbone. Getting rate-limited an hour before judging is a real way
 * to lose. Everything goes through here.
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const CACHE_DIR = join(import.meta.dir, "../.cache");

/** 6 hours. Market data goes stale; filings and budget documents do not. */
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

function keyToPath(key: string): string {
  const safe = key.replace(/[^a-z0-9._-]/gi, "_").slice(0, 180);
  return join(CACHE_DIR, `${safe}.json`);
}

export async function readCache<T>(key: string, ttlMs = DEFAULT_TTL_MS): Promise<T | null> {
  try {
    const file = Bun.file(keyToPath(key));
    if (!(await file.exists())) return null;
    const entry = (await file.json()) as { at: number; value: T };
    if (Date.now() - entry.at > ttlMs) return null;
    return entry.value;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await Bun.write(keyToPath(key), JSON.stringify({ at: Date.now(), value }));
  } catch {
    // A cache write failure must never break a fetch.
  }
}

/** Wrap any async fetch in the cache. Use this for every network call. */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = await readCache<T>(key, ttlMs);
  if (hit !== null) return hit;
  const value = await fetcher();
  await writeCache(key, value);
  return value;
}
