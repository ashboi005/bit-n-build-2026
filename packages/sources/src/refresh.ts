/**
 * Refreshes the citation layer and price history from live sources.
 *
 *   bun run --filter @bit-n-build-2026/sources refresh
 *
 * Additive and idempotent. It writes new document files and fills `history` on
 * existing stock records; it never deletes a document or overwrites a field that
 * is already populated with something better.
 *
 * Three passes:
 *   A. NSE corporate announcements per covered ticker. `attchmntText` is already
 *      plain English and each carries a real PDF link, so the highest-value
 *      source we have needs no PDF parsing.
 *   B. Official feeds (PIB/SEBI/RBI) and financial press, filtered to companies
 *      we actually cover.
 *   C. Daily closes from screener's chart API, so charts and "what changed" have
 *      something to work with.
 *
 * Nothing here is hand-written. If a document does not exist we do not have it,
 * and the product correctly says so.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { dataPath } from "./paths";

import type { SourceDocument, SourceTier, StockRecord } from "@bit-n-build-2026/contracts";

import { deriveAll } from "./derive";

const DATA = dataPath("snapshot");
const STOCKS = join(DATA, "stocks");
const DOCS = join(DATA, "documents");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);

/** Announcements that carry no information worth citing. */
const LOW_VALUE =
  /change in (director|auditor|company secretary|kmp)|loss of (share )?certificate|trading window|newspaper publication|duplicate share|compliance certificate|reg\. ?\d+/i;

function loadStocks(): { file: string; record: StockRecord }[] {
  return readdirSync(STOCKS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({
      file: join(STOCKS, f),
      record: JSON.parse(readFileSync(join(STOCKS, f), "utf8")) as StockRecord,
    }));
}

function writeDoc(doc: SourceDocument): boolean {
  const path = join(DOCS, `${doc.id}.json`);
  if (existsSync(path)) return false; // never clobber an existing citation
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
  return true;
}

function chunk(text: string, id: string) {
  const MAX = 2000;
  if (text.length <= MAX) return [{ id: `${id}_0`, text }];
  const out: { id: string; text: string }[] = [];
  for (let i = 0, n = 0; i < text.length; i += MAX, n++) {
    out.push({ id: `${id}_${n}`, text: text.slice(i, i + MAX) });
  }
  return out;
}

/* ------------------------------------------------------- A. NSE filings */

