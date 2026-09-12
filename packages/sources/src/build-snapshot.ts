/** Builds the committed, source-backed fallback snapshot. */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Metric, SourceDocument, StockRecord } from "@bit-n-build-2026/contracts";

import { fetchScripMaster } from "./fetchers/bse";
import { fetchFundamentals, fetchPriceHistory, searchCompany } from "./fetchers/screener";
import { getJson, getText } from "./http";

const DATA = join(import.meta.dir, "../data/snapshot");

/** This is the product's deliberately small, committed fallback universe. */
const COVERED = [
  "HAL", "BEL", "BDL", "RELIANCE", "TCS", "INFY", "TATAMOTORS", "ITC", "NTPC", "POWERGRID",
  "ONGC", "TATAPOWER", "HDFCBANK", "ICICIBANK", "ETERNAL", "IDEA", "ATHER", "SUZLON", "TRENT", "IREDA",
];

const SCREENER_TICKERS: Record<string, string> = {
  TATAMOTORS: "TMPV",
  ATHER: "ATHERENERG",
};

type Symbol = { bseCode: string; isin: string; name: string };

interface BseHeaderData {
  CurrRate?: { LTP?: string; Chg?: string; PcChg?: string };
  Cmpname?: { FullN?: string };
  Header?: { PrevClose?: string; Open?: string; High?: string; Low?: string; Ason?: string };
}

interface ScreenerSnapshotFields {
  week52High: number | null;
  week52Low: number | null;
  eps: number | null;
  debtToEquity: number | null;
}

function writeSnapshot(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`  wrote: ${path.split("/").pop()}`);
}

function numberOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function tableValue(html: string, label: string): number | null {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<td[^>]*>[\\s\\S]{0,300}?${escapedLabel}[\\s\\S]{0,300}?<\\/td>\\s*<td[^>]*>\\s*([\\d.,-]+)`,
    "i",
  );
  return parseNumber(html.match(re)?.[1]);
}

async function fetchScreenerSnapshotFields(ticker: string): Promise<ScreenerSnapshotFields> {
  const html = await getText(`https://www.screener.in/company/${ticker}/consolidated/`);
  const range = html.match(
    /<span class="name">\s*High\s*\/\s*Low\s*<\/span>[\s\S]{0,300}?<span class="number">([\d.,]+)<\/span>\s*\/\s*<span class="number">([\d.,]+)<\/span>/i,
  );
  const borrowings = tableValue(html, "Borrowings");
  const equityCapital = tableValue(html, "Equity Capital");
  const reserves = tableValue(html, "Reserves");
  const equity = equityCapital !== null && reserves !== null ? equityCapital + reserves : null;

  return {
    week52High: parseNumber(range?.[1]),
    week52Low: parseNumber(range?.[2]),
    eps: tableValue(html, "EPS in Rs"),
    debtToEquity: borrowings !== null && equity !== null && equity > 0 ? borrowings / equity : null,
  };
}

