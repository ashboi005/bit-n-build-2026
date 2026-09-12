# Sayam — frontend integration tasks

> **How to use this file:** paste it whole into your AI coding agent and say
> *"Read this and do TASK 1."* Then TASK 2, and so on. One task per message.
> Each task is self-contained with acceptance criteria.
>
> This is a hackathon. **Do not refactor, do not add tests, do not improve code
> quality.** Make the flows work.

---

## Context for the agent

You are working in `apps/web` of a Bun monorepo. Next.js 16, React 19, Tailwind
v4, shadcn-style components in `@bit-n-build-2026/ui`.

**Read `docs/handoff-frontend.md` first** — it has the repo gotchas (Next 16
differs from training data, Tailwind v4 has no config file, React Compiler is on
so no manual `useMemo`, env comes from `@/env` not `process.env`, web is port
3001 and server is 3000).

**All types come from `@bit-n-build-2026/contracts`.** Never redefine a type
locally — import it. `bun run check-types` must stay clean.

**Every fetch to the backend needs `credentials: "include"`** or it returns 401.
The session is a cookie set by better-auth.

### What already exists — do not rebuild

| Component | Status |
|---|---|
| Thesis investigation screen + all its sub-components | ✅ built |
| Stock profile page, wired to `/api/stocks/:ticker` | ✅ built |
| Time Machine bar, wired to `/api/profile` + `/api/demo/seed` | ✅ built |
| Source card + tier badge | ✅ built |
| Auth (sign-in, sign-up, session, header, user menu) | ✅ built |

`risk-breakdown.tsx` renders nothing right now. **That is not your bug** — Tushar's
stock records have empty `risk` arrays. It is TASK 2 on his list.

---

# TASK 1 — switch the thesis screen to the real backend

## What to do

In `apps/web/src/hooks/use-thesis-run.ts`:

```ts
const USE_MOCK = true;   // ← change to false
```

That is the whole task. The backend returns the identical event shape.

## What changes

- A real run takes **13–15 seconds** and streams stage by stage.
- The mock's artificial delays are gone, so `MIN_STAGE_MS` now does real work
  smoothing the pacing. Keep it.

**Keep the mock import.** If the network dies mid-demo, flipping this back is the
recovery plan.

## Acceptance criteria

- [ ] Signing in and submitting a thesis streams real stages
- [ ] Source cards show real publishers (PIB, Business Standard, Screener.in, BSE)
- [ ] Nothing throws in the console

---

# TASK 2 — handle discovery (urgent: a general query breaks the screen today)

## The problem

If the user types a question with **no company in it** — *"I want to invest long
term"* — the thesis stream stops after the parse stage and switches to a
completely different set of events.

Your current reducer shows one completed stage and then nothing happens. This is
the most likely way the demo breaks in front of judges.

## The event sequence

```
run.started
stage.started(parse) → claim.parsed → stage.completed(parse)
run.needs_discovery              ← the handoff signal
discovery.started
discovery.intent                 ← what we understood them to want
discovery.source        × N      ← sources behind the match reasons
discovery.candidate     × up to 4
discovery.completed
```

## The types (all from `@bit-n-build-2026/contracts`)

```ts
interface DiscoveryCandidate {
  ticker: string;
  name: string;
  sector: string;
  business: string;                                              // two plain sentences
  matchedOn: { label: string; detail: string; sourceIds: string[] }[];
  watchOut:  { label: string; detail: string; sourceIds: string[] }[];
}

interface DiscoveryIntent {
  raw: string;
  goal: string | null;
  horizon: "intraday" | "short" | "long" | "unspecified";
  sectors: string[];
  wants: {
    lowDebt: boolean; lowVolatility: boolean; dividendIncome: boolean;
    largeEstablished: boolean; cheapValuation: boolean;
  };
}

type DiscoveryEvent =
  | { type: "discovery.started";   query: string }
  | { type: "discovery.intent";    intent: DiscoveryIntent }
  | { type: "discovery.source";    source: SourceRef }
  | { type: "discovery.candidate"; candidate: DiscoveryCandidate }
  | { type: "discovery.completed"; universeSize: number; matched: number;
                                   disclaimer: string; nextStep: string }
  | { type: "discovery.failed";    message: string };

// also exported: DISCOVERY_DISCLAIMER, DISCOVERY_NEXT_STEP
```