async function nseCookie(): Promise<string> {
  const res = await fetch("https://www.nseindia.com/get-quotes/equity?symbol=RELIANCE", {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

/** "10-Sep-2026 17:41:08" -> "2026-09-10" */
function isoDate(raw?: string): string | null {
  if (!raw) return null;
  const d = new Date(raw.replace(/-/g, " "));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

async function fetchFilings(
  stocks: ReturnType<typeof loadStocks>,
  perTicker: number,
): Promise<number> {
  const cookie = await nseCookie();
  let written = 0;

  for (const { record } of stocks) {
    try {
      const res = await fetch(
        `https://www.nseindia.com/api/corporate-announcements?index=equities&symbol=${record.ticker}`,
        {
          headers: {
            "User-Agent": UA,
            Accept: "application/json",
            Referer: "https://www.nseindia.com/",
            Cookie: cookie,
          },
          signal: AbortSignal.timeout(25000),
        },
      );
      if (!res.ok) {
        console.log(`  ${record.ticker.padEnd(11)} filings HTTP ${res.status}`);
        await sleep(800);
        continue;
      }

      const items = (await res.json()) as {
        desc?: string;
        attchmntText?: string;
        attchmntFile?: string;
        an_dt?: string;
        sm_name?: string;
      }[];

      const useful = items
        .filter((a) => (a.attchmntText ?? "").trim().length > 60)
        .filter((a) => !LOW_VALUE.test(`${a.desc ?? ""} ${a.attchmntText ?? ""}`))
        .slice(0, perTicker);

      let added = 0;
      for (const a of useful) {
        const date = isoDate(a.an_dt);
        const id = `nse_${record.ticker.toLowerCase()}_${slug(`${date ?? ""}_${a.desc ?? "announcement"}`)}`;
        const text = a.attchmntText!.replace(/\s+/g, " ").trim();

        if (
          writeDoc({
            id,
            title: `${record.name} — ${a.desc ?? "Corporate announcement"}`,
            publisher: a.sm_name ?? record.name,
            tier: "filing",
            url: a.attchmntFile ?? null,
            pdfUrl: a.attchmntFile ?? null,
            publishedAt: date,
            tickers: [record.ticker],
            sectors: [record.sector],
            text,
            chunks: chunk(text, id),
          })
        ) {
          added++;
          written++;
        }
      }
      const newest = isoDate(useful[0]?.an_dt) ?? "—";
      console.log(`  ${record.ticker.padEnd(11)} +${String(added).padStart(2)} filings (newest ${newest})`);
    } catch (error) {
      console.log(
        `  ${record.ticker.padEnd(11)} filings FAILED ${error instanceof Error ? error.message.slice(0, 36) : ""}`,
      );
    }
    await sleep(800);
  }
  return written;
}

/* --------------------------------------------------- B. feeds (RSS) */

interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
}

function parseRss(xml: string): FeedItem[] {
  const out: FeedItem[] = [];
  for (const block of xml.split(/<item[\s>]/).slice(1)) {
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
      if (!m?.[1]) return "";
      return m[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/<[^>]+>/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();
    };
    const title = get("title");
    if (!title) continue;
    const pub = get("pubDate");
    const d = pub ? new Date(pub) : null;
    out.push({
      title,
      link: get("link"),
      description: get("description"),
      pubDate: d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null,
    });
  }
  return out;
}

async function fetchFeed(
  name: string,
  url: string,
  tier: SourceTier,
  stocks: ReturnType<typeof loadStocks>,
  topical: RegExp,
  limit: number,
): Promise<number> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      console.log(`  ${name.padEnd(24)} HTTP ${res.status}`);
      return 0;
    }
    const items = parseRss(await res.text());
    let written = 0;

    for (const item of items) {
      if (written >= limit) break;
      const haystack = `${item.title} ${item.description}`;

      const tickers = stocks
        .map((s) => s.record)
        .filter((r) => {
          // Word boundaries on BOTH the ticker and the company name.
          // A bare substring match tagged a Bitcoin article as ITC news,
          // because "bitcoin" contains "itc".
          const short = r.name.replace(/\s+(Ltd|Limited|Corporation|Corp)\.?$/i, "").trim();
          const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

          if (new RegExp(`\\b${esc(r.ticker)}\\b`, "i").test(haystack)) return true;
          // Very short names are too ambiguous to match on their own.
          if (short.length < 5) return false;
          return new RegExp(`\\b${esc(short)}\\b`, "i").test(haystack);
        })
        .map((r) => r.ticker);

      if (!tickers.length && !topical.test(haystack)) continue;

      const id = `${slug(name)}_${slug(item.title)}`;
      const text = `${item.title}. ${item.description}`.trim();
      const sectors = [
        ...new Set(
          stocks.map((s) => s.record).filter((r) => tickers.includes(r.ticker)).map((r) => r.sector),
        ),
      ];

      if (
        writeDoc({
          id,
          title: item.title,
          publisher: name,
          tier,
          url: item.link || null,
          pdfUrl: null,
          publishedAt: item.pubDate,
          tickers,
          sectors,
          text,
          chunks: chunk(text, id),
        })
      ) {
        written++;
      }
    }
    console.log(`  ${name.padEnd(24)} +${written} of ${items.length}`);
    return written;
  } catch (error) {
    console.log(
      `  ${name.padEnd(24)} FAILED ${error instanceof Error ? error.message.slice(0, 36) : ""}`,
    );
    return 0;
  }
}

/* ---------------------------------------------------- C. price history */

