# Sayam — the Comparison Tool

> **How to use this file:** paste it whole into your AI coding agent and work
> through the tasks in order. Read `docs/handoff-frontend.md` first for the repo
> gotchas (Next 16, Tailwind v4, React Compiler, `@/env` not `process.env`).
>
> Hackathon rules apply: **no refactors, no tests, no code-quality passes.**

---

## What this is, and why it matters

A **pure data tool with no AI in it at all.** Pick two or three companies, see
their numbers side by side against their sector, and read what each number means.

Two reasons this earns its place:

1. **Comparison is how beginners actually decide.** Our user interview asked "if
   you had to choose between two companies in the same industry, how would you
   decide?" — and the answer was "I'd want to see them side by side". This is
   that, directly.
2. **It proves the data is real.** When a judge is sceptical of the LLM, this is
   the screen you show them. No generation, no retrieval, no prompt — just
   figures from Screener and BSE with citations. If the AI half were switched
   off entirely, this page would still work.

**Do not add AI to this page.** No summaries, no "which is better", no verdict.
The moment it recommends one, it becomes the thing the whole product argues
against. Its value is precisely that it does not.

---

## The data you have

Everything comes from endpoints that already exist and are already wired.

```
GET /api/stocks              → StockSummary[]     the 20 covered companies
GET /api/stocks/:ticker      → StockRecord        everything about one
GET /api/glossary/:term      → GlossaryEntry      what a metric means
```

`credentials: "include"` on every call.

### `StockSummary` — for the picker

```ts
{ ticker: "HAL", name: "Hindustan Aeronautics Ltd", sector: "Defence",
  last: 4898.75, changePct: -1.14 }
```

### `StockRecord` — the real shape, from HAL right now

```jsonc
{
  "ticker": "HAL",
  "name": "Hindustan Aeronautics Ltd",
  "sector": "Defence",
  "business": "Hindustan Aeronautics designs and builds aircraft, helicopters and aero-engines. Almost all of its work comes from Indian defence programmes.",

  "price": { "last": 4898.75, "change": -56.25, "changePct": -1.14,
             "week52High": 5150, "week52Low": 3479,
             "asOf": "2026-09-11T10:30:00.000Z", "sourceId": "bse_hal_quote" },

  "metrics": [ /* see table below */ ],
  "sectorMedians": { "pe": 48.1, "roe": 24, "roce": 32,
                     "dividend_yield": 0.62, "market_cap": 295571,
                     "debt_to_equity": 0.0065 },
  "risk": [ { "key": "volatility", "label": "Price volatility", "level": "medium",
              "reason": "The price moved between ₹3,479 and ₹5,150 over 52 weeks — a swing of about 48% from its low.",
              "sourceIds": ["bse_hal_quote"] } ],
  "history": [ { "date": "2025-09-12", "close": 4745.6 }, /* … 248 points */ ],
  "documentIds": [ "screener_hal_fundamentals", "nse_hal_…", /* 11 */ ]
}
```

### The metrics, exactly as they arrive

| `key` | `label` | `display` | `sectorMedian` | `direction` |
|---|---|---|---|---|
| `previous_close` | Previous close | `4,955 INR` | null | unknown |
| `market_cap` | Market capitalization | `3,28,034 Cr` | 295571 | normal |
| `pe` | P/E ratio | `35.2` | 48.1 | **low** |
| `book_value` | Book value | `614` | null | unknown |
| `roce` | ROCE | `32%` | 32 | normal |
| `roe` | ROE | `24%` | 24 | normal |
| `dividend_yield` | Dividend yield | `0.92%` | 0.62 | **high** |
| `eps` | EPS | `12.17` | null | unknown |
| `debt_to_equity` | Debt to equity | `0.01` | 0.0065 | **high** |
| `week52_range` | 52-week range | `₹3,479 – ₹5,150` | null | high |

**Read `display`, never `value`.** `display` is pre-formatted with Indian
digit grouping and the right unit. `value` is the raw number, there for sorting
and for your own arithmetic.

---

## 🚨 Four rules that are not style preferences

