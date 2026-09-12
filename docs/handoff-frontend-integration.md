# Sayam — connecting the rest of the frontend

Your thesis screen, stock page and Time Machine bar are built, and two of the
three already talk to the real backend. This doc is **only** about what's still
unconnected, and exactly how to connect it.

Paste this whole file into your AI chat alongside `docs/handoff-frontend.md`.
Nothing here is about code quality — it's a hackathon. It's about flows that
exist on the backend and have no UI yet.

---

## Where you are

| Thing | Status |
|---|---|
| Thesis investigation screen | ✅ built — ⚠️ **still on mock data** |
| Stock profile page | ✅ built and wired to `/api/stocks/:ticker` |
| Time Machine bar | ✅ built and wired to `/api/profile` + `/api/demo/seed` |
| Source card + tier badge | ✅ built |
| Onboarding | ❌ backend ready, no UI |
| General chat | ❌ backend ready, no UI |
| Record a decision | ❌ backend ready, no UI |
| Portfolio view | ❌ backend ready, no UI |
| Discovery (general queries) | ❌ backend ready, no UI |

I fixed one build error in `risk-breakdown.tsx` — a stray `e` before `"use client"`
was breaking `tsc` for the whole repo. That's it; I haven't touched anything else
of yours.

⚠️ `risk-breakdown.tsx` renders nothing right now, and that's **not your bug** —
Tushar's stock records have empty `risk` arrays. It's the top item on his list.

---

## 1. 🔴 Flip the thesis screen off mock — one line

`apps/web/src/hooks/use-thesis-run.ts`:

```ts
const USE_MOCK = true;   // ← change to false
```

The backend is live and returns the identical event shape. A full run takes about
**13–15 seconds** and streams stage by stage, so your assembly animation gets real
timing rather than the mock's simulated pacing.

Keep the mock import — it's still the right thing to demo against if the network
dies mid-presentation.

---

## 2. 🔴 Discovery — the flow that breaks your screen today

**This is the most important new thing.** If a user types a general question with
no company in it — *"I want to invest long term"* — the thesis stream **stops after
the parse stage** and switches to a completely different set of events.

Right now your reducer would show one completed stage and then nothing.

### What the stream does

```
run.started → stage.started(parse) → claim.parsed → stage.completed(parse)
→ run.needs_discovery          ← the handoff signal
→ discovery.started
→ discovery.intent             ← what we understood them to want
→ discovery.source × N         ← sources behind the match reasons
→ discovery.candidate × 4      ← the companies that matched
→ discovery.completed
```

### The types

All exported from `@bit-n-build-2026/contracts`:

```ts
interface DiscoveryCandidate {
  ticker: string;
  name: string;
  sector: string;
  business: string;                 // two plain sentences
  matchedOn: { label: string; detail: string; sourceIds: string[] }[];
  watchOut:  { label: string; detail: string; sourceIds: string[] }[];
}

// also: DiscoveryIntent, DiscoveryEvent, DISCOVERY_DISCLAIMER, DISCOVERY_NEXT_STEP
```

Real output today for *"I want to invest long term in something safe"*:

```
HINDUNILVR  Hindustan Unilever Ltd
   ✓ Over the past year the price moved between ₹1,926 and ₹2,553 — a swing of about 33%
   ✓ Market capitalisation of ₹4,52,766 Cr
   ⚠ Absence of a flag is not a green light: nothing in the figures we hold stands out…
```

### How to render it

Handle `run.needs_discovery` in your reducer by switching the page into a
discovery view, then render candidates as cards.

**Non-negotiable, and it's the whole point of this screen:**

1. **Do not rank, score, or star them.** They are ordered by how many stated
   characteristics they matched, not by how good an investment they are. No "best
   match" badge, no 1/2/3 numbering, no green ticks implying approval.
2. **`watchOut` must be as visually prominent as `matchedOn`.** Same type size,
   same weight. If it looks like a downside footnote, we've become the hype
   machine we're arguing against.
3. **Show `DISCOVERY_DISCLAIMER` on screen**, not in a tooltip. It says these come
   from our covered list, not the whole market, and aren't a recommendation.
4. **Each card's CTA is `DISCOVERY_NEXT_STEP`** — "tell us which one interests you
   and why". Clicking it should drop the ticker into the thesis input so they
   type their *reasoning*, which fires the normal investigation.

That last point is the loop that makes the product make sense:
**general question → candidates → pick one → state your reasoning → full investigation.**

---

## 3. 🔴 Onboarding — needs a UI

Runs once after sign-up. It's what makes the AI's first answer personal instead of
generic, and it feeds the RAG context permanently.

```
GET  /api/onboarding   → OnboardingState (check `complete` to decide whether to show it)
POST /api/onboarding   → same shape back
```

Six questions. **All optional** — let them skip. Labels are already written for you
in `ONBOARDING_LABELS` from contracts, so render those rather than inventing copy:

| Field | Options (constants exported from contracts) |
|---|---|
| `ageBand` | `AGE_BANDS` — "18-24" … "55+" |
| `experience` | `EXPERIENCES` — never / tried a bit / invests regularly |
| `primaryGoal` | `PRIMARY_GOALS` — learn first, grow savings, income, specific goal, try trading |
| `horizon` | `HORIZONS` — under 1y … over 5y / unsure |
| `riskComfort` | `RISK_COMFORTS` — *"If this dropped 20%, what would you do?"* |
| `monthlyBudget` | a number in ₹, free input |
| `notes` | free text, "anything else we should know" |

