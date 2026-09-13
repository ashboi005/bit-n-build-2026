/**
 * Keeping the snapshot current.
 *
 * The snapshot is committed and always works — that is the point of it. But if
 * it drifts, the product starts quoting prices from last week with a straight
 * face, which is exactly the kind of confident-but-wrong output we exist to
 * avoid. So: measure staleness, and refresh only when enough of it has gone off.
 *
 * Three rules, each learned the hard way:
 *   1. NEVER overwrite good data with a failed fetch. A stale price is a small
 *      problem; a null price is a broken screen.
 *   2. Refresh on a THRESHOLD, not per-stock. One stale record is noise; several
 *      means the whole snapshot has aged and is worth one polite pass.
 *   3. Never block startup. Refreshing takes ~a minute of rate-limited requests;
 *      the server must serve the committed snapshot immediately regardless.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { dataPath } from "./paths";

import type { StockRecord } from "@bit-n-build-2026/contracts";

import { deriveAll } from "./derive";

const STOCKS_DIR = dataPath("snapshot", "stocks");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** A price older than this is considered stale. One full day plus slack. */
export const MAX_AGE_HOURS = 30;

/** Refresh only once this many records have gone stale. */
export const STALE_THRESHOLD = 3;

/** Never refresh more often than this, however often the process restarts. */
export const MIN_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FreshnessReport {
  total: number;
  stale: string[];
  staleCount: number;
  oldestAsOf: string | null;
  newestAsOf: string | null;
  shouldRefresh: boolean;
}

