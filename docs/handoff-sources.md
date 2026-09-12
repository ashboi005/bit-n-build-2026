# Sources Handoff — Tushar

**You own `packages/sources`. You are the reason the AI is allowed to say anything.**

Everything the model states must trace back to something you fetched. If your layer is solid, our core promise ("no unsourced number reaches the screen") is real. If it's shaky, we have a chatbot.

---

## 0. THE RULE THAT MATTERS MOST

> ### Ship the cached snapshot in hour 1, before you touch a single live API.
>
> Commit `data/snapshot/` with 20 stocks fully populated — even if half the numbers are hand-typed from a browser. The instant that lands, **Ashwath and Sayam are unblocked forever** and the demo is guaranteed to work.
>
> Live fetchers come *after*, behind a flag, as an upgrade. Never as a dependency.

The classic way a hackathon dies is one person fighting an API's bot-wall for 6 hours while two others sit blocked. Do not be that person. The good news is the research below means you probably won't have to fight anything.

---

## 1. The headline finding: you need zero API keys

We verified every endpoint below live today, **from a datacenter IP** (the same egress our deployed backend gets — this distinction is why most blog posts will mislead you).

The best available Indian equity stack is free, unauthenticated, and datacenter-friendly:

> **BSE undocumented JSON + screener.in + NSE/BSE bhavcopy + SEBI/RBI/PIB RSS + publisher RSS**

Also confirmed: **no free tier of any global provider gives Indian fundamentals.** Not Alpha Vantage, Twelve Data, Finnhub, FMP, Tiingo, or Polygon. Tiingo's ticker manifest contains zero NSE and zero BSE rows — India is absent entirely, not just gated. Don't waste a minute on them.

---

## 2. TIER 1 — Verified working today, use these

### 2.1 BSE undocumented JSON API — best live-quote source

Works from a datacenter IP with **only two headers**. No cookies, no handshake, no key.

```
GET https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w?Debtflag=&scripcode=500325&seriesid=
Referer: https://www.bseindia.com/
Origin:  https://www.bseindia.com
```

Returns LTP, change, %change, open/high/low/prev close, company name, 52-week range.

> ⚠️ **Critical gotcha:** without those two headers it **301-redirects to an unrelated HTML page**. You get a silent wrong answer, not an error. Assert on the response shape.

Same host, same headers, also verified:

| Purpose | Path |
|---|---|
| Intraday minute bars | `/api/StockReachGraph/w?scripcode=500325&flag=0&fromdate=&todate=&seriesid=` |
| Corporate announcements | `/api/AnnSubCategoryGetData/w?pageno=1&strCat=-1&strPrevDate=20260801&strScrip=500325&strSearch=P&strToDate=20260912&strType=C&subcategory=-1` |
| Corporate actions (all stocks) | `/api/DefaultData/w?strType=D&strval=` |
| **Full scrip master (1.7 MB)** | `/api/ListofScripData/w?segment=Equity&status=Active` |

**Build the scrip master first.** It gives BSE code + **ISIN + NSE symbol** — your cross-exchange mapping table, which everything else keys off.

Dead as of today: `ComprehensiveInd`, `Corpforthcoming` (302 to error page).

### 2.2 screener.in — the fundamentals answer

Not blocked, no key. `robots.txt` explicitly permits `/company/` (it disallows `/user/*` and query-string paths only).

```
# symbol → internal id
https://www.screener.in/api/company/search/?q=reliance
  → [{ id, name, url }]

# price history JSON — this is your OHLC solution
https://www.screener.in/api/company/2726/chart/?q=Price-DMA50-DMA200-Volume&days=365
  → [date, price] arrays + 50/200 DMA + volume with delivery %
  → days=3650 gives 10 years (weekly-downsampled)
```

HTML scrape of `/company/RELIANCE/consolidated/` yields, **with plain regex in ~30 lines — no headless browser**: Market Cap, P/E, Book Value, ROCE, ROE, Dividend Yield, plus full Quarterly results, 10-year P&L, Balance Sheet (Borrowings → compute D/E), Cash Flow, Ratios, and Shareholding pattern (promoter / FII / DII).

> 🙏 **Be polite.** Cache aggressively, 1 request/sec, hit each company once and store it. This is a small free site and it is our product's backbone. Getting rate-limited here hurts us more than anything else on this page.

