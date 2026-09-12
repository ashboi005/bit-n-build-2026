/**
 * Locating the committed data, wherever the code is running from.
 *
 * ⚠️ `import.meta.dir` is not reliable here. In development it points at
 * `packages/sources/src`, so `../data` is correct. But the server bundles this
 * package into `apps/server/dist/index.mjs`, where the same expression resolves
 * to `apps/server/data` — which does not exist. In production that meant the
 * snapshot silently loaded zero stocks and zero documents, the vector index
 * reported "0 chunks already indexed and current", and the freshness check
 * crashed the process on boot in a restart loop.
 *
 * So: try every plausible location, verify it actually contains the data, and
 * cache the answer. `SOURCES_DATA_DIR` overrides everything for deployments
 * that put the files somewhere unusual.
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

let cached: string | null = null;
let warned = false;

/** A directory only counts if the snapshot is actually in it. */
function looksRight(dir: string): boolean {
  return existsSync(join(dir, "snapshot", "stocks")) || existsSync(join(dir, "library", "stocks"));
}

function candidates(): string[] {
  const out: string[] = [];

  const override = process.env.SOURCES_DATA_DIR;
  if (override) out.push(resolve(override));

  // Development: packages/sources/src -> packages/sources/data
  out.push(join(import.meta.dir, "../data"));
  // Bundled one level deeper than expected
  out.push(join(import.meta.dir, "../../data"));

  // Walk up from the bundle and from the working directory looking for the
  // package. Covers apps/server/dist, apps/server, and the repo root alike.
  const roots = [import.meta.dir, process.cwd()];
  for (const root of roots) {
    let dir = root;
    for (let depth = 0; depth < 6; depth++) {
      out.push(join(dir, "packages", "sources", "data"));
      out.push(join(dir, "node_modules", "@bit-n-build-2026", "sources", "data"));
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return out;
}

/** Absolute path to `packages/sources/data`, or null if it cannot be found. */
export function findDataRoot(): string | null {
  if (cached) return cached;

  for (const dir of candidates()) {
    if (looksRight(dir)) {
      cached = dir;
      return cached;
    }
  }

  if (!warned) {
    warned = true;
    console.warn(
      "[sources] could not locate the data directory. Tried:\n  " +
        [...new Set(candidates())].join("\n  ") +
        "\nSet SOURCES_DATA_DIR to the absolute path of packages/sources/data.",
    );
  }
  return null;
}

/**
 * Resolve a path inside the data directory.
 *
 * Falls back to the development-relative path so callers always get a string;
 * they must still handle the directory not existing, because a missing snapshot
 * has to degrade to "no coverage", never to a crash.
 */
export function dataPath(...segments: string[]): string {
  const root = findDataRoot() ?? join(import.meta.dir, "../data");
  return join(root, ...segments);
}
