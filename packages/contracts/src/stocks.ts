/**
 * Stock, document and glossary contracts.
 *
 * `packages/sources` produces these. `apps/server` serves them.
 * `apps/web` renders them. Nobody invents fields outside this file.
 */

import type { Level, Metric, SourceTier } from "./thesis";

export interface StockSummary {
  ticker: string;
  name: string;
  sector: string;
  /** Latest price, for list rows. */
  last: number | null;
  changePct: number | null;
}

export interface PricePoint {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  close: number;
}

export interface PriceSnapshot {
  last: number;
  change: number;
  changePct: number;
  dayHigh: number | null;
  dayLow: number | null;
  week52High: number | null;
  week52Low: number | null;
  /** ISO timestamp. */
  asOf: string;
  sourceId: string;
}

export type RiskLevel = "low" | "medium" | "high" | "unknown";

/**
 * A risk dimension ALWAYS carries its reason and its sources.
 * A bare score with no reason is the exact thing this product argues against.
 */
export interface RiskFactor {
  key: "volatility" | "debt" | "valuation" | "stability";
  label: string;
  level: RiskLevel;
  /** Plain English, one sentence. */
  reason: string;
  sourceIds: string[];
}

export interface StockRecord {
  /** NSE symbol. Our canonical id everywhere. */
  ticker: string;
  bseCode: string | null;
  isin: string | null;
  name: string;
  sector: string;
  /** Two plain-English sentences. No jargon. */
  business: string;
  price: PriceSnapshot;
  metrics: Metric[];
  history: PricePoint[];
  /** e.g. { pe: 19.2, debt_to_equity: 0.4 } — needed for "compared to its sector" lines. */
  sectorMedians: Record<string, number>;
  risk: RiskFactor[];
  documentIds: string[];
  newsIds: string[];
}

/** A filing, announcement, government release or news article. */
export interface SourceDocument {
  id: string;
  title: string;
  publisher: string;
  tier: SourceTier;
  url: string | null;
  pdfUrl: string | null;
  /** ISO date. */
  publishedAt: string | null;
  /** Which companies this touches. */
  tickers: string[];
  sectors: string[];
  text: string;
  chunks: DocumentChunk[];
}

export interface DocumentChunk {
  id: string;
  text: string;
}

export interface SearchHit {
  chunkId: string;
  docId: string;
  text: string;
  score: number;
}

export interface SearchOptions {
  tickers?: string[];
  sectors?: string[];
  tiers?: SourceTier[];
  limit?: number;
}

export interface GlossaryEntry {
  key: string;
  term: string;
  oneLiner: string;
  /** One explanation per level. The server picks the right one. */
  byLevel: Record<Level, string>;
  related: string[];
}

/** The interface `packages/sources` exports. Ashwath calls this; Tushar implements it. */
export interface SourcesApi {
  listStocks(): StockSummary[];
  getStock(ticker: string): StockRecord | null;
  getDocument(id: string): SourceDocument | null;
  searchSources(query: string, opts?: SearchOptions): SearchHit[];
  getGlossary(term: string): GlossaryEntry | null;
  resolveTicker(text: string): { ticker: string; name: string } | null;
}