```ts
const res = await fetch(`${ENV.NEXT_PUBLIC_SERVER_URL}/api/onboarding`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify(answers),
});
```

**Tone matters here more than anywhere else in the app.** This is the first screen
a nervous beginner sees. One question per screen, big tap targets, a visible skip,
and no financial jargon at all. The `riskComfort` question is the most valuable
one we ask — it's phrased as a feeling, not a risk score, deliberately.

---

## 4. 🔴 General chat — needs a UI

Separate from investigations. This is "what does P/E mean", "how is my portfolio
looking", "why did you say that".

```
POST /api/chat/stream   { message, threadId? }   → SSE
GET  /api/chat/:threadId                          → ChatMessage[]
```

Omit `threadId` to start a new conversation; the first event hands you one to reuse.

### Events

```ts
| { type: "chat.started";   threadId: string; messageId: string }
| { type: "chat.context";   usedPortfolio: boolean; sources: SourceRef[] }
| { type: "chat.delta";     text: string }        // append as it arrives
| { type: "chat.sources";   sources: SourceRef[] }
| { type: "chat.completed"; messageId: string; content: string }
| { type: "chat.failed";    message: string }
```

Reuse the SSE reader from `lib/thesis-client.ts` — same framing, different types.
`chat.delta` is token-by-token, so append rather than replace.

**This one is a chat UI** (unlike the thesis screen, which is a report). Reuse
`message` / `bubble` / `message-scroller` from the UI kit here.

Render `chat.context.sources` as your existing source cards under the answer, and
show a small "used your portfolio" marker when `usedPortfolio` is true — that's the
differentiator made visible.

Answers cite inline as `[screener_bel]`. **Turn those into clickable chips** that
open the matching source card. Real answer from today:

> Yes, BEL is too much of your portfolio. You have invested 100% of your money in a
> single stock [screener_bel_fundamentals]… If the price drops 20%, you said you
> would worry a lot but probably hold.

---

## 5. 🔴 Record a decision — the small UI with the biggest payoff

After an investigation, ask what they actually did. **They don't buy through us**,
but this is the memory that makes every later answer specific rather than generic.

```
POST /api/decisions   → Decision
GET  /api/decisions   → Decision[]
GET  /api/portfolio   → Portfolio
```

```jsonc
{
  "ticker": "BEL",
  "action": "bought",          // bought | sold | skipped | watching
  "quantity": 15,              // null for skipped/watching
  "pricePerShare": 420,        // null for skipped/watching
  "thesis": "Defence spending is rising so BEL should benefit",
  "reasoning": "I checked the order book and it looked strong"
}
```

Put it at the bottom of a finished investigation:

> **What did you decide?**
> `I bought it` · `I'm skipping this` · `I'm watching it`
>
> → if bought: how many shares, at what price
> → always: *"Why?"* (one line, optional)

**`reasoning` is the most valuable field in the product** — it's what lets the AI
say later "you skipped Nestle because a P/E of 72 felt too expensive". Ask for it
gently, and let them skip it.

`skipped` matters as much as `bought`. Deciding *not* to buy after investigating is
the behaviour we want to encourage, so make that button feel like a real, positive
choice rather than a cancel.

---

## 6. 🟡 Portfolio view

`GET /api/portfolio` is derived entirely from recorded decisions — there's nothing
for the user to maintain twice.

```ts
{
  positions: [{ ticker, companyName, quantity, avgPrice, investedValue, currentValue, weight }],
  totalInvested: number,
  totalCurrent: number | null,      // null when we lack a price
  skipped:  [{ ticker, companyName, reasoning }],
  watching: [{ ticker, companyName }]
}
```

`weight` is 0–1. **Show concentration prominently** — "BEL is 100% of your
portfolio" is the most useful sentence on that screen for a beginner, and it's the
thing the AI leads with too.

Show `skipped` as its own section, with their reasoning. Seeing your own past
thinking written down is the "software teaches you to be self-reliant" narrative
made concrete.

`currentValue: null` means no price — render a dash, never a zero.

---

## 7. Endpoint reference

| Method | Path | Notes |
|---|---|---|
| POST | `/api/thesis/stream` | SSE. May switch to discovery events mid-stream |
| POST | `/api/chat/stream` | SSE |
| GET | `/api/chat/:threadId` | history |
| GET/POST | `/api/onboarding` | |
| GET/POST | `/api/decisions` | |
| GET | `/api/portfolio` | derived from decisions |
| GET | `/api/stocks` · `/api/stocks/:ticker` | ✅ already wired |
| GET | `/api/glossary/:term?level=` | tap-to-explain |
| GET | `/api/profile` · POST `/api/demo/seed` | ✅ already wired |
| GET | `/api/health` | stocks count, models, vector store |

**Every call needs `credentials: "include"`** or you'll get a 401 — the session is a
cookie.

---

## 8. Build order

1. **Flip `USE_MOCK` to false** — 30 seconds, makes the hero screen real
2. **Discovery view** — without it, a general question breaks the main screen
3. **Decision capture** — small UI, and it's what makes chat impressive
4. **Chat** — biggest new surface, but the most self-contained
5. **Onboarding** — needed for a clean first-run demo
6. **Portfolio** — nice, and mostly rendering data you'll already have

If you only get through 1–3, the demo still lands.
