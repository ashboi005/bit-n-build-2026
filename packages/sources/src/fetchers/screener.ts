/**
 * screener.in — our fundamentals source.
 *
 * Not blocked, no key. robots.txt explicitly permits /company/.
 * Rate limited to 1 req/sec in http.ts. Please leave that alone.
 */

import { getJson, getText } from "../http";

const BASE = "https://www.screener.in";

export interface ScreenerSearchResult {
  id: number;
  name: string;
  url: string;
}

/** Symbol/name -> screener's internal company id, which the other calls need. */
export async function searchCompany(q: string): Promise<ScreenerSearchResult[]> {
  return getJson<ScreenerSearchResult[]>(
    `${BASE}/api/company/search/?q=${encodeURIComponent(q)}`,
    24 * 60 * 60 * 1000,
  );
}

/**
 * Price history as JSON. This is our OHLC solution — no Yahoo needed.
 * `days=3650` gives 10 years, downsampled to weekly.
 */
export async function fetchPriceHistory(
  companyId: number,
  days = 365,
): Promise<{ date: string; close: number }[]> {
  const json = await getJson<{
    datasets?: { metric: string; values: [string, string][] }[];
  }>(`${BASE}/api/company/${companyId}/chart/?q=Price-DMA50-DMA200-Volume&days=${days}`);

  const price = json.datasets?.find((d) => d.metric.toLowerCase() === "price");
  if (!price) return [];
  return price.values
    .map(([date, close]) => ({ date, close: Number(close) }))
    .filter((p) => Number.isFinite(p.close));
}

export interface ScreenerFundamentals {
  marketCap: number | null;
  pe: number | null;
  bookValue: number | null;
  roce: number | null;
  roe: number | null;
  dividendYield: number | null;
  /** Total borrowings, for debt-to-equity. */
  borrowings: number | null;
  promoterHolding: number | null;
}

/**
 * TODO(tushar): implement this.
 *
 * Fetch https://www.screener.in/company/<TICKER>/consolidated/ and pull the
 * numbers out with regex — no headless browser needed, this is ~30 lines.
 *
 * The top "ratios" block looks roughly like:
 *   <li ...><span class="name">Market Cap</span><span class="value">₹ 17,01,716 Cr.</span></li>
 *
 * Suggested approach:
 *   1. getText(url)
 *   2. For each label you want, regex for the label then the nearest value span
 *   3. Strip ₹ , % and "Cr." then Number()
 *   4. Return nulls for anything you can't find — NEVER guess a number.
 *      A null renders as "—" in the UI, which is honest. A wrong number is not.
 *
 * The page also carries full tables for Quarterly Results, P&L, Balance Sheet
 * (Borrowings -> D/E), Cash Flow, Ratios and Shareholding. Start with the ratios
 * block only; the tables are a stretch goal.
 */
export async function fetchFundamentals(ticker: string): Promise<ScreenerFundamentals> {
  const html = await getText(`${BASE}/company/${ticker}/consolidated/`);

  // Parses the ratio list at the top of the page. Extend as needed.
  const pick = (label: string): number | null => {
    const re = new RegExp(
      `${label}[\\s\\S]{0,200}?class="number">\\s*([\\d.,-]+)`,
      "i",
    );
    const match = html.match(re);
    if (!match?.[1]) return null;
    const n = Number(match[1].replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  return {
    marketCap: pick("Market Cap"),
    pe: pick("Stock P/E"),
    bookValue: pick("Book Value"),
    roce: pick("ROCE"),
    roe: pick("ROE"),
    dividendYield: pick("Dividend Yield"),
    borrowings: null, // TODO: from the Balance Sheet table
    promoterHolding: null, // TODO: from the Shareholding table
  };
}