/** BSE reports exchange timestamps in IST, e.g. `11 Sep 26 | 16:00`. */
function bseAsOf(ason: string | undefined, fallback: string): string {
  const match = ason?.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2})\s+\|\s+(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;

  const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
    .indexOf(match[2]!.toLowerCase());
  if (month < 0) return fallback;

  const iso = `20${match[3]}-${String(month + 1).padStart(2, "0")}-${match[1]!.padStart(2, "0")}T${match[4]!.padStart(2, "0")}:${match[5]}:00+05:30`;
  const timestamp = Date.parse(iso);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function display(value: number | null, suffix = ""): string {
  return value === null ? "—" : `${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${suffix}`;
}

function chunk(id: string, text: string) {
  return [{ id: `${id}_0`, text }];
}

function metric(
  key: string,
  label: string,
  value: number | null,
  sourceId: string,
  unit: string | null,
  suffix = "",
): Metric {
  return {
    key,
    label,
    value,
    display: display(value, suffix),
    unit,
    sectorMedian: null,
    direction: "unknown",
    explanation: "",
    sourceIds: [sourceId],
  };
}

function week52RangeMetric(
  high: number | null,
  low: number | null,
  last: number,
  sourceId: string,
): Metric | null {
  if (high === null || low === null || high <= low) return null;
  const position = (last - low) / (high - low);
  return {
    key: "week52_range",
    label: "52-week range",
    value: null,
    display: `₹${low.toLocaleString("en-IN")} – ₹${high.toLocaleString("en-IN")}`,
    unit: "INR",
    sectorMedian: null,
    direction: position > 0.7 ? "high" : position < 0.3 ? "low" : "normal",
    explanation: "",
    sourceIds: [sourceId],
  };
}

function hasExactScreenerSymbol(url: string, symbol: string): boolean {
  const segments = new URL(url, "https://www.screener.in").pathname.split("/").filter(Boolean);
  return segments.length >= 2 && segments[0]!.toLowerCase() === "company" && segments[1]!.toUpperCase() === symbol.toUpperCase();
}

function hasPlausibleLatestHistory(
  history: { date: string; close: number }[],
  latestPrice: number,
): boolean {
  const latest = history.at(-1);
  if (!latest || latestPrice <= 0) return false;
  const ratio = latest.close / latestPrice;
  return ratio > 0.75 && ratio < 1.25;
}

async function loadSymbols(): Promise<Record<string, Symbol>> {
  const rows = await fetchScripMaster();
  const map: Record<string, Symbol> = {};
  for (const row of rows) {
    if (!row.scrip_id || !row.SCRIP_CD) continue;
    map[row.scrip_id.toUpperCase()] = {
      bseCode: row.SCRIP_CD,
      isin: row.ISIN_NUMBER,
      name: row.Scrip_Name,
    };
  }
  // The product keeps the familiar user-facing ticker while BSE currently
  // publishes these listings under their post-listing exchange symbols.
  if (map.TMPV) map.TATAMOTORS = map.TMPV;
  if (map.ATHERENERG) map.ATHER = map.ATHERENERG;
  return map;
}

async function fetchBseQuote(bseCode: string): Promise<BseHeaderData> {
  const url = "https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w" +
    `?Debtflag=&scripcode=${encodeURIComponent(bseCode)}&seriesid=`;
  const quote = await getJson<BseHeaderData>(url, 5 * 60 * 1000);
  if (!quote.CurrRate?.LTP || !quote.Header) throw new Error(`BSE quote ${bseCode}: unexpected response`);
  return quote;
}

function bseDocument(
  ticker: string,
  bseCode: string,
  quote: BseHeaderData,
  fetchedAt: string,
  id = `bse_${ticker.toLowerCase()}_market_data`,
): SourceDocument {
  const url = "https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w" +
    `?Debtflag=&scripcode=${encodeURIComponent(bseCode)}&seriesid=`;
  const text = [
    `BSE market-data response for ${ticker}.`,
    `Fetched at: ${fetchedAt}.`,
    `BSE market timestamp: ${quote.Header?.Ason ?? "unavailable"}.`,
    `Returned values: LTP ₹${quote.CurrRate?.LTP ?? "unavailable"}; change ${quote.CurrRate?.Chg ?? "unavailable"}; change percent ${quote.CurrRate?.PcChg ?? "unavailable"}; previous close ₹${quote.Header?.PrevClose ?? "unavailable"}; open ₹${quote.Header?.Open ?? "unavailable"}; high ₹${quote.Header?.High ?? "unavailable"}; low ₹${quote.Header?.Low ?? "unavailable"}.`,
  ].join(" ");
  return {
    id,
    title: `${ticker} — BSE market data`,
    publisher: "BSE",
    tier: "market_data",
    url,
    pdfUrl: null,
    publishedAt: fetchedAt,
    tickers: [ticker],
    sectors: [],
    text,
    chunks: chunk(id, text),
  };
}

async function refreshHalMarketDocument(symbols: Record<string, Symbol>): Promise<void> {
  const symbol = symbols.HAL;
  if (!symbol) return;

  const fetchedAt = new Date().toISOString();
  const [quote, fundamentals, search, screenerFields] = await Promise.all([
    fetchBseQuote(symbol.bseCode),
    fetchFundamentals("HAL"),
    searchCompany("HAL"),
    fetchScreenerSnapshotFields("HAL"),
  ]);
  const marketData = bseDocument("HAL", symbol.bseCode, quote, fetchedAt, "bse_hal_quote");
  const fundamentalsData = screenerDocument("HAL", "HAL", fetchedAt, fundamentals, screenerFields);
  const last = numberOrNull(quote.CurrRate?.LTP);
  const change = numberOrNull(quote.CurrRate?.Chg);
  const changePct = numberOrNull(quote.CurrRate?.PcChg);

  if (last === null || change === null || changePct === null) {
    throw new Error("HAL BSE response omitted a required price value");
  }

  const exactMatch = search.find((result) => hasExactScreenerSymbol(result.url, "HAL"));
  const candidateHistory = exactMatch ? await fetchPriceHistory(exactMatch.id) : [];
  const history = hasPlausibleLatestHistory(candidateHistory, last) ? candidateHistory : [];

  const existing = JSON.parse(readFileSync(join(DATA, "stocks", "HAL.json"), "utf8")) as StockRecord;
  const stabilityRisk = existing.risk.find((risk) => risk.key === "stability" && risk.sourceIds.includes("hal_q2_presentation"));
  const record: StockRecord = {
    ...existing,
    price: {
      last,
      change,
      changePct,
      dayHigh: numberOrNull(quote.Header?.High),
      dayLow: numberOrNull(quote.Header?.Low),
      week52High: screenerFields.week52High,
      week52Low: screenerFields.week52Low,
      asOf: bseAsOf(quote.Header?.Ason, fetchedAt),
      sourceId: marketData.id,
    },
    metrics: [
      metric("previous_close", "Previous close", numberOrNull(quote.Header?.PrevClose), marketData.id, "INR", " INR"),
      metric("market_cap", "Market capitalization", fundamentals.marketCap, fundamentalsData.id, "INR crore", " Cr"),
      metric("pe", "P/E ratio", fundamentals.pe, fundamentalsData.id, null),
      metric("book_value", "Book value", fundamentals.bookValue, fundamentalsData.id, "INR"),
      metric("roce", "ROCE", fundamentals.roce, fundamentalsData.id, "%", "%"),
      metric("roe", "ROE", fundamentals.roe, fundamentalsData.id, "%", "%"),
      metric("dividend_yield", "Dividend yield", fundamentals.dividendYield, fundamentalsData.id, "%", "%"),
      metric("eps", "EPS", screenerFields.eps, fundamentalsData.id, "INR"),
      metric("debt_to_equity", "Debt to equity", screenerFields.debtToEquity, fundamentalsData.id, null),
      ...[week52RangeMetric(screenerFields.week52High, screenerFields.week52Low, last, fundamentalsData.id)].filter(
        (entry): entry is Metric => entry !== null,
      ),
    ],
    history,
    sectorMedians: {},
    risk: stabilityRisk ? [{
      ...stabilityRisk,
      reason: "A majority of its order book comes from domestic defence programmes.",
    }] : [],
    documentIds: [...new Set([...existing.documentIds, marketData.id, fundamentalsData.id])],
  };

  writeSnapshot(join(DATA, "documents", "bse_hal_quote.json"), marketData);
  writeSnapshot(join(DATA, "documents", `${fundamentalsData.id}.json`), fundamentalsData);
  writeSnapshot(join(DATA, "stocks", "HAL.json"), record);
}

function screenerDocument(
  ticker: string,
  screenerTicker: string,
  fetchedAt: string,
  values: Awaited<ReturnType<typeof fetchFundamentals>>,
  fields: ScreenerSnapshotFields,
): SourceDocument {
  const id = ticker === "HAL"
    ? "screener_hal_snapshot_fundamentals"
    : `screener_${ticker.toLowerCase()}_fundamentals`;
  const url = `https://www.screener.in/company/${screenerTicker}/consolidated/`;
  const entries = [
    ["Market Cap (₹ Cr)", values.marketCap],
    ["Stock P/E", values.pe],
    ["Book Value", values.bookValue],
    ["ROCE (%)", values.roce],
    ["ROE (%)", values.roe],
    ["Dividend Yield (%)", values.dividendYield],
    ["52-week high (₹)", fields.week52High],
    ["52-week low (₹)", fields.week52Low],
    ["EPS (₹)", fields.eps],
    ["Debt to equity", fields.debtToEquity],
  ].map(([label, value]) => `${label}: ${value ?? "unavailable"}`).join("; ");
  const text = `Screener.in consolidated fundamentals for ${ticker}. Fetched at: ${fetchedAt}. Returned values: ${entries}.`;
  return {
    id,
    title: `${ticker} — Screener fundamentals`,
    publisher: "Screener.in",
    tier: "market_data",
    url,
    pdfUrl: null,
    publishedAt: fetchedAt,
    tickers: [ticker],
    sectors: [],
    text,
    chunks: chunk(id, text),
  };
}

const MEDIAN_KEYS = ["pe", "roe", "roce", "dividend_yield", "market_cap", "debt_to_equity"] as const;

function median(values: number[]): number | null {
  if (values.length < 2) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function metricValue(stock: StockRecord, key: string): Metric | undefined {
  return stock.metrics.find((entry) => entry.key === key);
}

function sourceIdsFor(stock: StockRecord, key: string): string[] {
  return metricValue(stock, key)?.sourceIds ?? [];
}

function relativeRiskLevel(value: number, medianValue: number): "low" | "medium" | "high" {
  if (value > medianValue * 1.3) return "high";
  if (value < medianValue * 0.8) return "low";
  return "medium";
}

function derivedRisk(stock: StockRecord): StockRecord["risk"] {
  const risks: StockRecord["risk"] = [];
  const { week52High: high, week52Low: low } = stock.price;
  const screenerSources = sourceIdsFor(stock, "week52_range");
  if (high !== null && low !== null && low > 0 && screenerSources.length) {
    const swing = (high - low) / low;
    risks.push({
      key: "volatility",
      label: "Price volatility",
      level: swing > 0.7 ? "high" : swing > 0.35 ? "medium" : "low",
      reason: `The price moved between ₹${low.toLocaleString("en-IN")} and ₹${high.toLocaleString("en-IN")} over 52 weeks — a swing of about ${Math.round(swing * 100)}% from its low.`,
      sourceIds: screenerSources,
    });
  }

  const pe = metricValue(stock, "pe");
  const peMedian = stock.sectorMedians.pe;
  if (pe?.value !== null && pe?.value !== undefined && peMedian !== undefined && pe.sourceIds.length) {
    risks.push({
      key: "valuation",
      label: "Valuation",
      level: relativeRiskLevel(pe.value, peMedian),
      reason: `P/E is ${pe.value}, compared with a sector median of ${peMedian}.`,
      sourceIds: pe.sourceIds,
    });
  }

  const debt = metricValue(stock, "debt_to_equity");
  const debtMedian = stock.sectorMedians.debt_to_equity;
  if (debt?.value !== null && debt?.value !== undefined && debtMedian !== undefined && debt.sourceIds.length) {
    risks.push({
      key: "debt",
      label: "Debt",
      level: relativeRiskLevel(debt.value, debtMedian),
      reason: `Debt to equity is ${debt.value.toFixed(2)}, compared with a sector median of ${debtMedian.toFixed(2)}.`,
      sourceIds: debt.sourceIds,
    });
  }

  const roe = metricValue(stock, "roe");
  if (roe?.value !== null && roe?.value !== undefined && roe.sourceIds.length) {
    risks.push({
      key: "stability",
      label: "Business returns",
      level: roe.value > 18 ? "low" : roe.value > 10 ? "medium" : "high",
      reason: `Return on equity is ${roe.value}%, showing how much profit the business earned from shareholders' money.`,
      sourceIds: roe.sourceIds,
    });
  }

  return risks;
}

function applyDerivedStockData(): void {
  const stocks = readdirSync(join(DATA, "stocks"))
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(join(DATA, "stocks", file), "utf8")) as StockRecord);
  const mediansBySector = new Map<string, Record<string, number>>();

  for (const sector of new Set(stocks.map((stock) => stock.sector))) {
    const peers = stocks.filter((stock) => stock.sector === sector);
    const medians: Record<string, number> = {};
    for (const key of MEDIAN_KEYS) {
      const values = peers
        .map((stock) => metricValue(stock, key)?.value ?? null)
        .filter((value): value is number => value !== null);
      const value = median(values);
      if (value !== null) medians[key] = value;
    }
    mediansBySector.set(sector, medians);
  }

  for (const stock of stocks) {
    const sectorMedians = mediansBySector.get(stock.sector) ?? {};
    stock.sectorMedians = sectorMedians;
    stock.metrics = stock.metrics.map((entry) => {
      if (entry.key === "week52_range") return entry;
      const sectorMedian = sectorMedians[entry.key] ?? null;
      return {
        ...entry,
        sectorMedian,
        direction: entry.value === null || sectorMedian === null
          ? "unknown"
          : entry.value > sectorMedian * 1.15
            ? "high"
            : entry.value < sectorMedian * 0.85
              ? "low"
              : "normal",
      };
    });
    stock.risk = derivedRisk(stock);
    writeSnapshot(join(DATA, "stocks", `${stock.ticker}.json`), stock);
  }
}