### 1. `direction` is a comparison, not a grade

`"high"` means *above the sector median*. It does **not** mean good or bad, and
which one it means flips by metric:

- `pe: high` → more expensive than peers
- `roe: high` → more profitable than peers
- `debt_to_equity: high` → more borrowed than peers
- `dividend_yield: high` → pays out more than peers

So **do not colour green/red by direction.** Use a neutral up/down indicator
(▲ ▼ ▬) meaning "above / below / in line with sector". If you colour P/E red for
being high and ROE green for being high, you have silently invented a
recommendation engine.

### 2. `sectorMedian: null` means we have no honest comparison

A sector needs at least two companies with that figure before a median is
written. Six of our twelve sectors have only one company in them, so their
medians are legitimately absent.

**Render an em dash and no indicator.** Never fall back to an all-stock median —
comparing a bank's P/E to a pharma company's was a real bug we fixed, and it told
users Infosys was cheap when it sits exactly on the IT median.

### 3. Only compare within a sector, and say so when you can't

The whole point is peers. If the user picks HAL and TCS, show the numbers but
**say plainly that they are not comparable**:

> ⚠️ These are in different sectors (Defence and Information Technology). The
> sector comparisons below are each against their own peers, so the columns
> don't measure the same thing.

Nudge toward same-sector picks in the picker (see TASK 1), but don't block it —
people will want to look anyway, and telling them why it's misleading teaches
more than refusing.

### 4. Every number needs its citation

`metric.sourceIds` and `risk[].sourceIds` both carry real document ids. Make them
clickable, the same way the thesis screen already does. This is the screen where
sourcing matters most, because it's the one a sceptical judge will poke at.

---

# TASK 1 — the picker

Route: `/compare`.

```ts
const stocks = await fetch(`${ENV.NEXT_PUBLIC_SERVER_URL}/api/stocks`,
  { credentials: "include" }).then(r => r.json());
```

- **Group by sector** in the dropdown. Sector is the organising idea of the whole
  page, so it should be the organising idea of the picker.
- **2 or 3 companies**, no more. Four columns stops being readable on a laptop.
- When one is chosen, **surface its sector-mates first** — "others in Defence:
  BEL, BDL" — so the useful comparison is one click away.
- Put the selection in the URL: `/compare?tickers=HAL,BEL,BDL`. Shareable, and
  it survives a refresh.

Our 20 companies across 12 sectors:

```
Defence (3)      HAL, BEL, BDL
Power (3)        NTPC, POWERGRID, TATAPOWER
Banking (2)      HDFCBANK, ICICIBANK
Info Tech (2)    TCS, INFY
Oil & Gas (2)    RELIANCE, ONGC
Automobile (2)   TATAMOTORS, ATHER
FMCG (1)         ITC
Retail (1)       TRENT
Telecom (1)      IDEA
Financials (1)   IREDA
Consumer Tech(1) ETERNAL
Renewable (1)    SUZLON
```

**Acceptance:** grouped by sector · 2–3 selectable · sector-mates suggested ·
selection in the URL.

---

# TASK 2 — the comparison table

Fetch each `/api/stocks/:ticker` in parallel and render one column per company.

```
                        HAL              BEL              BDL       Defence median
────────────────────────────────────────────────────────────────────────────────
What they do       Builds aircraft… Makes radar…     Builds missiles…
Price                  ₹4,898.75        ₹405.50        ₹1,190
52-week range     ₹3,479–₹5,150    ₹380–₹473      ₹1,086–₹1,655
────────────────────────────────────────────────────────────────────────────────
P/E ratio            35.2  ▼          48.1  ▬         83.8  ▲            48.1
Market cap      ₹3,28,034 Cr ▬   ₹2,95,571 Cr ▬   ₹43,621 Cr ▼      ₹2,95,571 Cr
ROE                    24%  ▬         25.7% ▬         10.2% ▼             24%
ROCE                   32%  ▬         34.2% ▬          …                  32%
Dividend yield       0.92%  ▲         0.62% ▬          …                0.62%
Debt to equity        0.01  ▲        0.0065 ▬          …               0.0065
────────────────────────────────────────────────────────────────────────────────
Volatility          Medium           Low              Medium
Valuation              Low            —                High
Business returns       Low            Low              Medium
```