## What to build

1. **Extend the reducer** in `use-thesis-run.ts` to handle `run.needs_discovery`
   and the `discovery.*` events. Add to state:

```ts
mode: "thesis" | "discovery",
intent: DiscoveryIntent | null,
candidates: DiscoveryCandidate[],
discoverySummary: { universeSize: number; matched: number; disclaimer: string; nextStep: string } | null,
```

2. **On `run.needs_discovery`**, set `mode: "discovery"` and stop rendering the
   stage timeline. Show a line like *"No single company named — looking across
   what we cover…"*

3. **Create `apps/web/src/components/discovery/candidate-card.tsx`.** For each
   candidate show: ticker + name + sector, the two-sentence `business`, then two
   lists — `matchedOn` and `watchOut`.

4. **Create `apps/web/src/components/discovery/discovery-view.tsx`** rendering the
   intent, the candidate cards, and the summary.

## Real output today (for "I want to invest long term in something safe")

```
HINDUNILVR  Hindustan Unilever Ltd  (FMCG)
   ✓ Over the past year the price moved between ₹1,926 and ₹2,553 — a swing of about 33%
   ✓ Market capitalisation of ₹4,52,766 Cr
   ⚠ Absence of a flag is not a green light: nothing in the figures we hold stands out…
```

## 🚨 Design rules — this is the point of the whole screen

1. **Do not rank, score, number or star them.** They are ordered by how many
   stated characteristics they matched, **not** by how good an investment they
   are. No "best match" badge, no 1/2/3, no green ticks implying approval, no
   sorting UI.
2. **`watchOut` must be as visually prominent as `matchedOn`** — same type size,
   same weight, same colour intensity. If it reads as a footnote, we have become
   the hype machine we are arguing against.
3. **Render `discoverySummary.disclaimer` on screen**, not in a tooltip. It says
   these come from our covered list, not the whole market, and are not a
   recommendation.
4. **The CTA on each card is `discoverySummary.nextStep`** — "tell us which one
   interests you and why". Clicking it puts the ticker into the thesis input so
   the user types their **reasoning**, which fires the normal investigation.

That last point is the loop that makes the product make sense:

> general question → candidates → pick one → state your reasoning → full investigation

## Acceptance criteria

- [ ] Typing "I want to invest long term" renders candidate cards, not a dead screen
- [ ] Each card shows both matched reasons and watch-outs with equal weight
- [ ] The disclaimer is visible without hovering
- [ ] Clicking a card's CTA prefills the thesis input with that ticker
- [ ] No ranking, scoring or "recommended" language anywhere

---

# TASK 3 — the Time Machine: how it actually works

## ⚠️ Read this whole section before changing anything

You already built `time-machine-bar.tsx` and it calls the right endpoints. This
task is about **what happens around it**, because there are two separate things
going on and the UI owns one of them.

### What happens when the user clicks "Day 15"

**On the backend** (already implemented, nothing for you to do):

`POST /api/demo/seed { "stage": "day15" }` runs a real seeding routine against
the live Postgres. It:

1. Deletes that user's rows from `user_decision` and `chat_message`
2. Inserts the persona's decisions, dated relative to today (e.g. "bought BEL
   4 days ago at ₹445, thesis: *everyone is talking about it*, outcome: **broke**")
3. Upserts `user_profile` — level, known concepts, past theses, onboarding answers
4. Deletes that user's vector memories and re-indexes the new ones

It writes through the **same tables the product uses normally**. There is no
demo-only code path.

**On the frontend** (your job):

The response gives you a `suggestedPrompt`. Put it in the thesis input.