### 2.3 NSE — partial, and the nuance is the finding

NSE's blocking is **per-endpoint, not per-IP**. After a cookie bootstrap on `nseindia.com/get-quotes/equity?symbol=X`:

| Endpoint | Result |
|---|---|
| `/api/quote-equity?symbol=RELIANCE` | ❌ **403, consistently. Cookies do not help** |
| `/api/corporate-announcements?index=equities&symbol=RELIANCE` | ✅ 200 — 3,343 records |
| `/api/corporate-announcements?index=equities&from_date=..&to_date=..` | ✅ 200 |
| `/api/corporates-corporateActions?index=equities&symbol=..` | ✅ 200 |
| `/api/marketStatus`, `/api/allIndices` | ✅ 200 (index level + index P/E) |
| `/api/equity-stockIndices`, `/api/search/autocomplete` | ❌ **404 — gone in 2026.** Every blog citing these is stale |
| `/api/historical/cm/equity` | ❌ 503 |

**Do not budget any time trying to unblock `quote-equity`.** Use BSE for live quotes — same company, same rupee.

**`nsearchives.nseindia.com` is a separate host and is not blocked at all** — no cookies, no headers:

- Equity master: `/content/equities/EQUITY_L.csv`
- NIFTY 50 constituents: `/content/indices/ind_nifty50list.csv`
- **Full-market EOD + delivery %**: `/products/content/sec_bhavdata_full_11092026.csv` — every NSE stock's OHLC, volume and delivery % in one 395 KB CSV. Loop dates to build an offline price database.

BSE bhavcopy also works: `https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_20260911_F_0000.CSV` (ISIN-keyed).

### 2.4 Official / regulatory — this is our citation moat

All verified live. This is the strongest part of the stack and it's what makes our source-tier badges meaningful.

| Source | URL | Note |
|---|---|---|
| SEBI | `https://www.sebi.gov.in/sebirss.xml` | ✅ clean XML, live |
| RBI press releases | `https://rbi.org.in/pressreleases_rss.xml` | ✅ use the `.xml` directly — `/Scripts/Rss.aspx` is an HTML page, not a feed |
| PIB | `https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3&reg=3` | ✅ **must pass both `Lang=1` AND `reg=3`** or it 302s to Hindi |
| Union Budget | `https://indiabudget.gov.in` | ✅ 200 |
| MCA | — | ❌ 403, don't attempt |

> ### 🎯 The single best finding for our product
>
> NSE and BSE announcement JSON both include an **`attchmntText` field containing a plain-text summary of the filing**, plus a directly fetchable PDF URL (both confirmed `200 application/pdf`).
>
> **We get citable, official, source-linked filing text without parsing a single PDF.** In a 12-hour build that is worth more than any price API. Prioritise this — it's what makes the HAL defense-spending demo work end to end.

### 2.5 News — first-party publisher RSS, no keys

All returned 200 with real, direct article URLs from a datacenter IP:

| Feed | Items |
|---|---|
| `economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms` | 50 |
| `thehindubusinessline.com/markets/feeder/default.rss` | 60 |
| `livemint.com/rss/markets` | 35 |
| `business-standard.com/rss/markets-106.rss` | 35 |
| `moneycontrol.com/rss/marketreports.xml` | 4 |

Use these, **not** Google News RSS — its links are opaque redirect tokens that don't decode to real URLs, making them useless as citations (and its robots.txt explicitly blocks AI crawlers).

### 2.6 MoneyControl price API — free bonus cross-check

```
https://priceapi.moneycontrol.com/pricefeed/nse/equitycash/RI
```
No key, no headers. Returns `PE`, `P_C`, `BV`, `MKTCAP`, 52W high/low, price. Good sanity-check against screener. (Their `techCharts/.../history` endpoint is 403 — skip it.)

---

## 3. TIER 2 — only if we're ahead of schedule

