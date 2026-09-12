/**
 * Derived fields: sectors, sector medians, metric directions and risk rows.
 *
 * Kept separate from build-snapshot.ts so it can be re-run on its own and so a
 * rebuild cannot silently drop it — call `deriveAll()` at the end of any build.
 *
 * Everything here is arithmetic over figures already in the records. Nothing is
 * fetched and nothing is invented: where the inputs are missing the output is
 * omitted, because a missing comparison is honest and a guessed one is not.
 */

import type { Metric, RiskFactor, StockRecord } from "@bit-n-build-2026/contracts";

/**
 * Real sector per ticker. These are facts about what each company does.
 *
 * Why this matters: every stock was previously "Unclassified", so all 20 shared
 * one blended P/E median of 17.05 spanning banks, IT, oil, power and retail.
 * That told users Infosys at 13.5 was "below its sector" when the IT median is
 * 14.15, and presented ONGC at 6.69 as cheap when oil PSUs structurally trade
 * there. A wrong comparison delivered with a citation is worse than none.
 */
export const SECTORS: Record<string, string> = {
  ATHER: "Automobile",
  BDL: "Defence",
  BEL: "Defence",
  ETERNAL: "Consumer Tech",
  HAL: "Defence",
  HDFCBANK: "Banking",
  ICICIBANK: "Banking",
  IDEA: "Telecom",
  INFY: "Information Technology",
  IREDA: "Financials",
  ITC: "FMCG",
  NTPC: "Power",
  ONGC: "Oil & Gas",
  POWERGRID: "Power",
  RELIANCE: "Oil & Gas",
  SUZLON: "Renewable Energy",
  TATAMOTORS: "Automobile",
  TATAPOWER: "Power",
  TCS: "Information Technology",
  TRENT: "Retail",
};

export const MEDIAN_KEYS = ["pe", "roe", "roce", "dividend_yield", "market_cap", "debt_to_equity"];

/** Never compute a "sector median" from a single company. */
export const MIN_PEERS = 2;

/**
 * Below this, debt-to-equity comparisons stop meaning anything. A company with
 * essentially no debt must never be flagged "high debt" because a peer has
 * marginally less — HAL was briefly rated `debt: high, 0.01 vs median 0.01`.
 */
export const DEBT_FLOOR = 0.05;

/** Volatility bands, calibrated against the real spread of this universe. */
export const VOL_HIGH = 0.7;
export const VOL_MEDIUM = 0.35;

