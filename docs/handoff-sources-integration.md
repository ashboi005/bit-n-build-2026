# Tushar — sources integration tasks

> **How to use this file:** paste it whole into your AI coding agent and say
> *"Read this and do TASK 1."* Then TASK 2, then TASK 3. One task per message.
> Every task is self-contained and has acceptance criteria you can check.
>
> This is a hackathon. **Do not refactor anything, do not add tests, do not
> improve code quality.** Just make the data complete.

---

## Context for the agent

`packages/sources` is committed and working. The backend runs on it right now:
20 stocks, 43 documents, real provenance, layered library → snapshot → cache.
Nothing in this file asks you to change that architecture.

**STATUS (updated after commit 30b24c4): TASKS 1–5 are DONE and verified working.**
Sector medians, risk arrays, 52-week ranges, `eps`, `debt_to_equity` and
`listDocuments()` all landed and the backend is running on them.

**Only TASK 0 below is outstanding**, and it is urgent — it makes the comparisons
TASK 1 built actively misleading. Read TASK 0, do it, and re-run TASK 1's median
derivation. Treat TASKS 1–5 as reference for how things were built.

Two small leftovers worth fixing while you are in there:
- **BDL** has no figures at all (`pe`, `market_cap`, `eps` … all `null`), so it has
  no risk entries and no 52-week range. Its consolidated screener page is empty —
  try the standalone page (`/company/BDL/` without `/consolidated/`).
- **HAL** has `sectorMedians: {}` because it is currently alone in "Defence".
  TASK 0 fixes this by putting BEL and BDL in the same sector.

**Files you will edit:**
- `packages/sources/data/snapshot/stocks/*.json` — 20 files
- `packages/sources/src/build-snapshot.ts` — so a rebuild keeps the fix
- `packages/sources/src/index.ts` — one small addition in TASK 4

**Type definitions live in** `packages/contracts/src/stocks.ts`. Read that file
first. Match the types exactly — `bun run check-types` must stay clean.

**The unbreakable rule of this codebase:** never invent a number. If a figure
isn't available, the field is `null`. A `null` renders as an honest dash. A
guessed number breaks the one promise the product is built on.

---

# ✅ TASK 0 — DONE (Ashwath did this, do not redo it)

Sectors were `"Unclassified"` on 19 of 20 stocks, so everything shared one blended
P/E median of 17.05 across banks, IT, oil, power and retail. That has been fixed
directly in the snapshot files. **Read this section for what changed, then make
sure `build-snapshot.ts` reproduces it — otherwise the next rebuild wipes it.**

## The problem

Only HAL has a real sector. Every other stock is `"Unclassified"`, so all 19 land
in one bucket and share a single blended P/E median of **17.05** — computed across
banks, IT, oil, power, retail, EV and defence together.

HAL, being alone in "Defence", gets **no median at all**, so the hero demo company
has no sector comparison on any metric.

## Why this is worse than having no median

The product currently says, on screen, to a beginner:

```
ONGC   ✓ Valuation below sector: P/E of 6.69, below the sector median of 17.05
INFY   ✓ Valuation below sector: P/E of 13.5, below the sector median of 17.05
```

Both are misleading:

- **Oil PSUs structurally trade around a P/E of 6–8.** ONGC at 6.69 is completely
  normal for its sector, not cheap. We are presenting it as a bargain because we
  compared it to retail and IT companies.
- **Infosys at 13.5 sits right on the IT median** (TCS is 14.8). It is not cheap
  relative to its peers. We are calling it cheap because banks and oil dragged the
  blended median around.
- The card also literally displays the word **"Unclassified"** as the sector.

Our entire product promise is that we don't tell beginners confident things that
aren't true. A wrong comparison delivered with a citation is worse than no
comparison at all.

## What was changed (mirror this in `build-snapshot.ts`)

Real sectors assigned, medians recomputed per sector, metric `sectorMedian` and
`direction` refreshed, and the `valuation` / `debt` risk rows regenerated — those
had been derived from the old blended median and were wrong.

Three rules were applied that the builder must keep:

1. **A sector needs at least 2 companies with a value** before a median is written.
   Single-member sectors get `sectorMedians: {}` and `direction: "unknown"`.
   Do **not** fall back to an all-stock median — that fallback is the original bug.
2. **A `valuation` risk row is omitted when P/E is within 5% of the median.**
   Being at the median is not a valuation story, and padding the watch-out list
   makes the real flags matter less.