- **Tavily** — 1,000 credits/mo, no card, no dev-only restriction. Best keyed option for citation search. Scope `include_domains` to ET/Mint/BS/Moneycontrol/pib.gov.in.
- **Upstox** — the only broker with a **1-year read-only "Analytics Token"** (unattended server auth) and a real fundamentals API (`/v2/fundamentals/{isin}/key-ratios` → P/E, P/B, ROA, ROE, ROCE, EV/EBITDA with sector benchmarks; effective 11 May 2026, which is why older comparisons miss it). **Blocker: needs an Upstox demat account.** Only pursue if someone on the team already has one — KYC will eat the hackathon. Note it does **not** document EPS, D/E or market cap (derivable from its Income Statement / Balance Sheet endpoints), so **screener.in is strictly better for us anyway** — it gives all of those directly.
- **Serper.dev** — 2,500 free one-off queries, no card, `gl=in&hl=en` surfaces Indian outlets well.
- **Exa** — $20 signup credit. Note its ToS §4.2 is restrictive about redistributing retrieved content.
- **Marketaux** — only free tier with real structured India coverage, but 100 req/day × 3 articles. News + sentiment only.

---

## 4. TIER 3 — do not attempt

- **Yahoo Finance** ❌ **429 on every attempt** — query1 and query2, chart and quoteSummary, with and without browser UA. This is datacenter-IP reputation blocking. **It may work on your laptop and die the instant we deploy.** This is *the* classic hackathon trap. Avoid entirely.
- **NSE `quote-equity`** — 403, unfixable from datacenter IPs.
- **Zerodha Kite / 5paisa** — tokens expire daily by regulation, browser OAuth only. Disqualified for an unattended backend.
- **Groww / Dhan** — ₹499/mo each.
- **NewsAPI.org / GNews / Finnhub** — all three have hard *legal* blockers in their own terms (dev-environment-only, non-commercial-only, personal-use-only respectively). Finnhub company news is North America only.
- **Polygon** (now Massive.com), **Twelve Data, FMP, Tiingo, EODHD** — no India coverage on free plans; Tiingo has none at all.
- **Stooq** (JS proof-of-work wall), **Trendlyne / Tickertape** (404).

---

## 5. Your scaffold — it already exists, go fill it in

`packages/sources` is scaffolded and type-checks. **You are not starting from a
blank page.** Here is what's there and what you do to each file.

```
packages/sources/
  src/
    verify-endpoints.ts   ✅ DONE — RUN THIS FIRST (see below)
    http.ts               ✅ DONE — caching, rate limiting, per-host headers
    cache.ts              ✅ DONE — disk cache, so we never get rate-limited
    snapshot.ts           ✅ DONE — loads the committed snapshot
    index.ts              ✅ DONE — the SourcesApi the engine calls
    fetchers/
      bse.ts              🟡 mostly done — scrip master, quote, announcements
      screener.ts         🟡 search + price history done; fundamentals regex = YOUR JOB
      nse.ts              ✅ DONE — announcements, NIFTY list, bhavcopy
      rss.ts              ✅ DONE — SEBI/RBI/PIB + 4 news feeds, parsed
    build-snapshot.ts     🔴 YOUR MAIN JOB — 4 steps, each marked TODO
  data/snapshot/
    _TEMPLATE.stock.json     ← copy this per company
    _TEMPLATE.document.json  ← copy this per document
    stocks/HAL.json          ✅ seeded, use as a worked example
    documents/*.json         ✅ 4 seeded
    glossary.json            ✅ 8 terms done, add ~17 more
```

### Step 0 — before anything else, run this

```bash
bun run --filter @bit-n-build-2026/sources verify:endpoints
```

Hits all 11 endpoints and prints which work **today**. These are undocumented and
two previously well-documented ones are already dead. 30 seconds now saves you an
hour at 3am. Anything red: don't fight it, use the snapshot, move on.

### Step 1 — hand-write the demo-critical files FIRST

Before writing any fetching code. Copy `_TEMPLATE.stock.json` and fill in BEL and
BDL by reading screener.in in your browser. Copy `_TEMPLATE.document.json` for the
PIB budget document and the "already priced in" article.

**Commit that.** At that point the demo works and nobody is blocked on you, ever.
Everything after this is upgrade.

### Step 2 — then automate, in `build-snapshot.ts`

Four steps, each independent, each marked `TODO(tushar)`. Commit after each.