```ts
const res = await fetch(`${ENV.NEXT_PUBLIC_SERVER_URL}/api/demo/seed`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ stage }),
});
const { stage, profile, suggestedPrompt } = await res.json();
```

### 🚨 The rule that must be obvious in the UI

> **The seed sets up WHO THE USER IS. It never sets up WHAT THE AI SAYS.**
>
> `suggestedPrompt` is a **question**, not an answer. It is prefilled to save
> typing on stage and avoid a typo in front of judges. When the user presses
> send, the full pipeline runs live — eight stages, real model calls, real
> retrieval, nothing cached.
>
> A judge can delete it and type their own question and get the same treatment.
> **That is the point.** If your UI ever makes it look like the answer was
> seeded too, we have lost the argument.

So: prefill the input, **do not auto-submit**. Let the user (or a judge) press
send. Seeing a human press the button is what proves it is live.

### Day 0 is a full reset

Verified behaviour today:

| | Day 0 | Day 15 | Day 25 |
|---|---|---|---|
| level | `new` | `practicing` | `independent` |
| known concepts | none | 4 | 7 |
| portfolio | empty | ITC, TATAMOTORS, BEL | + INFY |
| skipped | none | none | NESTLEIND (with reasoning) |
| past theses | 0 | 2 (one **broke**) | 3 |
| chat history | wiped | wiped | wiped |

## What to build

1. **After a successful seed, prefill the thesis input** with `suggestedPrompt`.
   Do not submit it.

2. **Render the active profile compactly** so the change is legible on a
   projector from the back of a room:

```
Day 15 · practicing · knows: P/E, EPS, 52-week range, order book · 3 positions · 2 past theses
```

3. **Highlight what changed.** A brief flash or colour pulse on the profile
   summary when it updates. The demo beat is: same question, hit Day 0, hit
   Day 25, watch the answer change depth. Make that transition feel deliberate.

4. **Add a visible note near the bar**, in small text:
   *"Seeds this user's history. The investigation itself still runs live."*
   This sentence exists so a judge reading the screen cannot mistake what it does.

5. **Refresh dependent views after a seed.** Portfolio and chat history have both
   changed server-side. If those screens are mounted, refetch them.

6. **Style it as a visible demo control.** Do not hide it in a settings menu —
   the judges need to see you press it.

## Acceptance criteria

- [ ] Clicking a day seeds, then prefills the input without submitting
- [ ] The profile summary updates and visibly changes between Day 0 and Day 25
- [ ] Day 0 shows an empty portfolio; Day 25 shows 4 positions + 1 skipped
- [ ] The "still runs live" note is on screen
- [ ] Portfolio / chat views refetch after a seed

---

# TASK 4 — onboarding

Runs once after sign-up. It is what makes the AI's first answer personal rather
than generic, and it feeds the RAG context permanently.

## Endpoints

```
GET  /api/onboarding   → OnboardingState   (check `complete` to decide whether to show it)
POST /api/onboarding   → OnboardingState
```

## The six questions

**All optional** — let them skip any of it. The option constants **and the exact
label text** are already written in contracts. Import and render those; do not
write your own copy.

```ts
import {
  AGE_BANDS, EXPERIENCES, PRIMARY_GOALS, HORIZONS, RISK_COMFORTS,
  ONBOARDING_LABELS, type OnboardingAnswers,
} from "@bit-n-build-2026/contracts";
```

| Field | Constant | Question to show |
|---|---|---|
| `ageBand` | `AGE_BANDS` | "How old are you?" |
| `experience` | `EXPERIENCES` | "Have you invested before?" |
| `primaryGoal` | `PRIMARY_GOALS` | "What are you hoping to get out of this?" |
| `horizon` | `HORIZONS` | "When might you need this money back?" |
| `riskComfort` | `RISK_COMFORTS` | **"If your investment dropped 20%, what would you do?"** |
| `monthlyBudget` | number, ₹ | "Roughly how much could you invest a month?" |
| `notes` | free text | "Anything else we should know?" |