3. **A `debt` row is omitted when both the value and the median are below 0.05.**
   HAL was briefly flagged `debt: high — 0.01 vs median 0.01`, which is nonsense:
   a company with essentially no debt must never be flagged high-risk because a
   peer has marginally less.

```
ATHER       Automobile
BDL         Defence
BEL         Defence
ETERNAL     Consumer Tech
HAL         Defence
HDFCBANK    Banking
ICICIBANK   Banking
IDEA        Telecom
INFY        Information Technology
IREDA       Financials
ITC         FMCG
NTPC        Power
ONGC        Oil & Gas
POWERGRID   Power
RELIANCE    Oil & Gas
SUZLON      Renewable Energy
TATAMOTORS  Automobile
TATAPOWER   Power
TCS         Information Technology
TRENT       Retail
```

Put this mapping in `build-snapshot.ts` so a rebuild keeps it. These are public
facts about what each company does, not derived figures.

## ⚠️ Sectors with fewer than 2 companies

After this mapping, several sectors have only one member (Telecom, Retail,
Consumer Tech, Renewable Energy, Financials). **Omit the median key entirely for
those** — as TASK 1 already says, never write a median computed from one company.

Those stocks will show no sector comparison, which is correct and honest: we do
not have peers to compare them against. Do **not** fall back to an all-stock
median to fill the gap — that is exactly the bug this task fixes.

If you want more comparisons, the better fix is adding a second company to a thin
sector, not widening the comparison group.

## Result

| sector | n | median P/E |
|---|---|---|
| Defence (HAL, BEL, BDL) | 3 | 41.65 |
| Power | 3 | 15.8 |
| Banking | 2 | 15.7 |
| Information Technology | 2 | 14.15 |
| Oil & Gas | 2 | 14.75 |
| Automobile | 2 | — (only one has a P/E) |
| FMCG, Retail, Telecom, Financials, Consumer Tech, Renewable | 1 each | — (no peers) |

Before and after, for the same two companies:

```
BEFORE   INFY  13.5  vs blended 17.05  -> "low"     (misleading: IT median is 14.15)
         ONGC  6.69  vs blended 17.05  -> "low"     (misleading: oil PSUs trade there)
AFTER    INFY  13.5  vs IT      14.15  -> "normal"  (correct)
         ONGC  6.69  vs Oil&Gas 14.75  -> "low"     (correct, and a fair peer group)
```

## Remaining acceptance criteria

- [x] No stock has `sector: "Unclassified"`
- [ ] Defence (HAL, BEL, BDL) has a real median, and HAL's metrics show it
- [ ] Banking, Power, IT, Oil & Gas, Automobile each have a median from ≥2 members
- [ ] Single-member sectors have `sectorMedians: {}` and `direction: "unknown"`
- [ ] `ONGC` is no longer described as "below the sector median"
- [ ] Discovery for "something cheap" no longer returns ONGC and INFY together
      on the basis of one blended median

---

# TASK 1 — populate `sectorMedians` (highest value)

## The problem

Every one of the 20 stock files has:

```json
"sectorMedians": {}
```

## What this breaks right now

- Every "compared to its sector" line in the product is dead. `Metric.sectorMedian`
  is `null`, so the UI cannot say *"P/E 35.2 against a sector median of 19.2"* —
  which is the single most useful sentence we produce for a beginner.
- Every metric's `direction` falls back to `"unknown"`, so no high/low indicator
  renders anywhere.
- The discovery feature (`packages/engine/src/discovery.ts`) filters "I want
  something cheap" and "I want low debt" by comparing against the median. With an
  empty object it can never match, so those queries return nothing.

## What to do

1. Load all 20 files in `packages/sources/data/snapshot/stocks/`.
2. Group them by their `sector` field (exact string match).
3. For each sector group, compute the **median** — not the mean — of these keys,
   reading each stock's `metrics[]` array and using `metric.value`:
   `pe`, `roe`, `roce`, `dividend_yield`, `market_cap`, and `debt_to_equity`
   if present.
4. Skip `null` values when computing. If fewer than 2 stocks in the sector have a
   value for a key, **omit that key entirely** rather than writing a median of one.
5. Write the result into `sectorMedians` on **every** stock in that group.
6. Then, for every metric in every stock, set `sectorMedian` to the matching value
   from `sectorMedians` (or `null` if absent) and set `direction`:
   - `"high"` if `value > median * 1.15`
   - `"low"` if `value < median * 0.85`
   - `"normal"` otherwise
   - `"unknown"` if there is no median

**Use median, not mean.** One Nestle at P/E 72 drags a mean into nonsense.

## Expected shape