function median(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Round enough to be readable without losing small ratios to zero. */
function tidy(v: number): number {
  return Math.abs(v) < 1 ? Math.round(v * 10000) / 10000 : Math.round(v * 100) / 100;
}

const num = (s: StockRecord, key: string): number | null =>
  s.metrics.find((m) => m.key === key)?.value ?? null;

const fmt = (v: number): string => String(tidy(v));

function direction(value: number | null, med: number | null): Metric["direction"] {
  if (value === null || med === null) return "unknown";
  if (value > med * 1.15) return "high";
  if (value < med * 0.85) return "low";
  return "normal";
}

/** Apply sectors, medians, metric directions and risk rows to every record. */
export function deriveAll(stocks: StockRecord[]): StockRecord[] {
  for (const s of stocks) {
    const sector = SECTORS[s.ticker.toUpperCase()];
    if (sector) s.sector = sector;
  }

  const groups = new Map<string, StockRecord[]>();
  for (const s of stocks) {
    groups.set(s.sector, [...(groups.get(s.sector) ?? []), s]);
  }

  const medians = new Map<string, Record<string, number>>();
  for (const [sector, members] of groups) {
    const m: Record<string, number> = {};
    for (const key of MEDIAN_KEYS) {
      const values = members
        .map((s) => num(s, key))
        .filter((v): v is number => v !== null);
      // Fewer than MIN_PEERS means no honest comparison exists for this sector.
      if (values.length >= MIN_PEERS) {
        const med = median(values);
        if (med !== null) m[key] = tidy(med);
      }
    }
    medians.set(sector, m);
  }

  for (const s of stocks) {
    const med = medians.get(s.sector) ?? {};
    s.sectorMedians = med;

    for (const metric of s.metrics) {
      metric.sectorMedian = med[metric.key] ?? null;
      // week52_range's direction is position within the range, not a median.
      if (metric.key !== "week52_range") {
        metric.direction = direction(metric.value, metric.sectorMedian);
      }
      if (typeof metric.value === "number") metric.value = tidy(metric.value);
    }

    s.risk = deriveRisk(s, med);
  }

  return stocks;
}

/** The source to cite for a derived risk row — the stock's own market-data doc. */
function riskSource(s: StockRecord): string[] {
  const existing = s.risk.find((r) => r.sourceIds?.length)?.sourceIds;
  if (existing?.length) return existing;
  const priceSource = s.price?.sourceId;
  if (priceSource) return [priceSource];
  return s.documentIds.slice(0, 1);
}

export function deriveRisk(s: StockRecord, med: Record<string, number>): RiskFactor[] {
  const sourceIds = riskSource(s);
  const out: RiskFactor[] = [];

  // Volatility, from the width of the 52-week range.
  const high = s.price?.week52High ?? null;
  const low = s.price?.week52Low ?? null;
  if (high !== null && low !== null && low > 0) {
    const spread = (high - low) / low;
    out.push({
      key: "volatility",
      label: "Price volatility",
      level: spread > VOL_HIGH ? "high" : spread > VOL_MEDIUM ? "medium" : "low",
      reason:
        `The price moved between ₹${low.toLocaleString("en-IN")} and ` +
        `₹${high.toLocaleString("en-IN")} over 52 weeks — a swing of about ` +
        `${Math.round(spread * 100)}% from its low.`,
      sourceIds,
    });
  }

  // Valuation, against real peers only.
  const pe = num(s, "pe");
  const peMed = med.pe ?? null;
  if (pe !== null && peMed !== null && peMed > 0) {
    const gap = (pe - peMed) / peMed;
    // Sitting on the median is not a valuation story; flagging it anyway pads
    // the watch-out list and makes the real flags matter less.
    if (Math.abs(gap) >= 0.05) {
      out.push({
        key: "valuation",
        label: "Valuation",
        level: gap > 0.3 ? "high" : gap < -0.2 ? "low" : "medium",
        reason:
          `P/E is ${fmt(pe)}, compared with the ${s.sector} sector median of ${fmt(peMed)}. ` +
          (gap > 0
            ? "Investors are paying more for its earnings than for its peers'."
            : "Investors are paying less for its earnings than for its peers'."),
        sourceIds,
      });
    }
  }

  // Debt, but only where the numbers are large enough to mean anything.
  const de = num(s, "debt_to_equity");
  const deMed = med.debt_to_equity ?? null;
  if (de !== null && deMed !== null && Math.max(de, deMed) >= DEBT_FLOOR) {
    out.push({
      key: "debt",
      label: "Debt",
      level: de > deMed * 1.3 ? "high" : de < deMed * 0.8 ? "low" : "medium",
      reason:
        `Debt to equity is ${fmt(de)}, compared with the ${s.sector} sector median of ${fmt(deMed)}.`,
      sourceIds,
    });
  }

  // Business returns.
  const roe = num(s, "roe");
  if (roe !== null) {
    out.push({
      key: "stability",
      label: "Business returns",
      level: roe > 18 ? "low" : roe > 10 ? "medium" : "high",
      reason:
        `Return on equity is ${fmt(roe)}%, showing how much profit the business earned ` +
        `from shareholders' money.`,
      sourceIds,
    });
  }

  const order: Record<string, number> = { volatility: 0, valuation: 1, debt: 2, stability: 3 };
  return out.sort((a, b) => (order[a.key] ?? 9) - (order[b.key] ?? 9));
}
