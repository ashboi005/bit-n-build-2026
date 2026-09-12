/**
 * BSE undocumented JSON API — our live-quote source.
 *
 * Verified working from a datacenter IP with only Referer + Origin headers
 * (both applied automatically in http.ts). No cookies, no key.
 *
 * ⚠️ Without those headers this host 301s to an HTML page and you get a silent
 * wrong answer. Every function here asserts on the response shape for that reason.
 */

import { getJson } from "../http";

const API = "https://api.bseindia.com/BseIndiaAPI/api";

export interface BseScripRow {
  /** BSE numeric code, e.g. "500325". */
  SCRIP_CD: string;
  /** NSE symbol lives here, e.g. "RELIANCE". */
  scrip_id: string;
  Scrip_Name: string;
  ISIN_NUMBER: string;
}

/**
 * Full scrip master — BSE code + ISIN + NSE symbol.
 * BUILD THIS FIRST. Everything else keys off the mapping it gives you. ~1.7MB.
 */
export async function fetchScripMaster(): Promise<BseScripRow[]> {
  const rows = await getJson<BseScripRow[]>(
    `${API}/ListofScripData/w?segment=Equity&status=Active`,
    24 * 60 * 60 * 1000, // changes rarely; cache a day
  );
  if (!Array.isArray(rows) || !rows[0]?.SCRIP_CD) {
    throw new Error("BSE scrip master: unexpected shape — headers probably stripped");
  }
  return rows;
}

export interface BseQuote {
  CurrRate: { LTP: string; Chg: string; PcChg: string };
  Header: {
    PrevClose?: string;
    Open?: string;
    High?: string;
    Low?: string;
    Ason?: string;
  };
  Cmpname?: { FullN?: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Validates the current BSE quote shape without relying on retired fields. */
export function parseQuote(value: unknown): BseQuote {
  if (
    !isRecord(value) ||
    !isRecord(value.CurrRate) ||
    !isRecord(value.Header) ||
    !isNonEmptyString(value.CurrRate.LTP) ||
    !isNonEmptyString(value.CurrRate.Chg) ||
    !isNonEmptyString(value.CurrRate.PcChg)
  ) {
    throw new Error("BSE quote: unexpected response shape");
  }
  return value as unknown as BseQuote;
}

/** Live quote. `scripCode` is the BSE numeric code from the scrip master. */
export async function fetchQuote(scripCode: string): Promise<BseQuote> {
  const json = await getJson<unknown>(
    `${API}/getScripHeaderData/w?Debtflag=&scripcode=${scripCode}&seriesid=`,
    5 * 60 * 1000,
  );
  return parseQuote(json);
}

export interface BseAnnouncement {
  NEWSID: string;
  NEWSSUB: string;
  /** Plain-text summary of the filing. This is the gold — no PDF parsing needed. */
  HEADLINE: string;
  ATTACHMENTNAME: string;
  NEWS_DT: string;
  SCRIP_CD: string;
}

/**
 * Corporate announcements for one company.
 * Dates are YYYYMMDD.
 *
 * TODO(tushar): confirm which field carries the plain-text body on BSE — on NSE
 * it is `attchmntText`. Whichever it is, that text is what we cite, and the
 * attachment name resolves to a PDF URL under
 * https://www.bseindia.com/xml-data/corpfiling/AttachLive/<ATTACHMENTNAME>
 */
export async function fetchAnnouncements(
  scripCode: string,
  fromYyyymmdd: string,
  toYyyymmdd: string,
): Promise<BseAnnouncement[]> {
  const url =
    `${API}/AnnSubCategoryGetData/w?pageno=1&strCat=-1&strPrevDate=${fromYyyymmdd}` +
    `&strScrip=${scripCode}&strSearch=P&strToDate=${toYyyymmdd}&strType=C&subcategory=-1`;
  const json = await getJson<{ Table?: BseAnnouncement[] }>(url, 60 * 60 * 1000);
  return json.Table ?? [];
}