```json
"sectorMedians": {
  "pe": 19.2,
  "roe": 15.4,
  "roce": 18.1,
  "dividend_yield": 1.2,
  "market_cap": 295571
}
```

## Also update the builder

Add this as a step in `packages/sources/src/build-snapshot.ts` so a rebuild
recomputes medians instead of wiping them back to `{}`.

## Acceptance criteria

- [ ] No stock file has `"sectorMedians": {}` (unless it is alone in its sector)
- [ ] `bun run check-types` is clean
- [ ] `curl -s localhost:3000/api/stocks/HAL | grep sectorMedians` shows numbers
- [ ] Metrics have non-null `sectorMedian` and a `direction` other than `"unknown"`

---

# TASK 2 — populate the `risk` array on every stock

## The problem

19 of 20 stock files have `"risk": []`.

## What this breaks right now

Sayam has already built `apps/web/src/components/stocks/risk-breakdown.tsx` and
it renders nothing. The discovery feature's "I want something steady" filter and
its watch-out list both read from this array.

## What to do

Give every stock **four** risk entries. Derive each one mechanically from figures
already in the file. Read the `RiskFactor` type in
`packages/contracts/src/stocks.ts` — the shape is:

```json
{
  "key": "volatility",
  "label": "Price volatility",
  "level": "medium",
  "reason": "Over the past year the price moved between ₹3,479 and ₹5,150 — a swing of about 48% from its low.",
  "sourceIds": ["screener_hal_fundamentals"]
}
```

### The four keys — use exactly these strings

| `key` | `label` | derive from | bands |
|---|---|---|---|
| `volatility` | Price volatility | `(price.week52High - price.week52Low) / price.week52Low` | `>0.7` → high, `>0.35` → medium, else low |
| `valuation` | Valuation | `pe` vs `sectorMedians.pe` | `>30%` above → high, `>20%` below → low, else medium |
| `debt` | Debt | `debt_to_equity` vs its sector median | same shape as valuation |
| `stability` | Business returns | `roe` | `>18` → low, `>10` → medium, else high |

### ⚠️ Calibrate volatility against Indian reality — this matters

I first used `>0.4 = medium` and it labelled a **66% annual swing as "steady"**,
which then matched a user query asking for *something safe*. That is precisely the
reassuring half-truth this product exists to remove. The bands above are
calibrated against the actual spread of our 20 companies. **Use them as given.**

### Rules for `reason`

- One plain sentence, written for someone who has never bought a share.
- **State the actual numbers it was derived from.** "Price volatility is medium" is
  useless. "The price moved between ₹3,479 and ₹5,150 — a swing of about 48%" is
  the product.
- No jargon without expanding it.

### Rules for `sourceIds`

- Must reference a real document id that exists in
  `packages/sources/data/snapshot/documents/`.
- Use whichever document the underlying figure came from — usually the
  `screener_*_fundamentals` or `bse_*_market_data` doc for that stock.
- **Never leave this empty.** A risk level with no source is exactly what the
  product argues against, and the engine drops uncited claims anyway.

### If the input figure is missing

Skip that risk entry entirely. Do **not** emit a level with a made-up reason.
Three honest entries beat four with one invented.

## Also update the builder

Add the derivation to `build-snapshot.ts` so rebuilds keep it.

## Acceptance criteria

- [ ] Every stock has 3–4 risk entries
- [ ] Every entry has a non-empty `reason` containing real numbers
- [ ] Every entry has at least one `sourceIds` value that exists on disk
- [ ] Only `volatility`, `debt`, `valuation`, `stability` appear as keys
- [ ] No stock with a >60% 52-week swing is rated `"low"` volatility

---

# TASK 3 — fix `week52High` / `week52Low` (currently `null`)

## The problem

Every stock has:

```json
"price": { "week52High": null, "week52Low": null, ... }
```

TASK 2's volatility derivation depends on these, and the glossary already defines
a `week52_range` term that has no metric to attach to.

## Why the current parser misses them

Screener renders High / Low as **two** `<span class="number">` inside a single
value span, so a regex expecting one number per row finds nothing:

```html
<span class="name"> High / Low </span>
<span class="nowrap value">₹ <span class="number">5,150</span> / <span class="number">3,479</span></span>
```

## What to do

1. Add a parser in `build-snapshot.ts` that captures **both** numbers:

```ts
const re = /<span class="name">\s*High\s*\/\s*Low\s*<\/span>[\s\S]{0,300}?<span class="number">([\d.,]+)<\/span>\s*\/\s*<span class="number">([\d.,]+)<\/span>/i;
```

   First capture is the **high**, second is the **low**. Strip commas, then `Number()`.

