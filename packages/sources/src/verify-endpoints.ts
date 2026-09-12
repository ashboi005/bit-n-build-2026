/**
 * Hour-zero smoke test. RUN THIS FIRST.
 *
 *   bun run --filter @bit-n-build-2026/sources verify:endpoints
 *
 * Every endpoint below is undocumented and can die without notice — two
 * previously well-documented ones already have. Find out in 30 seconds which
 * ones work TODAY rather than discovering it at hour 11.
 */

export {};

const CHECKS: { name: string; url: string; headers?: Record<string, string>; note?: string }[] = [
  {
    name: "BSE scrip master",
    url: "https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?segment=Equity&status=Active",
    headers: { Referer: "https://www.bseindia.com/", Origin: "https://www.bseindia.com" },
    note: "ISIN + BSE code + NSE symbol mapping. Build everything off this.",
  },
  {
    name: "BSE quote (RELIANCE)",
    url: "https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w?Debtflag=&scripcode=500325&seriesid=",
    headers: { Referer: "https://www.bseindia.com/", Origin: "https://www.bseindia.com" },
    note: "Our live-quote source. A 301 here means headers were stripped.",
  },
  {
    name: "screener search",
    url: "https://www.screener.in/api/company/search/?q=reliance",
    note: "Company id lookup.",
  },
  {
    name: "screener chart",
    url: "https://www.screener.in/api/company/2726/chart/?q=Price-DMA50-DMA200-Volume&days=365",
    note: "Our OHLC source. No Yahoo needed.",
  },
  {
    name: "screener company page",
    url: "https://www.screener.in/company/RELIANCE/consolidated/",
    note: "Fundamentals, via regex.",
  },
  {
    name: "NSE archives — NIFTY 50 list",
    url: "https://nsearchives.nseindia.com/content/indices/ind_nifty50list.csv",
    note: "Separate host, not blocked at all.",
  },
  {
    name: "SEBI RSS",
    url: "https://www.sebi.gov.in/sebirss.xml",
    note: "Citation moat.",
  },
  {
    name: "RBI RSS",
    url: "https://rbi.org.in/pressreleases_rss.xml",
  },
  {
    name: "PIB RSS",
    url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3&reg=3",
    note: "Needs BOTH Lang=1 and reg=3 or it 302s to Hindi.",
  },
  {
    name: "Economic Times markets RSS",
    url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
  },
  {
    name: "MoneyControl price API",
    url: "https://priceapi.moneycontrol.com/pricefeed/nse/equitycash/RI",
    note: "Free fundamentals cross-check.",
  },
];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

console.log(`Checking ${CHECKS.length} endpoints...\n`);

let ok = 0;
for (const check of CHECKS) {
  const started = Date.now();
  try {
    const res = await fetch(check.url, {
      headers: { "User-Agent": UA, Accept: "*/*", ...check.headers },
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const size = (await res.text().catch(() => "")).length;
    const ms = Date.now() - started;

    if (res.status >= 200 && res.status < 300) {
      ok++;
      console.log(`✅ ${check.name.padEnd(32)} ${res.status}  ${(size / 1024).toFixed(0)}KB  ${ms}ms`);
    } else {
      console.log(`❌ ${check.name.padEnd(32)} ${res.status}  ${ms}ms`);
      if (res.status >= 300 && res.status < 400) {
        console.log(`     redirected to: ${res.headers.get("location")?.slice(0, 90)}`);
      }
    }
  } catch (error) {
    console.log(`❌ ${check.name.padEnd(32)} ${error instanceof Error ? error.message : "failed"}`);
  }
  if (check.note) console.log(`     ${check.note}`);
}

console.log(`\n${ok}/${CHECKS.length} working.`);
if (ok < CHECKS.length) {
  console.log("Anything failing: don't fight it. Use the snapshot and move on.");
}
