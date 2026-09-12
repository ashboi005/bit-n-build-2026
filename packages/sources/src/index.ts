/**
 * The sources package. This is what the engine calls.
 *
 * Today: keyword search over the committed snapshot.
 * Next:  vector search via Qdrant (see vector.ts) with this as the fallback.
 *
 * The interface never changes, so swapping the search implementation touches
 * exactly one function.
 */

import type {
  GlossaryEntry,
  SearchHit,
  SearchOptions,
  SourceDocument,
  SourcesApi,
  StockRecord,
  StockSummary,
} from "@bit-n-build-2026/contracts";

import { loadSnapshot } from "./snapshot";

const snapshot = loadSnapshot();

/** Name/alias -> ticker. Extend as stocks are added. */
const ALIASES: Record<string, string> = {};
for (const [ticker, stock] of snapshot.stocks) {
  ALIASES[ticker.toLowerCase()] = ticker;
  ALIASES[stock.name.toLowerCase()] = ticker;
  // "Hindustan Aeronautics Ltd" -> also match "hindustan aeronautics"
  ALIASES[stock.name.toLowerCase().replace(/\s+(ltd|limited)\.?$/, "")] = ticker;
}

const STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "from", "will", "should", "have",
  "because", "about", "into", "than", "then", "they", "there", "want", "buy",
]);

export const sources: SourcesApi = {
  listStocks(): StockSummary[] {
    return [...snapshot.stocks.values()].map((s) => ({
      ticker: s.ticker,
      name: s.name,
      sector: s.sector,
      last: s.price?.last ?? null,
      changePct: s.price?.changePct ?? null,
    }));
  },

  getStock(ticker: string): StockRecord | null {
    return snapshot.stocks.get(ticker.toUpperCase()) ?? null;
  },

  getDocument(id: string): SourceDocument | null {
    return snapshot.documents.get(id) ?? null;
  },

  /**
   * Keyword scoring over document chunks.
   *
   * TODO(ashwath): swap for vector search once Qdrant is up. Keep this as the
   * fallback path — if Qdrant is unreachable at demo time, search degrades to
   * this rather than failing.
   */
  searchSources(query: string, opts: SearchOptions = {}): SearchHit[] {
    const terms = query
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 3 && !STOPWORDS.has(t));

    const hits: SearchHit[] = [];

    for (const doc of snapshot.documents.values()) {
      if (opts.tickers?.length && !opts.tickers.some((t) => doc.tickers.includes(t))) continue;
      if (opts.sectors?.length && !opts.sectors.some((s) => doc.sectors.includes(s))) continue;
      if (opts.tiers?.length && !opts.tiers.includes(doc.tier)) continue;

      for (const chunk of doc.chunks) {
        const haystack = `${doc.title} ${chunk.text}`.toLowerCase();
        const score = terms.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);

        // A company's own filings are always relevant context, even on a zero
        // keyword score — otherwise a vaguely-worded thesis retrieves nothing.
        const tickerMatch = opts.tickers?.some((t) => doc.tickers.includes(t)) ?? false;
        if (score > 0 || tickerMatch) {
          hits.push({ chunkId: chunk.id, docId: doc.id, text: chunk.text, score: score + 0.1 });
        }
      }
    }

    return hits.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 8);
  },

  getGlossary(term: string): GlossaryEntry | null {
    return snapshot.glossary.get(term.toLowerCase()) ?? null;
  },

  resolveTicker(text: string): { ticker: string; name: string } | null {
    const lower = text.toLowerCase().trim();

    const direct = snapshot.stocks.get(text.toUpperCase());
    if (direct) return { ticker: direct.ticker, name: direct.name };

    for (const [alias, ticker] of Object.entries(ALIASES)) {
      if (lower.includes(alias)) {
        const stock = snapshot.stocks.get(ticker);
        if (stock) return { ticker: stock.ticker, name: stock.name };
      }
    }
    return null;
  },
};

export { loadSnapshot } from "./snapshot";

// Namespaced: BSE and NSE both export fetchAnnouncements with different shapes.
export * as bse from "./fetchers/bse";
export * as nse from "./fetchers/nse";
export * as screener from "./fetchers/screener";
export * as rss from "./fetchers/rss";