`ONBOARDING_LABELS.primaryGoal.learn_first` etc. give you the display string for
each option key.

## POST body

```ts
{ ageBand, primaryGoal, riskComfort, experience, monthlyBudget, horizon, notes }
// any field may be null
```

## Tone — matters more here than anywhere else in the app

This is the first screen a nervous beginner sees. **One question per screen**, big
tap targets, a visible skip on every step, and **no financial jargon at all**.

The `riskComfort` question is the most valuable thing we ask, and it is phrased as
a feeling rather than a risk score on purpose. Do not turn it into a slider or a
1–10 scale.

## Acceptance criteria

- [ ] Shown after sign-up only when `complete` is false
- [ ] Every step is skippable
- [ ] Labels come from `ONBOARDING_LABELS`, not hardcoded strings
- [ ] After submitting, `GET /api/onboarding` returns `complete: true`

---

# TASK 5 — record a decision (small UI, biggest payoff)

After an investigation, ask what the user actually did. **They do not buy through
us.** This is the memory that makes every later answer specific instead of generic.

## Endpoints

```
POST /api/decisions   → Decision
GET  /api/decisions   → Decision[]
```

## Body

```jsonc
{
  "ticker": "BEL",
  "action": "bought",        // "bought" | "sold" | "skipped" | "watching"
  "quantity": 15,            // null for skipped/watching
  "pricePerShare": 420,      // null for skipped/watching
  "thesis": "Defence spending is rising so BEL should benefit",
  "reasoning": "I checked the order book and it looked strong"
}
```

## Where it goes

At the bottom of a finished investigation, after the verdict:

> **What did you decide?**
>
> `I bought it` · `I'm skipping this` · `I'm watching it`
>
> → if bought: how many shares, at what price
> → always: *"Why?"* — one line, optional

Prefill `thesis` with the query they originally typed.

## 🚨 Two things that matter

1. **`reasoning` is the most valuable field in the product.** It is what lets the
   AI say later *"you skipped Nestle because its P/E was far above the sector and
   you couldn't find a reason the earnings justified it"*. Ask for it gently,
   one line, and let them skip it.

2. **`skipped` must feel like a real, positive choice — not a cancel button.**
   Deciding *not* to buy after investigating is the behaviour this whole product
   is trying to encourage. Do not style it as dismissal or make it smaller than
   the others.

## Acceptance criteria

- [ ] Appears after an investigation completes
- [ ] All four actions submit successfully
- [ ] "Skipping" is styled as a genuine option, not a dismiss
- [ ] The recorded decision appears in `GET /api/decisions`

---

# TASK 6 — general chat

Separate from investigations: *"what does P/E mean"*, *"how is my portfolio
looking"*, *"why did you say that"*.

## Endpoints

```
GET  /api/chat                                    → ChatThread[]   (list, newest first)
POST /api/chat/stream   { message, threadId? }    → SSE
GET  /api/chat/:threadId                          → ChatMessage[]  (resume one thread)
```

Omit `threadId` to start a new conversation. The first event (`chat.started`)
gives you one to reuse for the rest of the thread.

### 🔑 Resuming a conversation

**`GET /api/chat` is what makes chat survive navigation.** Without it the
threadId only lives in component state, so leaving the page and coming back
orphans the conversation — the messages are still in the database but nothing can
find them again.

```ts
interface ChatThread {
  threadId: string;
  title: string;          // first thing the USER said, trimmed to 80 chars
  lastMessage: string;    // preview line, trimmed to 140
  lastRole: "user" | "assistant";
  messageCount: number;
  createdAt: string;
  updatedAt: string;      // list is sorted by this, newest first
}
```

Real response:

```
thr_mtyv8xoy_8t03ok   msgs=2   title='Is HAL risky?'
   last[assistant]: HAL is a large, profitable company with a strong balance sheet, but it…
thr_mtyv8lae_fe27bv   msgs=4   title='What does P/E mean?'
   last[assistant]: A "good" P/E depends on the industry and the company's growth…
```

