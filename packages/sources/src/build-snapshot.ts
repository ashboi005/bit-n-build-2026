/**
 * Builds data/snapshot/ from live sources.
 *
 *   bun run --filter @bit-n-build-2026/sources build:snapshot
 *
 * ⚠️ READ THIS FIRST
 *
 * The snapshot is committed to git and is the product's floor. This script
 * UPGRADES it. It must never be required for the app to work.
 *
 * So: hand-write files for the demo-critical companies FIRST, commit them, and
 * only then automate. If this script half-works, that is fine — it should fill in
 * what it can and leave the rest alone. It must never delete or blank an existing
 * file because a fetch failed.
 *
 * TODO(tushar): implement the marked steps. Each is independent — commit after
 * each one works.
 */

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import type { SourceDocument, StockRecord } from "@bit-n-build-2026/contracts";

import { fetchScripMaster } from "./fetchers/bse";
import { OFFICIAL_FEEDS, NEWS_FEEDS, fetchFeed } from "./fetchers/rss";

const DATA = join(import.meta.dir, "../data/snapshot");

/**
 * The 20 companies we cover.
 *
 * TODO(tushar): fill this in. Pick for CONTRAST, not just fame — the product is
 * about comparison, so include at least one clearly expensive company, one
 * clearly indebted one, and one recent IPO.
 *
 * Must include the defence cluster: HAL, BEL, BDL — the hero demo depends on it.
 */
const COVERED = ["HAL", "BEL", "BDL", "RELIANCE", "TCS", "INFY", "TATAMOTORS", "ITC"];

function writeIfAbsent(path: string, data: unknown) {
  // Never clobber hand-written work with a partial fetch.
  if (existsSync(path)) {
    console.log(`  skip (exists): ${path.split("/").pop()}`);
    return;
  }
  writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(`  wrote: ${path.split("/").pop()}`);
}

async function step1_symbolMap() {
  console.log("\n[1] BSE scrip master -> symbol map");
  const rows = await fetchScripMaster();
  const map: Record<string, { bseCode: string; isin: string; name: string }> = {};
  for (const row of rows) {
    if (!row.scrip_id) continue;
    map[row.scrip_id.toUpperCase()] = {
      bseCode: row.SCRIP_CD,
      isin: row.ISIN_NUMBER,
      name: row.Scrip_Name,
    };
  }
  writeFileSync(join(DATA, "symbol-map.json"), JSON.stringify(map, null, 2));
  console.log(`  ${Object.keys(map).length} symbols mapped`);
  return map;
}

async function step2_stocks() {
  console.log("\n[2] Stocks");
  console.log("  TODO(tushar): for each ticker in COVERED —");
  console.log("    a. screener searchCompany(ticker) -> company id");
  console.log("    b. fetchFundamentals(ticker)      -> pe, roe, roce, book value...");
  console.log("    c. fetchPriceHistory(id)          -> history[]");
  console.log("    d. bse fetchQuote(bseCode)        -> price{}");
  console.log("    e. compute sectorMedians across same-sector stocks");
  console.log("    f. hand-write `business` (2 plain sentences) and the risk reasons");
  console.log("    -> writeIfAbsent(stocks/<TICKER>.json)");

  for (const ticker of COVERED) {
    const path = join(DATA, "stocks", `${ticker}.json`);
    // Placeholder so every covered ticker has a file to fill in. Existing
    // hand-written files are left untouched.
    const placeholder: Partial<StockRecord> = {
      ticker,
      name: ticker,
      sector: "TODO",
      business: "TODO: two plain sentences.",
      metrics: [],
      history: [],
      sectorMedians: {},
      risk: [],
      documentIds: [],
      newsIds: [],
    };
    writeIfAbsent(path, placeholder);
  }
}

async function step3_officialDocs() {
  console.log("\n[3] Official sources (the citation moat)");
  for (const feed of OFFICIAL_FEEDS) {
    try {
      const items = await fetchFeed(feed);
      console.log(`  ${feed.name}: ${items.length} items`);
      // TODO(tushar): filter to items relevant to our sectors, then write each
      // as a SourceDocument with tier "official".
    } catch (error) {
      console.log(`  ${feed.name}: FAILED — ${error instanceof Error ? error.message : "?"}`);
    }
  }
  console.log("  TODO(tushar): NSE fetchAnnouncements(symbol) per covered ticker.");
  console.log("    Use `attchmntText` as the document text — official, citable,");
  console.log("    already plain text. This is the highest-value step in the file.");
  const _shape: Partial<SourceDocument> = {};
  void _shape;
}

async function step4_news() {
  console.log("\n[4] News");
  for (const feed of NEWS_FEEDS) {
    try {
      const items = await fetchFeed(feed);
      console.log(`  ${feed.name}: ${items.length} items`);
      // TODO(tushar): keep items mentioning a covered company; write as tier "press".
    } catch (error) {
      console.log(`  ${feed.name}: FAILED — ${error instanceof Error ? error.message : "?"}`);
    }
  }
  console.log("  ⚠️ MUST HAVE: at least one piece arguing the defence budget rise is");
  console.log("     already priced in. Without it the hero demo has no punchline.");
}

async function main() {
  mkdirSync(join(DATA, "stocks"), { recursive: true });
  mkdirSync(join(DATA, "documents"), { recursive: true });

  const steps = [step1_symbolMap, step2_stocks, step3_officialDocs, step4_news];
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      // One failing step must never stop the others.
      console.log(`  STEP FAILED: ${error instanceof Error ? error.message : "?"}`);
    }
  }

  console.log(`\nDone. Covered: ${COVERED.length} tickers targeted.`);
  console.log("Commit whatever landed. A half-full snapshot in git beats a perfect one on your laptop.");
}

void main();
