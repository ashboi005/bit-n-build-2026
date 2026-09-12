/**
 * Loads the committed snapshot from disk.
 *
 * The snapshot is the product's floor: it is committed to git, it always works,
 * and nothing else in the system is allowed to depend on a live fetch succeeding.
 * Live fetchers upgrade it. They never gate it.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import type { GlossaryEntry, SourceDocument, StockRecord } from "@bit-n-build-2026/contracts";

const DATA_DIR = join(import.meta.dir, "../data/snapshot");

function loadDir<T>(sub: string): T[] {
  const dir = join(DATA_DIR, sub);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as T);
}

function loadFile<T>(name: string, fallback: T): T {
  const path = join(DATA_DIR, name);
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export interface Snapshot {
  stocks: Map<string, StockRecord>;
  documents: Map<string, SourceDocument>;
  glossary: Map<string, GlossaryEntry>;
}

export function loadSnapshot(): Snapshot {
  const stocks = new Map<string, StockRecord>();
  for (const stock of loadDir<StockRecord>("stocks")) {
    stocks.set(stock.ticker.toUpperCase(), stock);
  }

  const documents = new Map<string, SourceDocument>();
  for (const doc of loadDir<SourceDocument>("documents")) {
    documents.set(doc.id, doc);
  }

  const glossary = new Map<string, GlossaryEntry>();
  for (const entry of loadFile<GlossaryEntry[]>("glossary.json", [])) {
    glossary.set(entry.key.toLowerCase(), entry);
  }

  return { stocks, documents, glossary };
}