async function fetchHistory(stocks: ReturnType<typeof loadStocks>, days: number): Promise<number> {
  let filled = 0;

  for (const { record } of stocks) {
    if (record.history?.length) {
      console.log(`  ${record.ticker.padEnd(11)} already has ${record.history.length} points`);
      continue;
    }
    try {
      const search = (await (
        await fetch(`https://www.screener.in/api/company/search/?q=${encodeURIComponent(record.ticker)}`, {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(20000),
        })
      ).json()) as { id: number; name: string; url: string }[];

      const hit =
        search.find((h) => h.url?.toUpperCase().includes(`/${record.ticker.toUpperCase()}/`)) ??
        search[0];
      if (!hit) {
        console.log(`  ${record.ticker.padEnd(11)} no screener id`);
        await sleep(900);
        continue;
      }

      await sleep(900);
      const chart = (await (
        await fetch(
          `https://www.screener.in/api/company/${hit.id}/chart/?q=Price-DMA50-DMA200-Volume&days=${days}`,
          { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) },
        )
      ).json()) as { datasets?: { metric: string; values: [string, string][] }[] };

      const price = chart.datasets?.find((d) => d.metric.toLowerCase() === "price");
      const points = (price?.values ?? [])
        .map(([date, close]) => ({ date, close: Number(close) }))
        .filter((p) => Number.isFinite(p.close));

      if (points.length) {
        record.history = points;
        filled++;
        console.log(
          `  ${record.ticker.padEnd(11)} ${String(points.length).padStart(4)} points  ${points[0]!.date} → ${points[points.length - 1]!.date}`,
        );
      } else {
        console.log(`  ${record.ticker.padEnd(11)} no price series returned`);
      }
    } catch (error) {
      console.log(
        `  ${record.ticker.padEnd(11)} history FAILED ${error instanceof Error ? error.message.slice(0, 36) : ""}`,
      );
    }
    await sleep(900);
  }
  return filled;
}

/* ------------------------------------------------------------- main */

async function main() {
  const stocks = loadStocks();
  if (!stocks.length) {
    console.error("No stocks found. Run build:snapshot first.");
    process.exit(1);
  }

  console.log(`\n[A] NSE corporate filings — ${stocks.length} companies`);
  const filings = await fetchFilings(stocks, 5);

  console.log(`\n[B] Official sources`);
  const OFFICIAL =
    /defence|defense|budget|allocation|railway|power|electricity|pharma|bank|rbi|sebi|telecom|automobile|semiconductor|infrastructure|renewable|solar|oil|gas/i;
  let official = 0;
  official += await fetchFeed("PIB", "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3&reg=3", "official", stocks, OFFICIAL, 15);
  await sleep(700);
  official += await fetchFeed("SEBI", "https://www.sebi.gov.in/sebirss.xml", "official", stocks, OFFICIAL, 10);
  await sleep(700);
  official += await fetchFeed("RBI", "https://rbi.org.in/pressreleases_rss.xml", "official", stocks, OFFICIAL, 10);

  console.log(`\n[C] Financial press`);
  const PRESS = /nifty|sensex|market|stock|share|ipo|earnings|results|quarter/i;
  let press = 0;
  for (const [name, url] of [
    ["Economic Times", "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms"],
    ["Hindu BusinessLine", "https://www.thehindubusinessline.com/markets/feeder/default.rss"],
    ["Mint", "https://www.livemint.com/rss/markets"],
    ["Business Standard", "https://www.business-standard.com/rss/markets-106.rss"],
  ] as const) {
    press += await fetchFeed(name, url, "press", stocks, PRESS, 12);
    await sleep(700);
  }

  console.log(`\n[D] Price history (1 year of daily closes)`);
  const history = await fetchHistory(stocks, 365);

  // Relink documents to stocks, then re-derive everything that depends on them.
  const allDocs = readdirSync(DOCS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(DOCS, f), "utf8")) as SourceDocument);

  for (const { record } of stocks) {
    const ids = new Set(record.documentIds);
    for (const doc of allDocs) {
      if (doc.tickers?.includes(record.ticker)) ids.add(doc.id);
    }
    record.documentIds = [...ids];
  }

  deriveAll(stocks.map((s) => s.record));
  for (const { file, record } of stocks) {
    writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  }

  const tiers = allDocs.reduce<Record<string, number>>((acc, d) => {
    acc[d.tier] = (acc[d.tier] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    `\nfilings +${filings}  official +${official}  press +${press}  history filled ${history}/${stocks.length}`,
  );
  console.log(`documents on disk: ${allDocs.length} — ${JSON.stringify(tiers)}`);
}

void main();