1. `step1_symbolMap` — ✅ already written. BSE scrip master → ticker/ISIN/BSE-code map
2. `step2_stocks` — screener fundamentals + price history + BSE quote per ticker
3. `step3_officialDocs` — the citation moat. **Highest value step in the file.**
   NSE `attchmntText` gives you official filing text already in plain English
4. `step4_news` — publisher RSS, filtered to covered tickers

### The rules baked into the scaffold

- **`writeIfAbsent` never clobbers a hand-written file.** A failed fetch can't
  destroy your work.
- **Every request goes through `http.ts`** — it caches to disk and rate-limits
  screener.in to 1 req/sec. Don't bypass it.
- **BSE needs `Referer` + `Origin`** or it 301s to an HTML page and you get a
  silent wrong answer. Already handled; the fetchers assert on response shape.
- **Never guess a number.** `null` renders as an honest dash. A guessed figure
  breaks the one promise the whole product is built on.

### Prompts you can paste to your AI

Start each with: *"Read `docs/handoff-sources.md` and the existing files in
`packages/sources/src/`. Follow the existing patterns exactly — use `getJson`/
`getText` from `http.ts`, never raw fetch."*

1. > Implement `fetchFundamentals` in `packages/sources/src/fetchers/screener.ts`.
   > It fetches the company page HTML (already wired) and extracts Market Cap,
   > Stock P/E, Book Value, ROCE, ROE and Dividend Yield from the ratios list at
   > the top using regex. Return `null` for anything not found — never guess.
   > Add a small test that runs it against RELIANCE and prints the result.

2. > Implement `step2_stocks` in `build-snapshot.ts`. For each ticker in COVERED:
   > screener `searchCompany` for the id, `fetchFundamentals`, `fetchPriceHistory`,
   > and BSE `fetchQuote` using the bseCode from the symbol map. Assemble a
   > `StockRecord` matching `_TEMPLATE.stock.json` and call `writeIfAbsent`.
   > Leave `business` and the risk `reason` fields as TODO strings — those are
   > hand-written.

3. > Implement `step3_officialDocs`. For each covered ticker call NSE
   > `fetchAnnouncements`, convert each into a `SourceDocument` with tier
   > "filing", using `attchmntText` as `text` and `attchmntFile` as `pdfUrl`.
   > Chunk `text` into ~500-token pieces. Also filter the SEBI/RBI/PIB feeds to
   > items mentioning our sectors and write those with tier "official".

---

## 6. What the data has to look like

### Reference: schemas

### 5.1 The snapshot — hour 1

`packages/sources/data/snapshot/` committed to git.

Pick ~20 stocks that make the demo work. Suggested: a defense cluster (HAL, BEL, BDL — needed for the hero demo), a few household names (RELIANCE, TCS, INFY, TATAMOTORS, ITC), a couple of PSU/power names, one high-P/E story, one high-debt story, and one recent IPO. **Contrast is what makes the comparisons interesting** — include at least one clearly overvalued and one clearly indebted company.

```
data/snapshot/
  index.json              # list of covered stocks
  stocks/HAL.json
  documents/<docId>.json
  news/<itemId>.json
  glossary.json
```

### 5.2 Schemas

```ts
// stocks/<TICKER>.json
interface StockRecord {
  ticker: string;              // NSE symbol, our canonical id
  bseCode: string | null;
  isin: string | null;
  name: string;
  sector: string;
  business: string;            // 2 plain-English sentences, NO jargon. Hand-write these
  price: {
    last: number; change: number; changePct: number;
    dayHigh: number; dayLow: number;
    week52High: number; week52Low: number;
    asOf: string;              // ISO
    sourceId: string;
  };
  metrics: MetricRecord[];
  history: { date: string; close: number }[];   // daily, 1y is plenty
  sectorMedians: Record<string, number>;        // { pe: 19.2, ... } — needed for comparisons
  documentIds: string[];
  newsIds: string[];
}

interface MetricRecord {
  key: string;                 // 'pe' | 'eps' | 'market_cap' | 'debt_to_equity' | 'roe' | 'roce' | 'book_value' | 'dividend_yield' | 'promoter_holding'
  label: string;
  value: number | null;
  display: string;             // '28.4'  |  '₹1,70,171 Cr'
  unit: string | null;
  asOf: string;
  sourceId: string;            // ← mandatory. No metric without one
}

// documents/<docId>.json — filings, announcements, govt releases
interface SourceDocument {
  id: string;
  title: string;
  publisher: string;           // 'PIB' | 'SEBI' | 'NSE' | 'BSE' | 'HAL' | 'Business Standard'
  tier: 'official' | 'filing' | 'press' | 'market_data' | 'social';
  url: string | null;
  pdfUrl: string | null;
  publishedAt: string | null;
  tickers: string[];           // which companies this touches
  sectors: string[];
  text: string;                // full plain text (attchmntText is perfect for this)
  chunks: { id: string; text: string }[];   // ~500 tokens each, for embedding
}
```