**How to use it on the chat page:**

1. On mount, `GET /api/chat`.
2. If it returns threads, **auto-open the first one** (it is the most recently
   active) and load its messages with `GET /api/chat/:threadId`. The user lands
   back exactly where they were.
3. If it returns `[]`, show the empty state and start a new thread on first send.
4. Keep the threadId in the URL — `/chat/[threadId]` — so a refresh or a shared
   link restores the right conversation without guessing.
5. Show the list in a sidebar or a "past conversations" drawer, titled by
   `title` with `lastMessage` as the preview. `title` is already derived from
   the user's first message, so do not build your own.

Verified: two threads, four messages restored in order on resume.

## Events

```ts
| { type: "chat.started";   threadId: string; messageId: string }
| { type: "chat.context";   usedPortfolio: boolean; sources: SourceRef[] }
| { type: "chat.delta";     text: string }          // APPEND, token by token
| { type: "chat.sources";   sources: SourceRef[] }
| { type: "chat.completed"; messageId: string; content: string }
| { type: "chat.failed";    message: string }
```

## How to build it

- **Reuse the SSE reader** from `lib/thesis-client.ts` — same framing, different
  event types. Write `lib/chat-client.ts` next to it.
- `chat.delta` is token-by-token: **append**, never replace.
- **This one IS a chat UI** (unlike the thesis screen, which is a report). Use
  `message`, `bubble` and `message-scroller` from `@bit-n-build-2026/ui`.
- Render `chat.context.sources` as your existing source cards under the answer.
- When `usedPortfolio` is true, show a small marker like *"used your portfolio"* —
  that is the product's differentiator made visible.
- Answers cite inline as `[screener_bel_fundamentals]`. **Parse those and turn
  them into clickable chips** that open the matching source card. Do not leave
  raw brackets in the text.

## 🧠 Chat feeds the same memory everything else uses

Worth knowing, because it changes how the feature reads to a user:

**Every chat exchange is embedded into the same vector store as their portfolio,
decisions and onboarding answers.** So a question asked today is retrievable
weeks later, in a different thread.

Verified end to end:

```
Thread A:  "I find P/E ratios really confusing and I get nervous about losing money."
Thread B:  "Remind me what I said I struggle with?"
           → "You told us that you find P/E ratios confusing and you get nervous
              about losing money."
```

Two different threads, no shared message history — that came out of the vector
store, not the conversation.

**What this means for your UI:**

- **Do not build chat as a throwaway box.** It is a memory the product keeps.
  Threads are worth listing and returning to.
- Only the last 12 turns of a thread go into the prompt directly; anything older
  is recalled semantically. So a long thread does not lose its early context, and
  you do not need to cap or truncate anything client-side.
- The "used your portfolio" marker from `chat.context.usedPortfolio` is the same
  idea made visible. Consider surfacing when older context was recalled too.
- Retrieval spans **public market sources AND the user's own history** in one
  pass, which is why an answer can combine "the defence budget rose" with "you
  already hold 16% BEL".

## A real answer from today, at Day 25

> Your portfolio already has 16% in BEL, which is a large chunk for a first-time
> investor. You bought this stock because you saw it on reels, and the price has
> since fallen from your average of ₹445 to ₹405.50 [bse_bel_market_data].
>
> Defence spending is rising, but the market has already priced in that news
> [bs_defence_priced_in][pib_budget_defence]…

Note it references their own past decision **and** cites market sources. Your UI
needs to render both cleanly.

## Acceptance criteria

- [ ] Messages stream in token by token
- [ ] `[source_id]` markers render as clickable chips, not raw text
- [ ] Source cards appear under the answer
- [ ] A "used your portfolio" indicator shows when true
- [ ] Reloading the page restores the thread via `GET /api/chat/:threadId`
- [ ] On mount, `GET /api/chat` auto-opens the most recent thread
- [ ] The threadId is in the URL so refresh and shared links work
- [ ] Past conversations are listable, titled by `title`

