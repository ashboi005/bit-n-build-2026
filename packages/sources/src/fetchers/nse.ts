/**
 * NSE — partial. The nuance matters:
 *
 *   ❌ /api/quote-equity            403 from datacenter IPs, cookies don't help.
 *                                   Do not spend time on it. Use BSE for quotes.
 *   ❌ /api/equity-stockIndices     404 — removed. Blogs citing it are stale.
 *   ✅ /api/corporate-announcements  works after cookie bootstrap
 *   ✅ /api/corporates-corporateActions
 *   ✅ nsearchives.nseindia.com      NOT blocked at all, no cookies needed
 */

import { getNseJson, getText } from "../http";

const API = "https://www.nseindia.com/api";
const ARCHIVES = "https://nsearchives.nseindia.com";

export interface NseAnnouncement {
  symbol: string;
  desc: string;
  /**
   * Plain-text summary of the filing. THIS IS THE MOST VALUABLE FIELD IN THE
   * WHOLE PIPELINE — official, citable filing text with no PDF parsing.
   */
  attchmntText: string;
  /** Direct PDF link, confirmed to return 200 application/pdf. */
  attchmntFile: string;
  an_dt: string;
  sm_name: string;
}

export async function fetchAnnouncements(symbol: string): Promise<NseAnnouncement[]> {
  return getNseJson<NseAnnouncement[]>(
    `${API}/corporate-announcements?index=equities&symbol=${symbol}`,
    60 * 60 * 1000,
  );
}

/** NIFTY 50 constituents. No cookies needed — different host. */
export async function fetchNifty50(): Promise<string[]> {
  const csv = await getText(
    `${ARCHIVES}/content/indices/ind_nifty50list.csv`,
    24 * 60 * 60 * 1000,
  );
  return parseCsv(csv)
    .map((row) => row["Symbol"])
    .filter((s): s is string => Boolean(s));
}

/**
 * Full-market end-of-day with delivery %, one CSV per trading day.
 * `ddmmyyyy`, e.g. "11092026". Loop dates to build a price database offline.
 */
export async function fetchBhavcopy(ddmmyyyy: string): Promise<Record<string, string>[]> {
  const csv = await getText(
    `${ARCHIVES}/products/content/sec_bhavdata_full_${ddmmyyyy}.csv`,
    7 * 24 * 60 * 60 * 1000,
  );
  return parseCsv(csv);
}

/** Minimal CSV parser. These files have no quoted commas. */
function parseCsv(csv: string): Record<string, string>[] {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines[0]?.split(",").map((h) => h.trim()) ?? [];
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}