### How to build it

- **Rows are metric keys, columns are companies.** Union the `metrics` arrays, in
  a fixed order you control — don't rely on array order, and don't render a row
  that every selected company is missing.
- **The median column** comes from `sectorMedians`. Show it only when all
  selected companies share a sector; otherwise drop the column and show the
  different-sectors warning from rule 3.
- **The indicator** is `direction`: ▲ above sector · ▼ below · ▬ in line ·
  nothing when `unknown`. Neutral colour. A tooltip saying "above the Defence
  sector median of 48.1" is worth the five minutes.
- **Every metric label is tappable** → `GET /api/glossary/:key?level=new` →
  popover. The keys match glossary keys exactly, so `pe` → `/api/glossary/pe`.
  (`previous_close` may 404 — handle it, don't crash.)
- **Risk rows** use `risk[].level` and show `risk[].reason` on hover or below.
  **Never show a level without its reason** — a bare "Medium" teaches nothing,
  and the reason is the actual product.
- **Missing data is a dash.** Several companies genuinely lack figures (ATHER has
  almost none). A dash is honest; a zero is a lie.

**Acceptance:** one column per company · fixed row order · median column only for
same-sector · neutral indicators · tappable labels · risk reasons visible · dashes
for missing.

---

# TASK 3 — the price chart

`history` is 248 daily closes per company, oldest first:

```ts
{ date: "2025-09-12", close: 4745.6 }
```

**Normalise to percentage change from day one**, don't plot raw rupees. HAL at
₹4,898 and BEL at ₹405 on the same axis makes BEL a flat line at the bottom —
useless. Rebasing to 0% at the start shows what you actually want: *which one
moved more*.

- One line per company, colour-matched to its table column.
- Y axis in %, with a zero line.
- Hover shows the date and each company's % change on that date.
- Label it **"Price change over the last year"**, not "Performance" — performance
  implies a judgement.
- No moving averages, no indicators, no candlesticks. This is not a trading
  terminal and a beginner cannot read one.

**Library:** `recharts` (`bun add recharts --filter web`) is fine here and worth
it for the tooltip. If you'd rather not add a dependency, a `<polyline>` in an
SVG over 248 normalised points is genuinely about 30 lines.

**Acceptance:** normalised to % · one line per company · zero line · hover with
date and values · no indicators.

---

# TASK 4 — hand off to the AI half

The comparison tool answers *what*. The rest of the product answers *why*. Close
the loop with one control per company at the bottom of its column:

> **Thinking about HAL? Tell us why →**

That drops the ticker into the thesis input so the user types their **reasoning**,
and the investigation runs. One line of routing; it's what stops this being an
orphan page.

**Acceptance:** each column links into the thesis flow with its ticker prefilled.

---

## Design direction

- **Calm and dense, not flashy.** This is a reference table. Generous row height,
  clear vertical rules between columns, numbers right-aligned and tabular
  (`font-variant-numeric: tabular-nums`) so digits line up.
- **The sector median column is visually secondary** — lighter weight or a tinted
  background. It's context, not a competitor.
- **Mobile:** a three-column table won't fit. Either one company per card with
  the median inline, or a horizontally scrollable table with the metric label
  column pinned. Don't let it squash.
- Theme tokens only — no hardcoded colours, dark mode already works.

## What not to build

No buy/sell buttons. No "winner" or score or star rating. No AI summary of the
comparison. No technical indicators. No alerts. No portfolio integration.

If it finishes early, the best addition is **more metrics with better
explanations**, not more features.

---

## Build order

1. **TASK 1** picker — nothing works without it
2. **TASK 2** table — this is the tool
3. **TASK 4** hand-off — one line, closes the loop
4. **TASK 3** chart — the most visual, but the table is what teaches

Tasks 1, 2 and 4 give you a complete, useful page. The chart is polish.