---

# TASK 7 — portfolio view

`GET /api/portfolio` — derived entirely from recorded decisions. There is nothing
for the user to maintain twice.

```ts
{
  positions: [{ ticker, companyName, quantity, avgPrice, investedValue, currentValue, weight }],
  totalInvested: number,
  totalCurrent: number | null,          // null when we lack a price
  skipped:  [{ ticker, companyName, reasoning }],
  watching: [{ ticker, companyName }]
}
```

## What to build

- **`weight` is 0–1. Show concentration prominently.** *"BEL is 100% of your
  portfolio"* is the most useful sentence on this screen for a beginner, and it
  is what the AI leads with too. Consider a simple bar.
- **Show `skipped` as its own section, with their reasoning.** Seeing your own
  past thinking written down is the "software teaches you to be self-reliant"
  narrative made concrete. Do not bury it.
- **`currentValue: null` renders as a dash, never a zero.** A zero is a lie.
- Link each position to `/stocks/[ticker]`.

## Acceptance criteria

- [ ] Positions show quantity, average price and weight
- [ ] Concentration is visually obvious
- [ ] Skipped companies appear with their reasoning
- [ ] Null current values render as "—"

---

---

# TASK 8 — Day 0 is now a full account reset (replaces the old Day 0 behaviour)

## What changed on the backend

Day 0 no longer seeds a blank persona. It **deletes the account entirely** so a
demo can run the whole journey from sign-up onwards.

```
POST /api/demo/reset        (no body)
→ 200 { "reset": true, "message": "Account deleted. Sign up again to start a fresh demo." }
```

It cascades to sessions, profile, decisions, chat history and their vectors. The
session dies with it, so **every subsequent call returns 401** — verified.

## What to build

1. **Wire the Day 0 button to `POST /api/demo/reset`**, not `/api/demo/seed`.
   Days 5, 15 and 25 still use `/api/demo/seed` exactly as before.

2. **After a 200, redirect to `/login`.** The session is already invalid, so
   don't try to refetch the profile first — it will 401.

3. **🚨 Confirm before firing.** This is irreversible and there is no undo. A
   mis-click during demo prep deletes a real account. A simple confirm dialog is
   enough, but it must exist:

   > **Delete this account and start over?**
   > This removes your profile, decisions and chat history permanently, and signs
   > you out. Used to restart a demo from scratch.
   > `Cancel` · `Delete and restart`

4. **Style Day 0 differently from the other days.** It is a destructive action,
   not another point on a timeline. A separate button labelled "Reset demo" sitting
   apart from `Day 5 · Day 15 · Day 25` is clearer than four identical buttons
   where one of them nukes everything.

## The demo flow this enables

```
Reset demo  →  sign-up  →  onboarding (judges watch you answer as yourself)
            →  ask a thesis        (Day 0: the AI knows only what you just told it)
            →  Day 15              (your answers are kept; history is layered on)
            →  ask the same thesis (now it references a thesis that broke)
```

## Onboarding is no longer overwritten

Seeding Day 5/15/25 **keeps whatever the user answered** and only layers the
history on top. The persona's answers are a fallback for someone who jumps
straight to Day 15 without onboarding.

This matters for your UI: after a seed, the onboarding values on screen should be
**unchanged**. If you cached them, they are still valid. Verified — a ₹500 budget
and a 1–3 year horizon survive a Day 15 seed intact.

## Acceptance criteria

- [ ] Day 0 calls `/api/demo/reset` and redirects to `/login`
- [ ] A confirmation step exists and says the word "permanently"
- [ ] Day 0 is visually distinct from the other three
- [ ] Days 5/15/25 still seed and do not touch onboarding answers

---

# TASK 9 — "What changed since you last looked"

