/** Loads committed source data and optional local upgrades synchronously. */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { dataPath } from "./paths";

import type { GlossaryEntry, SourceDocument, StockRecord } from "@bit-n-build-2026/contracts";

const DATA_DIR = dataPath("snapshot");
const LIBRARY_DIR = dataPath("library");
const NORMALIZED_CACHE_DIR = dataPath("../.cache/snapshot");
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface Snapshot {
  stocks: Map<string, StockRecord>;
  documents: Map<string, SourceDocument>;
  /** Curated documents only, retained for result ranking by the index layer. */
  libraryDocuments: Map<string, SourceDocument>;
  glossary: Map<string, GlossaryEntry>;
}

export interface LoadSnapshotOptions {
  libraryDir?: string;
  snapshotDir?: string;
  cacheDir?: string;
  now?: Date;
}

interface CachedStockEntry {
  fetchedAt: string;
  stock: StockRecord;
  documents: SourceDocument[];
}

interface CachedDocumentEntry {
  fetchedAt: string;
  document: SourceDocument;
}

function loadDir<T>(baseDir: string | undefined, subDir: string): T[] {
  if (!baseDir) return [];
  const dir = join(baseDir, subDir);
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((file) => file.endsWith(".json"))
      .flatMap((file) => {
        try {
          return [JSON.parse(readFileSync(join(dir, file), "utf8")) as T];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function loadFile<T>(baseDir: string | undefined, name: string, fallback: T): T {
  if (!baseDir) return fallback;
  const path = join(baseDir, name);
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStockRecord(value: unknown): value is StockRecord {
  if (
    !isObject(value) ||
    typeof value.ticker !== "string" ||
    typeof value.name !== "string" ||
    typeof value.sector !== "string" ||
    typeof value.business !== "string" ||
    !isNullableString(value.bseCode) ||
    !isNullableString(value.isin) ||
    !isPriceSnapshot(value.price) ||
    !Array.isArray(value.metrics) ||
    !value.metrics.every(isMetric) ||
    !Array.isArray(value.history) ||
    !value.history.every(isPricePoint) ||
    !isNumberRecord(value.sectorMedians) ||
    !Array.isArray(value.risk) ||
    !value.risk.every(isRiskFactor) ||
    !isStringArray(value.documentIds) ||
    !isStringArray(value.newsIds)
  ) {
    return false;
  }
  return true;
}

function isPriceSnapshot(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    isFiniteNumber(value.last) &&
    isFiniteNumber(value.change) &&
    isFiniteNumber(value.changePct) &&
    isNullableNumber(value.dayHigh) &&
    isNullableNumber(value.dayLow) &&
    isNullableNumber(value.week52High) &&
    isNullableNumber(value.week52Low) &&
    isTimestamp(value.asOf) &&
    isNonEmptyString(value.sourceId)
  );
}

function isMetric(value: unknown): boolean {
  return (
    isObject(value) &&
    isNonEmptyString(value.key) &&
    typeof value.label === "string" &&
    isNullableNumber(value.value) &&
    typeof value.display === "string" &&
    isNullableString(value.unit) &&
    isNullableNumber(value.sectorMedian) &&
    (value.direction === "high" || value.direction === "low" || value.direction === "normal" || value.direction === "unknown") &&
    typeof value.explanation === "string" &&
    hasSourceIds(value) &&
    value.sourceIds.length > 0
  );
}

function isRiskFactor(value: unknown): boolean {
  return (
    isObject(value) &&
    (value.key === "volatility" || value.key === "debt" || value.key === "valuation" || value.key === "stability") &&
    typeof value.label === "string" &&
    (value.level === "low" || value.level === "medium" || value.level === "high" || value.level === "unknown") &&
    typeof value.reason === "string" &&
    hasSourceIds(value) &&
    value.sourceIds.length > 0
  );
}

function isPricePoint(value: unknown): boolean {
  return isObject(value) && isNonEmptyString(value.date) && isFiniteNumber(value.close);
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isObject(value) && Object.values(value).every(isFiniteNumber);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isSourceDocument(value: unknown): value is SourceDocument {
  if (
    !isObject(value) ||
    !isNonEmptyString(value.id) ||
    typeof value.title !== "string" ||
    typeof value.publisher !== "string" ||
    typeof value.text !== "string" ||
    !isSourceTier(value.tier) ||
    !isNullableString(value.url) ||
    !isNullableString(value.pdfUrl) ||
    !isNullableString(value.publishedAt) ||
    !isStringArray(value.tickers) ||
    !isStringArray(value.sectors) ||
    !Array.isArray(value.chunks)
  ) {
    return false;
  }
  return value.chunks.every(
    (chunk) => isObject(chunk) && isNonEmptyString(chunk.id) && isNonEmptyString(chunk.text),
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSourceTier(value: unknown): boolean {
  return value === "official" || value === "filing" || value === "press" || value === "market_data" || value === "social";
}

function isGlossaryEntry(value: unknown): value is GlossaryEntry {
  const byLevel = isObject(value) ? value.byLevel : undefined;
  if (
    !isObject(value) ||
    typeof value.key !== "string" ||
    typeof value.term !== "string" ||
    typeof value.oneLiner !== "string" ||
    !Array.isArray(value.related) ||
    !value.related.every((term) => typeof term === "string") ||
    !isObject(byLevel)
  ) {
    return false;
  }
  return ["new", "learning", "practicing", "independent"].every(
    (level) => typeof byLevel[level] === "string",
  );
}

function hasSourceIds(value: unknown): value is { sourceIds: string[] } {
  return isObject(value) && Array.isArray(value.sourceIds) && value.sourceIds.every(isNonEmptyString);
}

function isCitableCachedStock(value: StockRecord): boolean {
  return (
    isObject(value.price) &&
    typeof value.price.sourceId === "string" &&
    Array.isArray(value.metrics) &&
    value.metrics.every(hasSourceIds) &&
    Array.isArray(value.risk) &&
    value.risk.every(hasSourceIds)
  );
}

function isFresh(fetchedAt: unknown, now: Date): fetchedAt is string {
  if (typeof fetchedAt !== "string") return false;
  const fetchedAtMs = Date.parse(fetchedAt);
  const ageMs = now.getTime() - fetchedAtMs;
  return Number.isFinite(fetchedAtMs) && ageMs >= 0 && ageMs <= CACHE_TTL_MS;
}

function isCachedStockEntry(value: unknown, now: Date): value is CachedStockEntry {
  return (
    isObject(value) &&
    isFresh(value.fetchedAt, now) &&
    isStockRecord(value.stock) &&
    isCitableCachedStock(value.stock) &&
    Array.isArray(value.documents) &&
    value.documents.every(isCitableCachedDocument)
  );
}

function isCachedDocumentEntry(value: unknown, now: Date): value is CachedDocumentEntry {
  return isObject(value) && isFresh(value.fetchedAt, now) && isCitableCachedDocument(value.document);
}

function isCitableCachedDocument(value: unknown): value is SourceDocument {
  return isSourceDocument(value) && isUsableUrl(value.url) && isTimestamp(value.publishedAt);
}

function isUsableUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sourceIds(stock: StockRecord): string[] {
  return [
    stock.price.sourceId,
    ...stock.metrics.flatMap((metric) => metric.sourceIds),
    ...stock.risk.flatMap((risk) => risk.sourceIds),
  ].filter((sourceId): sourceId is string => typeof sourceId === "string" && sourceId.length > 0);
}

function hasCitableSources(entry: CachedStockEntry): boolean {
  const documentIds = new Set(entry.documents.map((document) => document.id));
  return sourceIds(entry.stock).every((sourceId) => documentIds.has(sourceId));
}

function documentsMatch(primary: SourceDocument, fallback: SourceDocument): boolean {
  return stableJson(primary) === stableJson(fallback);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hasIncompatibleSourceIds(
  sourceIds: string[],
  primaryDocuments: Map<string, SourceDocument>,
  fallbackDocuments: Map<string, SourceDocument>,
): boolean {
  return sourceIds.some((sourceId) => {
    const primaryDocument = primaryDocuments.get(sourceId);
    const fallbackDocument = fallbackDocuments.get(sourceId);
    return primaryDocument !== undefined && fallbackDocument !== undefined && !documentsMatch(primaryDocument, fallbackDocument);
  });
}

function hasIncompatibleCitation(
  fallback: StockRecord["metrics"][number],
  primaryDocuments: Map<string, SourceDocument>,
  fallbackDocuments: Map<string, SourceDocument>,
): boolean {
  return hasIncompatibleSourceIds(fallback.sourceIds, primaryDocuments, fallbackDocuments);
}

function compatibleFallbackStock(
  stock: StockRecord,
  higherDocuments: Map<string, SourceDocument>,
  layerDocuments: Map<string, SourceDocument>,
): StockRecord | null {
  const riskSourceIds = stock.risk.flatMap((risk) => risk.sourceIds);
  if (
    hasIncompatibleSourceIds([stock.price.sourceId], higherDocuments, layerDocuments) ||
    hasIncompatibleSourceIds(riskSourceIds, higherDocuments, layerDocuments)
  ) {
    return null;
  }
  return {
    ...stock,
    metrics: stock.metrics.filter(
      (metric) => !hasIncompatibleCitation(metric, higherDocuments, layerDocuments),
    ),
  };
}

function compatibleFallbackForExistingStock(
  stock: StockRecord,
  higherDocuments: Map<string, SourceDocument>,
  layerDocuments: Map<string, SourceDocument>,
): StockRecord {
  return {
    ...stock,
    metrics: stock.metrics.filter(
      (metric) => !hasIncompatibleCitation(metric, higherDocuments, layerDocuments),
    ),
  };
}

function mergeStock(
  primary: StockRecord,
  fallback: StockRecord,
  primaryDocuments: Map<string, SourceDocument>,
  fallbackDocuments: Map<string, SourceDocument>,
): StockRecord {
  const metricKeys = new Set(primary.metrics.map((metric) => metric.key));
  const fallbackMetrics = new Map(fallback.metrics.map((metric) => [metric.key, metric]));
  const primaryMetrics = primary.metrics.map((metric) => {
    const fallbackMetric = fallbackMetrics.get(metric.key);
    return metric.value === null && fallbackMetric && fallbackMetric.value !== null &&
      !hasIncompatibleCitation(fallbackMetric, primaryDocuments, fallbackDocuments)
      ? fallbackMetric
      : metric;
  });
  const missingMetrics = fallback.metrics.filter(
    (metric) => !metricKeys.has(metric.key) && !hasIncompatibleCitation(metric, primaryDocuments, fallbackDocuments),
  );
  const fallbackRisks = new Map(fallback.risk.map((risk) => [risk.key, risk]));
  const primaryRiskKeys = new Set(primary.risk.map((risk) => risk.key));
  const mergedRisks = primary.risk.map((risk) => fallbackRisks.get(risk.key) ?? risk);
  const missingRisks = fallback.risk.filter((risk) => !primaryRiskKeys.has(risk.key));
  return {
    ...primary,
    price: {
      ...primary.price,
      dayHigh: primary.price.dayHigh ?? fallback.price.dayHigh,
      dayLow: primary.price.dayLow ?? fallback.price.dayLow,
      week52High: primary.price.week52High ?? fallback.price.week52High,
      week52Low: primary.price.week52Low ?? fallback.price.week52Low,
    },
    history: primary.history.length === 0 && fallback.history.length > 0 ? fallback.history : primary.history,
    metrics: [...primaryMetrics, ...missingMetrics],
    risk: [...mergedRisks, ...missingRisks],
  };
}

function addStocks(
  stocks: Map<string, StockRecord>,
  stockDocuments: Map<string, Map<string, SourceDocument>>,
  layer: StockRecord[],
  higherDocuments: Map<string, SourceDocument>,
  layerDocuments: Map<string, SourceDocument>,
  winningDocuments: Map<string, SourceDocument>,
): void {
  for (const stock of layer) {
    if (!isStockRecord(stock)) continue;
    const ticker = stock.ticker.toUpperCase();
    const existing = stocks.get(ticker);
    if (existing) {
      const compatibleStock = compatibleFallbackForExistingStock(stock, higherDocuments, layerDocuments);
      stocks.set(ticker, mergeStock(existing, compatibleStock, stockDocuments.get(ticker) ?? new Map(), layerDocuments));
    } else {
      const compatibleStock = compatibleFallbackStock(stock, higherDocuments, layerDocuments);
      if (!compatibleStock) continue;
      stocks.set(ticker, compatibleStock);
      stockDocuments.set(ticker, new Map(winningDocuments));
    }
  }
}

function addDocuments(documents: Map<string, SourceDocument>, layer: SourceDocument[]): void {
  for (const document of layer) {
    if (isSourceDocument(document) && !documents.has(document.id)) documents.set(document.id, document);
  }
}

function addGlossaryEntries(glossary: Map<string, GlossaryEntry>, entries: unknown): void {
  if (!Array.isArray(entries)) return;
  for (const entry of entries) {
    if (!isGlossaryEntry(entry)) continue;
    const key = entry.key.toLowerCase();
    if (!glossary.has(key)) glossary.set(key, entry);
  }
}

/** Loads the committed layers and the dedicated normalized cache synchronously. */
export function loadSnapshot(options: LoadSnapshotOptions = {}): Snapshot {
  const snapshotDir = options.snapshotDir ?? DATA_DIR;
  const libraryDir = options.libraryDir ?? LIBRARY_DIR;
  const cacheDir = options.cacheDir ?? NORMALIZED_CACHE_DIR;
  const now = options.now ?? new Date();
  const libraryStocks = loadDir<StockRecord>(libraryDir, "stocks");
  const snapshotStocks = loadDir<StockRecord>(snapshotDir, "stocks");
  const libraryDocs = loadDir<SourceDocument>(libraryDir, "documents");
  const snapshotDocs = loadDir<SourceDocument>(snapshotDir, "documents");

  // Only normalized cache subdirectories are read; the raw HTTP cache is ignored.
  const cachedStockEntries = loadDir<unknown>(cacheDir, "stocks")
    .filter((entry): entry is CachedStockEntry => isCachedStockEntry(entry, now))
    .filter(hasCitableSources);
  const cachedDocumentEntries = loadDir<unknown>(cacheDir, "documents")
    .filter((entry): entry is CachedDocumentEntry => isCachedDocumentEntry(entry, now));

  const libraryDocuments = new Map<string, SourceDocument>();
  addDocuments(libraryDocuments, libraryDocs);
  const snapshotDocuments = new Map<string, SourceDocument>();
  addDocuments(snapshotDocuments, snapshotDocs);
  const cacheDocuments = new Map<string, SourceDocument>();
  addDocuments(cacheDocuments, cachedStockEntries.flatMap((entry) => entry.documents));
  addDocuments(cacheDocuments, cachedDocumentEntries.map((entry) => entry.document));

  const libraryAndSnapshotDocuments = new Map(libraryDocuments);
  addDocuments(libraryAndSnapshotDocuments, snapshotDocs);

  const stocks = new Map<string, StockRecord>();
  const stockDocuments = new Map<string, Map<string, SourceDocument>>();
  addStocks(stocks, stockDocuments, libraryStocks, new Map(), libraryDocuments, libraryDocuments);
  addStocks(stocks, stockDocuments, snapshotStocks, libraryDocuments, snapshotDocuments, libraryAndSnapshotDocuments);
  const winningDocuments = new Map(libraryAndSnapshotDocuments);
  for (const entry of cachedStockEntries) {
    const entryDocuments = new Map<string, SourceDocument>();
    addDocuments(entryDocuments, entry.documents);
    const documentsAfterEntry = new Map(winningDocuments);
    addDocuments(documentsAfterEntry, entry.documents);
    addStocks(stocks, stockDocuments, [entry.stock], winningDocuments, entryDocuments, documentsAfterEntry);
    addDocuments(winningDocuments, entry.documents);
  }

  const documents = new Map<string, SourceDocument>();
  addDocuments(documents, libraryDocs);
  addDocuments(documents, snapshotDocs);
  addDocuments(documents, [...cacheDocuments.values()]);

  const glossary = new Map<string, GlossaryEntry>();
  addGlossaryEntries(glossary, loadFile<unknown>(libraryDir, "glossary.json", []));
  addGlossaryEntries(glossary, loadFile<unknown>(snapshotDir, "glossary.json", []));

  return { stocks, documents, libraryDocuments, glossary };
}
