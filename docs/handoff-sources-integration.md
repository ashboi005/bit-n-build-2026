# Tushar — linking your sources into the running system

Your `packages/sources` work is **committed, wired in, and the backend is running
on it right now.** 20 stocks, 43 documents, real provenance. The layered
library → snapshot → cache precedence is exactly the right call.

This doc is only about the seams where your data meets the engine. Nothing here
is about code quality — it's a hackathon, and it works. These are the things that
are currently **silently doing nothing** because a field is empty.

---

## What's already live

```
[rag] indexed 43 chunks from 43 documents
```

A real investigation now pulls your tiers in order, and they render with the
right badges:

```
official     PIB
press        Business Standard
filing       Hindustan Aeronautics
market_data  Screener.in
market_data  BSE
```

I didn't change anything in `packages/sources`. I briefly built my own fetchers
before I saw you'd pushed — that's been deleted, your version is what ships.

---

## 🔴 The three gaps that matter

Each of these is a feature that exists, is built, and currently shows nothing.

### 1. `sectorMedians` is `{}` on all 20 stocks

This is the highest-value fix on the page. Without it:

- ❌ Every "compared to its sector" line in the product is dead. `Metric.sectorMedian`
  is null, so the UI can't say "P/E 35.2 against a sector median of 19.2" — which
  is the single most useful sentence we produce for a beginner.
- ❌ `direction` on every metric falls back to `"unknown"`, so no high/low indicator.
- ❌ Discovery ("I want something cheap / low debt") can't filter at all, because
  it compares against the median.

**The fix is arithmetic on data you already have.** Group your stocks by `sector`,
take the median of each metric across that group, and write it into every stock in
the group:

```jsonc
"sectorMedians": { "pe": 19.2, "roe": 15.4, "roce": 18.1, "dividend_yield": 1.2, "market_cap": 295571 }
```

Median, not mean — one Nestle at P/E 72 drags a mean into nonsense. With 2–3
companies per sector the median is thin but still honest; it's the comparison a
human would make.

### 2. `risk` is empty on 19 of 20 stocks

Sayam has already built `risk-breakdown.tsx` and it renders nothing.

Four keys, and **each one needs a plain-English `reason` and `sourceIds`** — a bare
level with no reason is the exact thing this product argues against:

```jsonc
"risk": [
  { "key": "volatility", "label": "Price volatility", "level": "medium",
    "reason": "Over the past year the price moved between ₹3,479 and ₹5,150 — a swing of about 48% from its low.",
    "sourceIds": ["screener_hal_fundamentals"] },
  { "key": "debt",       "label": "Debt", ... },
  { "key": "valuation",  "label": "Valuation", ... },
  { "key": "stability",  "label": "Business returns", ... }
]
```

You can derive all four mechanically from figures you already hold:

| key | derive from | suggested bands |
|---|---|---|
| `volatility` | `(week52High - week52Low) / week52Low` | `>0.7` high, `>0.35` medium, else low |
| `valuation` | `pe` vs `sectorMedians.pe` | `>30%` above → high, `>20%` below → low, else medium |
| `debt` | `debt_to_equity` vs sector median | same shape |
| `stability` | `roe` | `>18` low risk, `>10` medium, else high |

⚠️ **Calibrate volatility against Indian reality.** I had `>0.4 = medium` first and
it labelled a **66% annual swing as "steady"** — which then matched a query asking
for something safe. That's precisely the reassuring half-truth we exist to remove.
The bands above are calibrated against the actual spread of our 20.

### 3. `week52High` / `week52Low` are `null`

They're on the screener page as **High / Low**, rendered as two `<span class="number">`
inside one value span, so a single-number regex misses them:

```html
<span class="name"> High / Low </span>
<span class="nowrap value">₹ <span class="number">5,150</span> / <span class="number">3,479</span></span>
```

These unlock the `week52_range` metric (which the glossary already defines) and the
volatility derivation above.

---

## 🟡 Smaller things

### `listDocuments()` on `SourcesApi`

Retrieval currently walks each stock's `documentIds`, so **a document no stock links
to is invisible to the RAG index** — a PIB release about the defence budget that
nobody attached would never be retrieved.

One method fixes it:

```ts
listDocuments(): SourceDocument[] {
  return [...snapshot.documents.values()];
}
```

I've written a workaround on my side so nothing of yours has to change to run
today. But if you add this, tell me and I'll switch to it — it's strictly better.

### Metric keys the rest of the system expects

You currently emit: `previous_close`, `market_cap`, `pe`, `book_value`, `roce`,
`roe`, `dividend_yield`.

| Missing | Why it matters |
|---|---|
| `eps` | In the glossary, referenced in prompts, commonly asked about |
| `debt_to_equity` | In the glossary; the `debt` risk row and the "low debt" discovery filter both need it |
| `week52_range` | In the glossary; needs the High/Low fix above. `value: null`, `display: "₹3,479 – ₹5,150"` |

Also: `previous_close` has no glossary entry, so tap-to-explain will 404 on it.
Either add one or drop the metric — it's not that useful to a beginner anyway.

### Keys must match exactly

Metric `key` → glossary `key` → `sectorMedians` key are all matched by **exact
string**. `pe` everywhere, not `PE` or `stock_pe`. Same for risk keys: only
`volatility` / `debt` / `valuation` / `stability` are recognised.

---

## The one thing not to change without telling me

The `SourcesApi` shape in `packages/contracts/src/stocks.ts`. The engine, the RAG
indexer and the discovery filter all call it. **Adding** a method is free; changing
a signature or a field name breaks all three.

If you want a change, message me and I'll do both sides at once — it's two minutes
if we know, and a confusing half hour at 3am if we don't.

---

## How to check your own work

```bash
bun run --filter server dev
curl -s localhost:3000/api/health           # stocks count, vector store, points

# does a real investigation find your sources?
curl -sN -b cookies.txt -X POST localhost:3000/api/thesis/stream \
  -H 'Content-Type: application/json' \
  -d '{"query":"Defence spending is up so HAL should benefit"}' | grep source.found

# does discovery filter on your medians?
curl -sN -b cookies.txt -X POST localhost:3000/api/thesis/stream \
  -H 'Content-Type: application/json' \
  -d '{"query":"I want to invest long term in something safe"}' | grep discovery.candidate
```

If a stock appears with no matched reasons, or a sector comparison says nothing,
it's one of the three gaps above.

---

## Priority, if you only have time for some

1. **`sectorMedians`** — unlocks comparisons, metric directions, and discovery filters
2. **`risk` arrays** — unlocks a screen Sayam has already built
3. **`week52High/Low`** — unlocks the range metric and volatility
4. `eps` + `debt_to_equity`
5. `listDocuments()`

Everything above 3 is pure arithmetic over data you already have on disk.