**Tier mapping** — this drives the badge on screen, so get it right:

| tier | what goes here |
|---|---|
| `official` | PIB, SEBI, RBI, Budget, exchange circulars |
| `filing` | Company announcements, results, investor presentations, annual reports |
| `press` | ET, Mint, Business Standard, Hindu BusinessLine, Moneycontrol |
| `market_data` | Prices, ratios, bhavcopy, screener figures |
| `social` | Anything from social media. **We ingest it to argue against it**, never as evidence |

### 5.3 The interface Ashwath calls

Keep this small and stable — it's the contract:

```ts
export function listStocks(): StockSummary[];
export function getStock(ticker: string): StockRecord | null;
export function getDocument(id: string): SourceDocument | null;
export function searchSources(query: string, opts?: {
  tickers?: string[];
  sectors?: string[];
  tiers?: SourceTier[];
  limit?: number;
}): { chunkId: string; docId: string; text: string; score: number }[];
export function getGlossary(term: string): GlossaryEntry | null;
export function resolveTicker(text: string): { ticker: string; name: string } | null;
```

`searchSources` can start as plain keyword/substring matching. **Ship that first.** Embeddings are an upgrade — Ashwath can layer vector search over your `chunks` later using the merge.dev gateway. Don't build a vector store yourself.

### 5.4 Demo-critical content

For the hero demo (*"defense spending is up, so I should buy HAL"*) you must have, verified and readable:

1. A **PIB or Budget document** confirming the defense allocation increase, with a real URL
2. **HAL's latest results or investor presentation** showing order book / revenue
3. HAL's **fundamentals** — P/E, EPS, D/E, 52-week range — plus defense-sector medians
4. At least **one press piece arguing the increase is already priced in** ← this is the counter-evidence panel. **Without it the demo has no punchline.** Treat it as a required deliverable, not a nice-to-have.

Then the same for the other two demo scenarios (Instagram hype, IPO GMP) if time allows. **HAL first, and completely.**

### 5.5 Glossary

~25 terms, each with a one-liner and **four explanations keyed by level** (`new` / `learning` / `practicing` / `independent`). Terms: P/E, EPS, market cap, 52-week high/low, ROE, ROCE, debt-to-equity, book value, dividend yield, promoter holding, order book, "priced in", GMP, IPO, volatility, delivery %, sector median, market/limit order, intraday vs delivery, STCG/LTCG tax.

This is pure content work and needs zero code — **good task to hand the PM** if you're behind.

---

## 7. Suggested first 90 minutes

1. BSE `ListofScripData` once → ISIN ↔ BSE code ↔ NSE symbol table.
2. Hand-pick the 20 tickers. Commit `index.json` immediately.
3. screener.in search → company id; scrape company page → all fundamentals for the 20.
4. BSE `getScripHeaderData` → live price; screener chart API → 1y history.
5. NSE `corporate-announcements` + SEBI/RBI/PIB RSS → the citation layer. **Use `attchmntText`, link the PDF.**
6. Publisher RSS → news, filtered to our 20 tickers.

**Commit after every step.** A half-populated snapshot in git beats a perfect one on your laptop.

---

## 8. Two warnings

1. **These endpoints are undocumented and change without notice.** BSE's `ComprehensiveInd` and NSE's `equity-stockIndices` were working in widely-cited guides and are dead today. **Re-verify each URL at the start of the build** rather than trusting this document — and wrap every fetch in try/catch with a cached fallback. A live fetcher that fails must fall back to the snapshot silently, never crash a stage.
2. **Cache everything to disk on first fetch.** During development we'll hit these endpoints hundreds of times. Don't get us rate-limited on screener.in the hour before judging.