async function step2_stocks(): Promise<void> {
  console.log("\n[1] Building BSE and Screener fallback records");
  const symbols = await loadSymbols();

  for (const ticker of COVERED) {
    if (ticker === "HAL") {
      console.log("  defer hand-authored stock: HAL");
      continue;
    }

    const symbol = symbols[ticker];
    if (!symbol) {
      console.log(`  ${ticker}: unavailable — no BSE symbol-map entry`);
      continue;
    }

    try {
      const fetchedAt = new Date().toISOString();
      const screenerTicker = SCREENER_TICKERS[ticker] ?? ticker;
      const [quote, fundamentals, search, screenerFields] = await Promise.all([
        fetchBseQuote(symbol.bseCode),
        fetchFundamentals(screenerTicker),
        searchCompany(screenerTicker),
        fetchScreenerSnapshotFields(screenerTicker),
      ]);
      const bseDoc = bseDocument(ticker, symbol.bseCode, quote, fetchedAt);
      const fundamentalsDoc = screenerDocument(ticker, screenerTicker, fetchedAt, fundamentals, screenerFields);
      const last = numberOrNull(quote.CurrRate?.LTP);
      const change = numberOrNull(quote.CurrRate?.Chg);
      const changePct = numberOrNull(quote.CurrRate?.PcChg);

      if (last === null || change === null || changePct === null) {
        throw new Error("BSE response omitted a required price value");
      }

      const exactMatch = search.find((result) => hasExactScreenerSymbol(result.url, screenerTicker));
      const candidateHistory = exactMatch ? await fetchPriceHistory(exactMatch.id) : [];
      const history = hasPlausibleLatestHistory(candidateHistory, last) ? candidateHistory : [];

      const record: StockRecord = {
        ticker,
        bseCode: symbol.bseCode,
        isin: symbol.isin || null,
        name: quote.Cmpname?.FullN || symbol.name,
        sector: "Unclassified",
        business: `This committed fallback covers the BSE-listed company named ${quote.Cmpname?.FullN || symbol.name}. Detailed business information is unavailable in this fallback.`,
        price: {
          last,
          change,
          changePct,
          dayHigh: numberOrNull(quote.Header?.High),
          dayLow: numberOrNull(quote.Header?.Low),
          week52High: screenerFields.week52High,
          week52Low: screenerFields.week52Low,
          asOf: bseAsOf(quote.Header?.Ason, fetchedAt),
          sourceId: bseDoc.id,
        },
        metrics: [
          metric("previous_close", "Previous close", numberOrNull(quote.Header?.PrevClose), bseDoc.id, "INR", " INR"),
          metric("market_cap", "Market capitalization", fundamentals.marketCap, fundamentalsDoc.id, "INR crore", " Cr"),
          metric("pe", "P/E ratio", fundamentals.pe, fundamentalsDoc.id, null),
          metric("book_value", "Book value", fundamentals.bookValue, fundamentalsDoc.id, "INR"),
          metric("roce", "ROCE", fundamentals.roce, fundamentalsDoc.id, "%", "%"),
          metric("roe", "ROE", fundamentals.roe, fundamentalsDoc.id, "%", "%"),
          metric("dividend_yield", "Dividend yield", fundamentals.dividendYield, fundamentalsDoc.id, "%", "%"),
          metric("eps", "EPS", screenerFields.eps, fundamentalsDoc.id, "INR"),
          metric("debt_to_equity", "Debt to equity", screenerFields.debtToEquity, fundamentalsDoc.id, null),
          ...[week52RangeMetric(screenerFields.week52High, screenerFields.week52Low, last, fundamentalsDoc.id)].filter(
            (entry): entry is Metric => entry !== null,
          ),
        ],
        history,
        sectorMedians: {},
        risk: [],
        documentIds: [bseDoc.id, fundamentalsDoc.id],
        newsIds: [],
      };

      writeSnapshot(join(DATA, "documents", `${bseDoc.id}.json`), bseDoc);
      writeSnapshot(join(DATA, "documents", `${fundamentalsDoc.id}.json`), fundamentalsDoc);
      writeSnapshot(join(DATA, "stocks", `${ticker}.json`), record);
    } catch (error) {
      console.log(`  ${ticker}: FAILED — ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  // HAL's curated stock content is intentionally left untouched; only the
  // market-data citation is refreshed with the documented BSE response.
  await refreshHalMarketDocument(symbols);
  applyDerivedStockData();

  writeSnapshot(join(DATA, "index.json"), {
    generatedAt: new Date().toISOString(),
    stocks: COVERED,
    note: "Committed 20-stock fallback. Quotes are from BSE; fundamentals are from Screener.in.",
  });
}

async function main(): Promise<void> {
  mkdirSync(join(DATA, "stocks"), { recursive: true });
  mkdirSync(join(DATA, "documents"), { recursive: true });
  await step2_stocks();
  console.log(`\nDone. ${COVERED.length} tickers targeted.`);
}

void main();