function loadStocks(): { file: string; record: StockRecord }[] {
  // A missing or unreadable snapshot must degrade to "no coverage", never throw.
  // This ran on boot and an ENOENT here put the container in a restart loop.
  if (!existsSync(STOCKS_DIR)) return [];
  try {
    return readdirSync(STOCKS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({
        file: join(STOCKS_DIR, f),
        record: JSON.parse(readFileSync(join(STOCKS_DIR, f), "utf8")) as StockRecord,
      }));
  } catch (error) {
    console.warn(
      "[sources] could not read the stock snapshot:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

export function checkFreshness(maxAgeHours = MAX_AGE_HOURS): FreshnessReport {
  const stocks = loadStocks();
  const now = Date.now();
  const cutoff = maxAgeHours * 60 * 60 * 1000;

  const stale: string[] = [];
  const timestamps: string[] = [];

  for (const { record } of stocks) {
    const asOf = record.price?.asOf;
    if (!asOf) {
      stale.push(record.ticker);
      continue;
    }
    timestamps.push(asOf);
    const age = now - new Date(asOf).getTime();
    if (Number.isNaN(age) || age > cutoff) stale.push(record.ticker);
  }

  timestamps.sort();

  return {
    total: stocks.length,
    stale,
    staleCount: stale.length,
    oldestAsOf: timestamps[0] ?? null,
    newestAsOf: timestamps[timestamps.length - 1] ?? null,
    shouldRefresh: stale.length >= STALE_THRESHOLD,
  };
}

/** Pull one figure out of screener's top-ratios list. */
function ratio(html: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = html.match(
    new RegExp(
      `<span class="name">\\s*${escaped}\\s*</span>[\\s\\S]{0,300}?<span class="number">([\\d.,-]+)</span>`,
      "i",
    ),
  );
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function highLow(html: string): { high: number | null; low: number | null } {
  const m = html.match(
    /<span class="name">\s*High\s*\/\s*Low\s*<\/span>[\s\S]{0,300}?<span class="number">([\d.,]+)<\/span>\s*\/\s*<span class="number">([\d.,]+)<\/span>/i,
  );
  if (!m) return { high: null, low: null };
  return {
    high: Number(m[1]!.replace(/,/g, "")) || null,
    low: Number(m[2]!.replace(/,/g, "")) || null,
  };
}

const FIGURES = [
  { key: "market_cap", screener: "Market Cap" },
  { key: "pe", screener: "Stock P/E" },
  { key: "book_value", screener: "Book Value" },
  { key: "roce", screener: "ROCE" },
  { key: "roe", screener: "ROE" },
  { key: "dividend_yield", screener: "Dividend Yield" },
] as const;

function display(key: string, v: number): string {
  if (key === "market_cap") return `₹${Math.round(v).toLocaleString("en-IN")} Cr`;
  if (key === "book_value") return `₹${v.toLocaleString("en-IN")}`;
  if (key === "roce" || key === "roe" || key === "dividend_yield") return `${v}%`;
  return String(v);
}

export interface RefreshResult {
  attempted: number;
  updated: string[];
  failed: string[];
}

/**
 * Re-fetch the given tickers and write only what succeeded.
 *
 * Every field is updated in place, so a partial response leaves the rest of the
 * record intact. A ticker that fails entirely is left exactly as it was.
 */
export async function refreshStale(tickers: string[]): Promise<RefreshResult> {
  const stocks = loadStocks();
  const wanted = new Set(tickers.map((t) => t.toUpperCase()));
  const targets = stocks.filter((s) => wanted.has(s.record.ticker.toUpperCase()));

  const updated: string[] = [];
  const failed: string[] = [];

  for (const { file, record } of targets) {
    try {
      let html = "";
      for (const path of ["consolidated/", ""]) {
        const res = await fetch(`https://www.screener.in/company/${record.ticker}/${path}`, {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(25000),
        });
        if (!res.ok) continue;
        html = await res.text();
        if (ratio(html, "Market Cap") !== null) break;
        await sleep(1000);
      }

      const price = ratio(html, "Current Price");
      if (price === null) {
        // Nothing usable came back — keep everything we already had.
        failed.push(record.ticker);
        await sleep(1200);
        continue;
      }

      const previous = record.price.last;
      record.price.last = price;
      record.price.change = previous ? Math.round((price - previous) * 100) / 100 : 0;
      record.price.changePct =
        previous ? Math.round(((price - previous) / previous) * 10000) / 100 : 0;
      record.price.asOf = new Date().toISOString();

      const { high, low } = highLow(html);
      if (high !== null) record.price.week52High = high;
      if (low !== null) record.price.week52Low = low;

      for (const f of FIGURES) {
        const value = ratio(html, f.screener);
        if (value === null) continue; // keep the old figure rather than nulling it
        const metric = record.metrics.find((m) => m.key === f.key);
        if (metric) {
          metric.value = value;
          metric.display = display(f.key, value);
        }
      }

      if (high !== null && low !== null) {
        const range = record.metrics.find((m) => m.key === "week52_range");
        if (range) {
          range.display = `₹${low.toLocaleString("en-IN")} – ₹${high.toLocaleString("en-IN")}`;
        }
      }

      writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
      updated.push(record.ticker);
    } catch {
      failed.push(record.ticker);
    }
    await sleep(1200); // screener.in is a small free site — stay polite
  }

  // Medians and risk rows depend on the figures we just changed.
  if (updated.length) {
    const all = loadStocks();
    deriveAll(all.map((s) => s.record));
    for (const { file, record } of all) {
      writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
    }
  }

  return { attempted: targets.length, updated, failed };
}

let lastRefreshAt = 0;

/**
 * Refresh if enough records have gone stale. Returns null when it decides not to.
 *
 * Rate-limited across the process lifetime so repeated restarts — which happen
 * constantly in dev with hot reload — cannot hammer the upstream site.
 */
export async function refreshIfStale(
  opts: { maxAgeHours?: number; threshold?: number; force?: boolean } = {},
): Promise<{ report: FreshnessReport; result: RefreshResult | null }> {
  const report = checkFreshness(opts.maxAgeHours ?? MAX_AGE_HOURS);
  const threshold = opts.threshold ?? STALE_THRESHOLD;

  const due = Date.now() - lastRefreshAt > MIN_REFRESH_INTERVAL_MS;
  if (!opts.force && (report.staleCount < threshold || !due)) {
    return { report, result: null };
  }

  lastRefreshAt = Date.now();
  const result = await refreshStale(report.stale.length ? report.stale : []);
  return { report, result };
}