The feature nothing else can do: the user told us **why** they acted, and we kept
it. This revisits each decision against what has happened since, and grades
**their reasoning** — never the stock.

```
GET /api/changes   →  ChangeReport
```

Computed on request, so it is instant and always current. It works immediately
after a Time Machine seed, because seeded decisions are dated relative to today.

## Types (all from `@bit-n-build-2026/contracts`)

```ts
interface ChangeReport {
  generatedAt: string;
  items: ChangeItem[];                 // already sorted: most worth attention first
  summary: {
    reviewed: number;
    needsAttention: number;
    portfolioProfitLoss: number | null;      // null when prices unavailable
    portfolioProfitLossPct: number | null;
  };
  disclaimer: string;                  // CHANGES_DISCLAIMER — render it
}

interface ChangeItem {
  ticker: string;
  companyName: string;

  decision: {
    id: string;
    action: "bought" | "sold" | "skipped" | "watching";
    thesis: string | null;             // their own words — the thing being tested
    reasoning: string | null;
    decidedAt: string;
    daysAgo: number;
    quantity: number | null;
    pricePerShare: number | null;
  };

  price: { then: number; now: number; changePct: number;
           direction: "up" | "down" | "flat" } | null;

  position: { quantity: number; investedValue: number; currentValue: number;
              profitLoss: number; profitLossPct: number; weight: number } | null;

  newDocuments: SourceRef[];           // published AFTER they decided
  signals: ChangeSignal[];
  thesisStatus: "holding" | "weakening" | "broken" | "too_early" | "unclear";
  headline: string;                    // one sentence, at their level
  nextChecks: string[];                // things to go and verify
}

interface ChangeSignal {
  kind: "price_move" | "new_filing" | "valuation_shift" | "concentration" | "thesis_untested";
  severity: "info" | "attention" | "warning";
  label: string;                       // short chip text
  detail: string;                      // one sentence, with the real numbers
  sourceIds: string[];
}
```

Also exported: `CHANGES_DISCLAIMER`, `PRICE_MOVE_ATTENTION` (0.07),
`PRICE_MOVE_WARNING` (0.15), `CONCENTRATION_WARNING` (0.35) — use these so your
labels match the backend's thresholds rather than inventing your own.

## Real output from the Day 15 persona

```
reviewed=3  needsAttention=2  P/L -362 (-2.6%)

BEL — bought 4d ago
  thesis: "Everyone is talking about this defence stock so it will keep rising"
  status: broken
  headline: The market movement suggests the assumption that the stock will keep
            rising is not currently supported by the facts.
  price: 454.16 → 405.50 (-10.7%)
  [attention] Price down: BEL has moved -10.7% since you bought…
  [attention] Large share of your portfolio: BEL is 48% of what you have invested…
  [warning]   Your reasoning: You said: "Everyone is talking about this defence
              stock so it will keep rising". The specific reason you gave has not held up.

ITC — bought 13d ago          status: holding
TATAMOTORS — bought 9d ago    status: holding
  headline: Your reasoning is unverified as nothing has changed.
```

**That BEL card is the feature.** It is the moment the product proves it
remembers why you acted, not just what you bought.

## What to build

A screen (or the top section of the dashboard) rendering one card per item.

### Card layout

```
┌──────────────────────────────────────────────────────────┐
│ BEL  Bharat Electronics          bought 4 days ago       │
│                                                          │
│ You said:                                                │
│ "Everyone is talking about this defence stock so it       │
│  will keep rising"                                       │
│                                          ⚠ NOT HELD UP   │
│ ────────────────────────────────────────────────────────  │
│ ₹454.16  →  ₹405.50        -10.7%                        │
│ 15 shares · ₹6,812 invested · now ₹6,082 · -₹730         │
│ ────────────────────────────────────────────────────────  │
│ ⚠ Your reasoning — the specific reason you gave has…     │
│ ● Large share of your portfolio — BEL is 48% of…         │
│ ────────────────────────────────────────────────────────  │
│ What to check next                                        │
│  · What would have to be true for your original reason…  │
│  · Has anything about the business changed, or only…     │
└──────────────────────────────────────────────────────────┘
```