2. Write them into `price.week52High` and `price.week52Low`.

3. Add a `week52_range` metric to each stock:

```json
{
  "key": "week52_range",
  "label": "52-week range",
  "value": null,
  "display": "₹3,479 – ₹5,150",
  "unit": "INR",
  "sectorMedian": null,
  "direction": "high",
  "explanation": "",
  "sourceIds": ["screener_hal_fundamentals"]
}
```

   - `value` stays `null` — it is a range, not a single number. The UI reads `display`.
   - `direction`: where the current price sits in the range —
     `>70%` of the way up → `"high"`, `<30%` → `"low"`, else `"normal"`.
   - **Leave `explanation` as an empty string.** The AI writes it at request time,
     at the individual user's level. Do not fill it in.

## Acceptance criteria

- [ ] Every stock has non-null `week52High` and `week52Low`
- [ ] `week52High > week52Low` on every stock
- [ ] Every stock has a `week52_range` metric with a `display` like `"₹3,479 – ₹5,150"`
- [ ] TASK 2's volatility entries now compute

---

# TASK 4 — add `listDocuments()` to the sources API

## The problem

The RAG indexer currently walks each stock's `documentIds` to find documents.
A document that **no stock links to is invisible to retrieval** — a PIB release
about the defence budget that nobody attached would never be found.

## What to do

In `packages/sources/src/index.ts`, inside the object returned by
`createSources(...)`, add:

```ts
listDocuments(): SourceDocument[] {
  return [...snapshot.documents.values()];
},
```

Then add the same method signature to the `SourcesApi` interface in
`packages/contracts/src/stocks.ts`:

```ts
listDocuments(): SourceDocument[];
```

**Tell Ashwath when this lands** — there is a workaround in
`apps/server/src/services.ts` that switches over to this in one line.

## Acceptance criteria

- [ ] `bun run check-types` clean across the repo
- [ ] `curl -s localhost:3000/api/health` shows a higher `vectors.points` count

---

# TASK 5 — add the two missing metrics

## What to do

Add these to every stock where the figure is available on the screener page:

| `key` | `label` | notes |
|---|---|---|
| `eps` | EPS | In the glossary, referenced in prompts, commonly asked about |
| `debt_to_equity` | Debt to equity | The `debt` risk row and the "low debt" discovery filter both need it |

Follow the same `Metric` shape as TASK 3. `explanation` stays `""`.

Also: `previous_close` is currently emitted as a metric but has **no glossary
entry**, so tap-to-explain will 404 on it. Either add a glossary entry or drop the
metric — it isn't useful to a beginner.

## Acceptance criteria

- [ ] `eps` and `debt_to_equity` present wherever screener has them, `null` elsewhere
- [ ] `curl -s "localhost:3000/api/glossary/previous_close"` does not 404,
      or the metric is gone

---

# Rules that apply to every task

### Key names are matched by exact string

`metric.key` → glossary `key` → `sectorMedians` key are all exact matches.
`pe` everywhere — not `PE`, not `stock_pe`, not `p_e`. Same for the four risk keys.

### Never change the `SourcesApi` signature without telling Ashwath

The engine, the RAG indexer and the discovery filter all call it. **Adding** a
method is free. Changing a signature or renaming a field breaks all three
silently. Message him and both sides get changed at once.

### `explanation` on metrics stays empty

The AI writes it per-request at the user's level. Filling it in means everyone
gets the same explanation, which defeats the whole personalisation feature.

---

# How to verify your work

```bash
bun run check-types
bun run --filter server dev
curl -s localhost:3000/api/health

# sector comparisons alive?
curl -s localhost:3000/api/stocks/HAL | python3 -m json.tool | grep -A6 sectorMedians

# risk breakdown alive?
curl -s localhost:3000/api/stocks/HAL | python3 -m json.tool | grep -A4 '"risk"'
```

Then sign up through the web app and run a real query. If a stock appears in
discovery with no matched reasons, or a comparison says nothing, it is one of the
tasks above.

---

# Priority if you run out of time

1. **TASK 1** — `sectorMedians`. Unlocks comparisons, directions, discovery filters
2. **TASK 2** — `risk`. Unlocks a screen Sayam has already built
3. **TASK 3** — 52-week range. Unlocks the range metric and feeds TASK 2
4. TASK 5 — `eps`, `debt_to_equity`
5. TASK 4 — `listDocuments()`

Tasks 1–3 are pure arithmetic over data already on disk. They need no network.
