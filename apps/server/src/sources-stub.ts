/**
 * TEMPORARY sources implementation.
 *
 * ⚠️ Placeholder data. Replace this whole file with `packages/sources` the moment
 * Tushar's snapshot lands — swap the import in services.ts, nothing else changes.
 * This exists so the SSE endpoint is runnable and demoable today.
 */

import type {
  GlossaryEntry,
  SearchHit,
  SearchOptions,
  SourceDocument,
  StockRecord,
  StockSummary,
} from "@bit-n-build-2026/contracts";
import type { SourcesPort } from "@bit-n-build-2026/engine";

const DOCUMENTS: SourceDocument[] = [
  {
    id: "pib_budget_defence",
    title: "Union Budget 2026-27: Defence allocation raised",
    publisher: "PIB",
    tier: "official",
    url: "https://www.pib.gov.in/",
    pdfUrl: null,
    publishedAt: "2026-02-01",
    tickers: ["HAL", "BEL"],
    sectors: ["defence"],
    text: "The allocation to the Ministry of Defence has been increased over the previous financial year, with a higher share directed to capital acquisition.",
    chunks: [
      {
        id: "pib_budget_defence_0",
        text: "The allocation to the Ministry of Defence has been increased over the previous financial year, with a higher share directed to capital acquisition.",
      },
    ],
  },
  {
    id: "hal_q2_presentation",
    title: "HAL Q2 FY26 Investor Presentation",
    publisher: "Hindustan Aeronautics Ltd",
    tier: "filing",
    url: null,
    pdfUrl: null,
    publishedAt: "2026-07-28",
    tickers: ["HAL"],
    sectors: ["defence"],
    text: "Order book stood at a multi-year high, with the majority of orders originating from domestic defence programmes.",
    chunks: [
      {
        id: "hal_q2_presentation_0",
        text: "Order book stood at a multi-year high, with the majority of orders originating from domestic defence programmes.",
      },
    ],
  },
  {
    id: "bs_defence_priced_in",
    title: "Defence stocks: how much of the budget story is already in the price?",
    publisher: "Business Standard",
    tier: "press",
    url: "https://www.business-standard.com/",
    pdfUrl: null,
    publishedAt: "2026-08-14",
    tickers: ["HAL", "BEL"],
    sectors: ["defence"],
    text: "Analysts note that defence counters have already re-rated sharply, and that budget expectations were largely anticipated by the market.",
    chunks: [
      {
        id: "bs_defence_priced_in_0",
        text: "Analysts note that defence counters have already re-rated sharply, and that budget expectations were largely anticipated by the market.",
      },
    ],
  },
  {
    id: "bse_hal_quote",
    title: "HAL — market data snapshot",
    publisher: "BSE",
    tier: "market_data",
    url: "https://www.bseindia.com/",
    pdfUrl: null,
    publishedAt: "2026-09-11",
    tickers: ["HAL"],
    sectors: ["defence"],
    text: "Last traded price, 52-week range and valuation ratios as of close.",
    chunks: [
      {
        id: "bse_hal_quote_0",
        text: "Last traded price, 52-week range and valuation ratios as of close.",
      },
    ],
  },
];

const STOCKS: Record<string, StockRecord> = {
  HAL: {
    ticker: "HAL",
    bseCode: "541154",
    isin: "INE066F01020",
    name: "Hindustan Aeronautics Ltd",
    sector: "Defence",
    business:
      "Hindustan Aeronautics designs and builds aircraft, helicopters and aero-engines. Almost all of its work comes from Indian defence programmes.",
    price: {
      last: 2104.5,
      change: 12.3,
      changePct: 0.59,
      dayHigh: 2128,
      dayLow: 2081,
      week52High: 2310,
      week52Low: 1420,
      asOf: "2026-09-11T10:00:00.000Z",
      sourceId: "bse_hal_quote",
    },
    metrics: [
      { key: "pe", label: "P/E ratio", value: 28.4, display: "28.4", unit: null, sectorMedian: 19.2, direction: "high", explanation: "", sourceIds: ["bse_hal_quote"] },
      { key: "eps", label: "EPS", value: 62.5, display: "₹62.50", unit: "INR", sectorMedian: null, direction: "normal", explanation: "", sourceIds: ["bse_hal_quote"] },
      { key: "week52_range", label: "52-week range", value: null, display: "₹1,420 – ₹2,310", unit: "INR", sectorMedian: null, direction: "high", explanation: "", sourceIds: ["bse_hal_quote"] },
      { key: "debt_to_equity", label: "Debt to equity", value: 0.12, display: "0.12", unit: null, sectorMedian: 0.35, direction: "low", explanation: "", sourceIds: ["bse_hal_quote"] },
    ],
    history: [],
    sectorMedians: { pe: 19.2, debt_to_equity: 0.35 },
    risk: [
      { key: "volatility", label: "Price volatility", level: "high", reason: "The share has moved across a wide range over the past year.", sourceIds: ["bse_hal_quote"] },
      { key: "debt", label: "Debt", level: "low", reason: "Carries very little debt compared with peers.", sourceIds: ["bse_hal_quote"] },
      { key: "valuation", label: "Valuation", level: "high", reason: "Trades well above the defence sector's median price-to-earnings ratio.", sourceIds: ["bse_hal_quote"] },
      { key: "stability", label: "Business stability", level: "medium", reason: "Revenue depends heavily on government defence programmes.", sourceIds: ["hal_q2_presentation"] },
    ],
    documentIds: DOCUMENTS.filter((d) => d.tickers.includes("HAL")).map((d) => d.id),
    newsIds: [],
  },
};

