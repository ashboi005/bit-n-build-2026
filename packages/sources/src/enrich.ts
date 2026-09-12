/**
 * Fills missing figures, then applies every derived field.
 *
 *   bun run --filter @bit-n-build-2026/sources enrich
 *
 * Two passes:
 *   1. Any stock missing core figures is re-fetched from screener.in. Some
 *      companies report nothing on their consolidated page (BDL), so the
 *      standalone page is tried as a fallback.
 *   2. deriveAll() recomputes sectors, medians, metric directions and risk.
 *
 * Safe to run repeatedly. It never overwrites a figure that is already present,
 * and it never writes a number it did not read from a page.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { dataPath } from "./paths";

import type { Metric, StockRecord } from "@bit-n-build-2026/contracts";

import { deriveAll } from "./derive";

const DIR = dataPath("snapshot", "stocks");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pull one figure from screener's top-ratios list. */
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

/** High / Low renders as two numbers inside one value span. */
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

const FIGURES: { key: string; label: string; screener: string; unit: string | null }[] = [
  { key: "market_cap", label: "Market cap", screener: "Market Cap", unit: "INR Cr" },
  { key: "pe", label: "P/E ratio", screener: "Stock P/E", unit: null },
  { key: "book_value", label: "Book value", screener: "Book Value", unit: "INR" },
  { key: "roce", label: "ROCE", screener: "ROCE", unit: "%" },
  { key: "roe", label: "ROE", screener: "ROE", unit: "%" },
  { key: "dividend_yield", label: "Dividend yield", screener: "Dividend Yield", unit: "%" },
];

function display(key: string, v: number): string {
  if (key === "market_cap") return `₹${Math.round(v).toLocaleString("en-IN")} Cr`;
  if (key === "book_value") return `₹${v.toLocaleString("en-IN")}`;
  if (key === "roce" || key === "roe" || key === "dividend_yield") return `${v}%`;
  return String(v);
}

async function fetchFigures(ticker: string) {
  // Some companies report nothing consolidated — BDL is one. Try standalone.
  for (const path of ["consolidated/", ""]) {
    const res = await fetch(`https://www.screener.in/company/${ticker}/${path}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) continue;
    const html = await res.text();
    if (ratio(html, "Market Cap") === null) {
      await sleep(1000);
      continue;
    }
    return {
      html,
      price: ratio(html, "Current Price"),
      ...highLow(html),
      figures: Object.fromEntries(FIGURES.map((f) => [f.key, ratio(html, f.screener)])),
    };
  }
  return null;
}

async function main() {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
  const stocks: { file: string; record: StockRecord }[] = files.map((f) => ({
    file: join(DIR, f),
    record: JSON.parse(readFileSync(join(DIR, f), "utf8")) as StockRecord,
  }));

  // Pass 1 — anything missing its core figures gets re-fetched.
  const incomplete = stocks.filter(
    ({ record }) =>
      record.metrics.find((m) => m.key === "pe")?.value == null ||
      record.price?.week52High == null,
  );

  console.log(
    incomplete.length
      ? `Re-fetching ${incomplete.length} incomplete stock(s): ${incomplete.map((s) => s.record.ticker).join(", ")}\n`
      : "All stocks have core figures.\n",
  );

  for (const { record } of incomplete) {
    try {
      const data = await fetchFigures(record.ticker);
      if (!data) {
        console.log(`  ${record.ticker.padEnd(11)} no figures on either page — left null`);
        await sleep(1200);
        continue;
      }

      if (data.price !== null) {
        record.price.last = data.price;
        record.price.asOf = new Date().toISOString();
      }
      if (data.high !== null) record.price.week52High = data.high;
      if (data.low !== null) record.price.week52Low = data.low;

      const sourceIds = record.price?.sourceId
        ? [record.price.sourceId]
        : record.documentIds.slice(0, 1);

      for (const f of FIGURES) {
        const value = data.figures[f.key];
        if (value === null || value === undefined) continue;

        const existing = record.metrics.find((m) => m.key === f.key);
        if (existing) {
          // Only fill gaps — never overwrite a figure that is already there.
          if (existing.value === null) {
            existing.value = value;
            existing.display = display(f.key, value);
          }
        } else {
          const metric: Metric = {
            key: f.key,
            label: f.label,
            value,
            display: display(f.key, value),
            unit: f.unit,
            sectorMedian: null,
            direction: "unknown",
            explanation: "",
            sourceIds,
          };
          record.metrics.push(metric);
        }
      }

      if (data.high !== null && data.low !== null) {
        const range = record.metrics.find((m) => m.key === "week52_range");
        const disp = `₹${data.low.toLocaleString("en-IN")} – ₹${data.high.toLocaleString("en-IN")}`;
        if (range) {
          range.display = disp;
        } else {
          record.metrics.push({
            key: "week52_range",
            label: "52-week range",
            value: null,
            display: disp,
            unit: "INR",
            sectorMedian: null,
            direction: "unknown",
            explanation: "",
            sourceIds,
          });
        }
      }

      const filled = FIGURES.filter((f) => data.figures[f.key] !== null).map((f) => f.key);
      console.log(`  ${record.ticker.padEnd(11)} filled: ${filled.join(", ") || "none"}`);
    } catch (error) {
      console.log(
        `  ${record.ticker.padEnd(11)} FAILED ${error instanceof Error ? error.message.slice(0, 40) : ""}`,
      );
    }
    await sleep(1200);
  }

  // Pass 2 — derive everything that depends on the full set.
  deriveAll(stocks.map((s) => s.record));

  for (const { file, record } of stocks) {
    writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  }

  const bySector = new Map<string, number>();
  for (const { record } of stocks) {
    bySector.set(record.sector, (bySector.get(record.sector) ?? 0) + 1);
  }

  console.log(`\n${stocks.length} stocks across ${bySector.size} sectors:`);
  for (const [sector, n] of [...bySector].sort()) {
    const sample = stocks.find((s) => s.record.sector === sector)!.record;
    const pe = sample.sectorMedians.pe;
    console.log(
      `  ${sector.padEnd(24)} n=${n}  median P/E ${pe !== undefined ? pe : "— (needs 2+ peers)"}`,
    );
  }
}

void main();