### Rules

1. **Lead with their own words.** `decision.thesis` in quotes, prominent, before
   any number. The whole point is that we remember *why*.
2. **`thesisStatus` is about the reasoning, not the stock.** Label it that way:
   "not held up", not "bad investment". Suggested copy:
   `holding` → "Still holds" · `weakening` → "Partly holding" ·
   `broken` → "Not held up" · `too_early` → "Too early to tell" ·
   `unclear` → "Can't tell yet"
3. **Colour by `signal.severity`**, never by profit or loss. A position being up
   is not automatically good news, and colouring by P/L makes this a trading app.
4. **Render the disclaimer on screen.** It says this reviews reasoning and is not
   advice.
5. **`nextChecks` are the call to action**, not a "buy more" button. There is no
   buy button anywhere in this product.
6. **`newDocuments` may be empty** — that is normal and correct, not a loading
   state. Show nothing, not a spinner.
7. **Nulls are real.** `price`, `position` and the portfolio P/L can all be null
   when we lack a price. Render a dash, never a zero.

### Empty state

No decisions recorded yet → *"Once you record what you decided, this is where
we'll tell you whether your reasoning held up."* Link to the thesis screen.

## Acceptance criteria

- [ ] One card per item, in the order the API returned them
- [ ] The user's own thesis is the most prominent text on each card
- [ ] Status reads as a judgement on reasoning, not on the company
- [ ] Colour follows severity, not profit/loss
- [ ] Disclaimer visible without hovering
- [ ] Nulls render as dashes
- [ ] Empty state when there are no decisions

---

# Related docs

- **** — the side-by-side comparison tool.
  A separate, AI-free page: pick 2-3 companies, see their figures against their
  sector, with citations. Build it after the tasks above.

# Related docs

- **`docs/handoff-comparison-tool.md`** — the side-by-side comparison tool. A
  separate, deliberately AI-free page: pick 2-3 companies and see their figures
  against their sector median, with citations. Build it after the tasks above.

# Endpoint reference

| Method | Path | Notes |
|---|---|---|
| POST | `/api/thesis/stream` | SSE. **May switch to discovery events mid-stream** |
| POST | `/api/chat/stream` | SSE |
| GET | `/api/chat` | list threads, newest first — needed to resume |
| GET | `/api/chat/:threadId` | messages in one thread |
| GET/POST | `/api/onboarding` | |
| GET/POST | `/api/decisions` | |
| GET | `/api/portfolio` | derived from decisions |
| GET | `/api/stocks` · `/api/stocks/:ticker` | ✅ already wired |
| GET | `/api/glossary/:term?level=` | tap-to-explain |
| GET | `/api/profile` · POST `/api/demo/seed` | ✅ already wired |
| POST | `/api/demo/reset` | **destructive** — deletes the account, see TASK 8 |
| GET | `/api/changes` | "what changed since you last looked", see TASK 9 |
| GET | `/api/health` | stocks count, models, vector store |

**Every call needs `credentials: "include"`.**

---

# Build order

1. **TASK 1** — flip `USE_MOCK`. 30 seconds, makes the hero screen real
2. **TASK 2** — discovery. Without it a general question breaks the main screen
3. **TASK 3** — Time Machine prefill + reset behaviour
4. **TASK 5** — decision capture. Small UI, and it is what makes chat impressive
5. **TASK 6** — chat. Biggest new surface, most self-contained
6. **TASK 4** — onboarding. Needed for a clean first-run demo
7. **TASK 8** — Day 0 reset. Small, and it makes the demo repeatable
8. **TASK 9** — "what changed". The strongest single screen in the product
9. **TASK 7** — portfolio. Mostly rendering data you will already have

If you only reach 1–3, the demo still lands. TASK 9 is the one I would add next
after those — it is the clearest proof the product remembers why you acted.