const GLOSSARY: Record<string, GlossaryEntry> = {
  pe: {
    key: "pe",
    term: "P/E ratio",
    oneLiner: "What you pay for each ₹1 the company earns.",
    byLevel: {
      new: "P/E means price-to-earnings. At a P/E of 28.4, investors are paying ₹28.40 for every ₹1 the company earns in a year. A high number can mean people expect strong growth — or that the stock is simply expensive.",
      learning: "A P/E well above the sector median means the market expects this company to grow faster than its peers. That expectation has to be met.",
      practicing: "P/E relative to sector median is the comparison that matters, not the absolute number.",
      independent: "P/E vs sector median.",
    },
    related: ["eps", "valuation"],
  },
  priced_in: {
    key: "priced_in",
    term: "Priced in",
    oneLiner: "News everyone already knows is usually already reflected in the price.",
    byLevel: {
      new: "'Priced in' means the market already knows something, so the price has already moved. If a budget increase was announced months ago and everyone read it, buying today doesn't get you the surprise — you're paying a price that already includes the good news.",
      learning: "Public news is usually priced in. Ask what would be new information from here.",
      practicing: "Ask what is not yet priced in — that is where the edge would have to come from.",
      independent: "Largely priced in.",
    },
    related: ["valuation"],
  },
  order_book: {
    key: "order_book",
    term: "Order book",
    oneLiner: "Work the company has already won but not yet delivered.",
    byLevel: {
      new: "An order book is the work a company has already won but hasn't delivered yet. A big order book means revenue is fairly predictable for a while — one of the most useful numbers for a manufacturer.",
      learning: "A high order book supports future revenue, but check how fast it converts.",
      practicing: "Order book value matters less than conversion rate.",
      independent: "Order book conversion rate.",
    },
    related: [],
  },
};

const TICKER_ALIASES: Record<string, string> = {
  hal: "HAL",
  "hindustan aeronautics": "HAL",
};

export const sourcesStub: SourcesPort & { listStocks(): StockSummary[] } = {
  listStocks() {
    return Object.values(STOCKS).map((s) => ({
      ticker: s.ticker,
      name: s.name,
      sector: s.sector,
      last: s.price.last,
      changePct: s.price.changePct,
    }));
  },

  getStock(ticker) {
    return STOCKS[ticker.toUpperCase()] ?? null;
  },

  getDocument(id) {
    return DOCUMENTS.find((d) => d.id === id) ?? null;
  },

  /** Keyword scoring. Deliberately simple — semantic search is an upgrade, not a blocker. */
  searchSources(query, opts: SearchOptions = {}): SearchHit[] {
    const terms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 3);
    const hits: SearchHit[] = [];

    for (const doc of DOCUMENTS) {
      if (opts.tickers?.length && !opts.tickers.some((t) => doc.tickers.includes(t))) continue;
      if (opts.tiers?.length && !opts.tiers.includes(doc.tier)) continue;

      for (const chunk of doc.chunks) {
        const haystack = `${doc.title} ${chunk.text}`.toLowerCase();
        const score = terms.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
        // Keep ticker-matched documents even on a zero keyword score — they are
        // the company's own filings and are always relevant context.
        if (score > 0 || opts.tickers?.some((t) => doc.tickers.includes(t))) {
          hits.push({ chunkId: chunk.id, docId: doc.id, text: chunk.text, score: score + 0.1 });
        }
      }
    }

    return hits.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 8);
  },

  getGlossary(term) {
    return GLOSSARY[term.toLowerCase()] ?? null;
  },

  resolveTicker(text) {
    const lower = text.toLowerCase();
    for (const [alias, ticker] of Object.entries(TICKER_ALIASES)) {
      if (lower.includes(alias)) {
        const stock = STOCKS[ticker];
        if (stock) return { ticker: stock.ticker, name: stock.name };
      }
    }
    const direct = STOCKS[text.toUpperCase()];
    return direct ? { ticker: direct.ticker, name: direct.name } : null;
  },
};
