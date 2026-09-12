/**
 * Official feeds and news. All verified returning 200 from a datacenter IP.
 *
 * The official feeds are our citation moat — they're what makes the 🟢 badge on
 * screen mean something.
 */

import type { SourceTier } from "@bit-n-build-2026/contracts";

import { getText } from "../http";

export interface Feed {
  name: string;
  url: string;
  tier: SourceTier;
}

export const OFFICIAL_FEEDS: Feed[] = [
  { name: "SEBI", url: "https://www.sebi.gov.in/sebirss.xml", tier: "official" },
  { name: "RBI", url: "https://rbi.org.in/pressreleases_rss.xml", tier: "official" },
  // ⚠️ PIB 302-redirects to Hindi unless BOTH Lang=1 and reg=3 are present.
  {
    name: "PIB",
    url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3&reg=3",
    tier: "official",
  },
];

export const NEWS_FEEDS: Feed[] = [
  {
    name: "Economic Times Markets",
    url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
    tier: "press",
  },
  {
    name: "Hindu BusinessLine",
    url: "https://www.thehindubusinessline.com/markets/feeder/default.rss",
    tier: "press",
  },
  { name: "Mint Markets", url: "https://www.livemint.com/rss/markets", tier: "press" },
  {
    name: "Business Standard Markets",
    url: "https://www.business-standard.com/rss/markets-106.rss",
    tier: "press",
  },
];

export interface FeedItem {
  title: string;
  link: string;
  publishedAt: string | null;
  description: string;
  publisher: string;
  tier: SourceTier;
}

/**
 * Minimal RSS parse. These feeds are plain RSS 2.0 — no library needed.
 * Do NOT use Google News RSS: its links are opaque redirect tokens that don't
 * decode to real URLs, which makes them useless as citations.
 */
export async function fetchFeed(feed: Feed): Promise<FeedItem[]> {
  const xml = await getText(feed.url, 30 * 60 * 1000);
  const items: FeedItem[] = [];

  for (const block of xml.split(/<item[\s>]/).slice(1)) {
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
      return m?.[1] ? decode(m[1]) : "";
    };
    const title = get("title");
    if (!title) continue;
    items.push({
      title,
      link: get("link"),
      publishedAt: get("pubDate") || null,
      description: get("description").replace(/<[^>]+>/g, "").trim(),
      publisher: feed.name,
      tier: feed.tier,
    });
  }
  return items;
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}
