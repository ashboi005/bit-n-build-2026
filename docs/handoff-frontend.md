# Frontend Handoff — Sayam

**You own `apps/web`. 3 screens. ~12 hours.**

---

## 0. How to use this document

This doc is written to be used two ways:

1. **Read §1–§5 yourself.** That's the context you need in your head — what we're building, what already exists, what's most important.
2. **Paste the whole file to your AI** at the start of every new chat. Then give it one small task at a time from §10.

> **The single most useful habit:** start each AI chat with
> *"Read `docs/handoff-frontend.md` and `docs/product-thesis.md` first. Then do exactly this one thing: …"*
>
> AI gets worse the more you ask for at once. One component per request beats "build the whole page."

**You are not blocked on anyone.** `packages/contracts` gives you every TypeScript type plus a mock generator that replays a full investigation with realistic timing. Build the entire hero screen against the mock. When the real backend lands you change one import and nothing else.

---

## 1. What we're building (the 60-second version)

A beginner types the reason they want to buy a stock:

> *"Government increased defense spending, so I want to buy HAL."*

The app doesn't answer. It **runs an investigation, visibly assembling on screen** — checking sources one by one, verifying the claim, showing the real numbers, and then arguing the other side.

Two rules that shape every design decision you make:

1. **Every number on screen shows where it came from.** A figure without a citation next to it is a bug.
2. **The app never says BUY or SELL, and never scores a stock.** It only evaluates the user's *reasoning*.

Full background in `docs/product-thesis.md`. Read it once — it'll make the design choices below make sense.

---

## 2. Priority order — build in exactly this order

If you run out of time, the things at the bottom are what we drop. That's the plan, not a failure.

| # | Thing | Why |
|---|---|---|
| 1 | **Thesis Investigation screen** | This IS the demo. Everything else is supporting cast |
| 2 | **Source card + tier badge** | Used everywhere; it's the visual proof of our core promise |
| 3 | **Demo control bar (Time Machine)** | 4 buttons. Cheap. Huge demo payoff |
| 4 | **Stock profile screen** | Ticks the problem-statement boxes |
| 5 | Tap-to-explain term popover | Nice, cheap, do it if 1–4 are solid |
| 6 | Anything else | Don't |

**If you finish early: polish the assembly animation on screen 1.** Do not add a fourth screen.

---

## 3. Getting set up

```bash
bun install          # from repo root
bun run dev:web      # web on http://localhost:3001
bun run dev:server   # server on http://localhost:3000  (Ashwath's)
```

You do **not** need the server running to build screen 1 — use the mock. Start there.

**Your working directory is `apps/web/src/`.** Don't edit `apps/server`, `packages/agents`, or `packages/sources` — those belong to Ashwath and Tushar. If you need something from them, message them rather than editing it.

---

## 4. What already exists — do NOT rebuild these

### Auth is completely done
better-auth is wired up. Sign-in, sign-up, session, `/dashboard`, header, user menu, theme toggle — all shipped and working.

```ts
import { authClient } from "@/lib/auth-client";

const { data: session, isPending } = authClient.useSession();
```

Don't touch `src/lib/auth-client.ts`, `src/components/sign-in-form.tsx`, `sign-up-form.tsx`, `header.tsx`, `user-menu.tsx`, or anything under `/login`.

### The UI kit
Import from `@bit-n-build-2026/ui/components/<name>`:

```ts
import { Button } from "@bit-n-build-2026/ui/components/button";
import { Card } from "@bit-n-build-2026/ui/components/card";
import { Skeleton } from "@bit-n-build-2026/ui/components/skeleton";
```

Available: `button` `card` `input` `label` `textarea` `checkbox` `dropdown-menu` `tooltip` `skeleton` `sonner` `empty` `input-group` `message` `bubble` `message-scroller` `marker` `attachment`

Two notes:
- **`skeleton` matters a lot to you.** Every pending stage on the thesis screen is a skeleton.
- `message`/`bubble`/`message-scroller` exist, but **the thesis screen is not a chat UI.** It's a report that builds itself. Resist the pull toward chat bubbles.

### `@bit-n-build-2026/contracts` — already wired up for you

Every type in §8, the event reducer, and the mock generator are installed and
importable right now:

```ts
import { initialThesisState, reduceThesis, STAGE_LABELS } from "@bit-n-build-2026/contracts";
import type { ThesisEvent, SourceRef, Finding, Metric } from "@bit-n-build-2026/contracts";
import { mockThesisRun, MOCK_EXAMPLE_QUERIES } from "@bit-n-build-2026/contracts/mock";
```

Nothing to install. `bun install` has already been run.

### Need a component that doesn't exist?
The kit is shadcn-based. Add one with:
```bash
cd packages/ui && bunx shadcn@latest add <component>
```
Or just write it — for a hackathon, a plain `div` with Tailwind classes is completely fine. Don't spend 40 minutes wiring up a component library for one badge.

---

## 5. Libraries — what you have, what to add, what to avoid

### Already installed, just use them

| Library | What it's for | Note |
|---|---|---|
| **Next.js 16** | The framework | App Router. ⚠️ See §9 — this version differs from what AI expects |
| **React 19** | UI | React Compiler is ON — **do not write `useMemo`/`useCallback`**, it's automatic |
| **Tailwind CSS v4** | All styling | ⚠️ No `tailwind.config.js` — config lives in CSS. See §9 |
| **lucide-react** | Icons | `import { Check, TriangleAlert } from "lucide-react"` |
| **sonner** | Toasts | `import { toast } from "sonner"` → `toast.error("...")` |
| **next-themes** | Dark mode | Already set up. Just use theme tokens, never hardcode colours |
| **zod** | Validation | Only if you need it |
| **@tanstack/react-form** | Forms | Already used in the auth forms. The thesis input is one textarea — **you don't need this**, plain `useState` is fine |

### Worth adding — one, maybe two

| Library | Install | Verdict |
|---|---|---|
| **motion** (framer-motion) | `bun add motion --filter web` | ✅ **Recommended.** The "assembling live" feel is our whole demo, and `<motion.div layout initial={{opacity:0, y:8}} animate={{opacity:1, y:0}}>` gets you 80% of it in one line. High payoff, easy to learn |
| **recharts** | `bun add recharts --filter web` | 🟡 **Only if you have spare time.** For the stock profile price history. Honestly a 30-line inline SVG sparkline looks better and weighs nothing — ask the AI for that first |

### Do NOT add

- ❌ **Any charting library beyond recharts** — no TradingView, no lightweight-charts, no ApexCharts. We are explicitly not building a trading terminal
- ❌ **A state manager** (Redux, Zustand, Jotai) — one `useReducer` in one hook handles everything. See §7
- ❌ **A data-fetching library** (react-query, SWR) — the stream is a plain `fetch`. Adding react-query on top makes it harder, not easier
- ❌ **A component library** (MUI, Chakra, Ant, Mantine) — you already have shadcn + Tailwind. Mixing will fight you and look inconsistent
- ❌ **A CSS-in-JS library** — Tailwind only
- ❌ **A markdown renderer** — the backend sends structured data, not markdown

> **Rule of thumb for 12 hours:** every dependency costs you install time + learning time + a chance it breaks the build at hour 11. If you're not sure, don't.

---

## 6. Where files go

```
apps/web/src/
  app/
    thesis/page.tsx              ← SCREEN 1 (the hero)
    stocks/[ticker]/page.tsx     ← SCREEN 2
    (existing: login, dashboard, layout, page)
  components/
    thesis/
      thesis-input.tsx           big input + example chips
      investigation.tsx          the stage timeline container
      stage-card.tsx             one stage (pending/running/done/failed)
      claim-chips.tsx            parsed claim as chips
      source-card.tsx            one source + tier badge   ← reused everywhere
      source-tier-badge.tsx      the 🟢🟡🔵🔴 badge
      finding-row.tsx            one finding + its citation
      metric-grid.tsx            the numbers
      counter-panel.tsx          "what could prove you wrong"
      verdict-card.tsx           "where you stand"
      concepts-learned.tsx       "what you just learned"
    demo/
      time-machine-bar.tsx       ← SCREEN 3 (Day 0/5/15/25)
    stocks/
      stock-profile.tsx
      risk-breakdown.tsx
  hooks/
    use-thesis-run.ts            ← the event reducer. See §7
  lib/
    thesis-client.ts             SSE fetch + parse
```

**Rule: one component per file, and if a file passes ~150 lines, split it.** This matters more than usual when you're working with AI — a small focused file is one the AI edits reliably. A 600-line page component is one it breaks.

---

## 7. The hard part: consuming the stream

This is the only genuinely tricky piece of the frontend, so here's the working code. Everything else is layout.

### Why not `EventSource`?
Because `EventSource` only does GET requests, and we POST the query. So: plain `fetch` + read the response body as a stream.

### `src/lib/thesis-client.ts`

```ts
import type { ThesisEvent } from "@bit-n-build-2026/contracts";
import { ENV } from "@/env";

export async function* streamThesis(
  query: string,
  signal?: AbortSignal,
): AsyncGenerator<ThesisEvent> {
  const res = await fetch(`${ENV.NEXT_PUBLIC_SERVER_URL}/api/thesis/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",          // ← REQUIRED, sends the auth cookie
    body: JSON.stringify({ query }),
    signal,
  });

  if (!res.ok || !res.body) throw new Error(`Stream failed: ${res.status}`);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;

    // SSE frames are separated by a blank line
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      yield JSON.parse(line.slice(6)) as ThesisEvent;
    }
  }
}
```

### `src/hooks/use-thesis-run.ts`

The reducer is **the only place in your app that knows events exist.** Every component just reads the resulting state object. This is what makes swapping mock → real a one-line change.

```ts
"use client";

import { useCallback, useRef, useState } from "react";
import { initialThesisState, reduceThesis } from "@bit-n-build-2026/contracts";
import { mockThesisRun, pickScenario } from "@bit-n-build-2026/contracts/mock";
import { streamThesis } from "@/lib/thesis-client";

// ⬇️ FLIP THIS ONE LINE when Ashwath's backend is ready
const USE_MOCK = true;

const MIN_STAGE_MS = 450;   // see the pacing note below

export function useThesisRun() {
  const [state, setState] = useState(initialThesisState);
  const abortRef = useRef<AbortController>(null);

  const run = useCallback(async (query: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setState({ ...initialThesisState(), status: "running" });

    const source = USE_MOCK
      ? mockThesisRun(pickScenario(query), "new")   // picks the right demo scenario from the text
      : streamThesis(query, ac.signal);

    let last = Date.now();
    try {
      for await (const event of source) {
        // pace it so the investigation is watchable
        const elapsed = Date.now() - last;
        if (elapsed < MIN_STAGE_MS) {
          await new Promise((r) => setTimeout(r, MIN_STAGE_MS - elapsed));
        }
        last = Date.now();
        setState((s) => reduceThesis(s, event));   // reducer ships in contracts
      }
    } catch (err) {
      if (!ac.signal.aborted) setState((s) => ({ ...s, status: "failed" }));
    }
  }, []);

  return { ...state, run };
}
```

### ⏱️ The pacing note — this is a real design decision

If the backend streams faster than ~250ms between events, **slow it down.** A 1.5-second investigation reads as "cached and fake." A 6–8 second one you can *watch reason* reads as real work.

Keep `MIN_STAGE_MS` as a named constant so you can tune it live during the demo rehearsal. This is not a hack — pacing is part of the product.

> ✅ **You do not write the reducer.** `reduceThesis` and `initialThesisState` are already
> written, typed and tested in `@bit-n-build-2026/contracts`. Just call them.

### The state shape every component reads

```ts
{
  status:  'idle' | 'running' | 'done' | 'failed',
  claim:   ParsedClaim | null,
  stages:  Record<StageId, { status, label, findings: Finding[] }>,
  sources: Record<string, SourceRef & { stance?: Stance }>,
  metrics: Metric[],
  concepts: Concept[],
  verdict: Verdict | null,
}
```

---

## 8. The event contract

`POST /api/thesis/stream` → `text/event-stream`. Body: `{ query: string }`. The user comes from the session cookie.

Every `data:` line is one JSON `ThesisEvent`. All types are exported from `@bit-n-build-2026/contracts`.

```ts
type StageId =
  | 'parse'          // Your claim
  | 'gather'         // Sources checked
  | 'verify_trigger' // Is the trigger real?
  | 'link_exposure'  // Does it reach this company?
  | 'fundamentals'   // The numbers
  | 'challenge'      // What could prove you wrong
  | 'learn'          // What you just learned
  | 'verdict';       // Where you stand

type SourceTier = 'official' | 'filing' | 'press' | 'market_data' | 'social';
type Stance     = 'supports' | 'contradicts' | 'neutral' | 'unverified';
type Level      = 'new' | 'learning' | 'practicing' | 'independent';

interface SourceRef {
  id: string;
  title: string;
  publisher: string;
  url: string | null;
  tier: SourceTier;
  publishedAt: string | null;   // ISO
  snippet: string;              // the actual quoted line we used
}

interface ParsedClaim {
  raw: string;
  trigger:   { text: string; kind: 'policy' | 'news' | 'earnings' | 'social' | 'price' | 'other' } | null;
  asset:     { ticker: string; name: string } | null;
  mechanism: string | null;     // "more orders → more revenue"
  horizon:   'intraday' | 'short' | 'long' | 'unspecified';
}

interface Finding {
  id: string;
  stage: StageId;
  text: string;                 // one sentence, plain English
  stance: Stance;
  strength: 'strong' | 'moderate' | 'weak';
  sourceIds: string[];          // NEVER empty — server drops empty ones
}

interface Metric {
  key: string;                  // 'pe'
  label: string;                // 'P/E ratio'
  value: number | null;
  display: string;              // '28.4'
  unit: string | null;
  sectorMedian: number | null;
  direction: 'high' | 'low' | 'normal' | 'unknown';
  explanation: string;          // already written at the user's level
  sourceIds: string[];
}

interface Concept {
  key: string;                  // 'pe_ratio'
  term: string;                 // 'P/E ratio'
  oneLiner: string;
  explanation: string;          // level-adjusted
  alreadyKnown: boolean;        // true => render as a subtle "you know this" chip
}

interface Verdict {
  holdsOn:    string[];
  weakOn:     string[];
  unverified: string[];
  nextChecks: string[];
  disclaimer: string;
}

type ThesisEvent =
  | { type: 'run.started';      runId: string; query: string; level: Level; at: string }
  | { type: 'claim.parsed';     claim: ParsedClaim }
  | { type: 'stage.started';    stage: StageId; label: string }
  | { type: 'source.found';     source: SourceRef }
  | { type: 'source.checked';   sourceId: string; stance: Stance }
  | { type: 'finding.added';    finding: Finding }
  | { type: 'metrics.ready';    metrics: Metric[] }
  | { type: 'concept.taught';   concept: Concept }
  | { type: 'stage.completed';  stage: StageId }
  | { type: 'stage.failed';     stage: StageId; message: string }
  | { type: 'verdict.ready';    verdict: Verdict }
  | { type: 'run.completed';    runId: string; durationMs: number }
  | { type: 'run.failed';       message: string }
  // Two early exits — both stop the stage timeline before it finishes.
  // See docs/handoff-frontend-integration.md TASK 2 for how to render them.
  | { type: 'run.needs_discovery'; query: string }
  | { type: 'run.not_covered';     ticker: string | null; name: string | null;
                                   covered: { ticker: string; name: string; sector: string }[] };
```

### The mock

```ts
import {
  mockThesisRun,          // the stream
  pickScenario,           // free text -> scenario, so the input routes itself
  MOCK_EXAMPLE_QUERIES,   // the 3 example chips, ready to render
  collectMockRun,         // whole run as an array, for static previews
} from "@bit-n-build-2026/contracts/mock";

mockThesisRun(
  scenario: 'hal_defense' | 'instagram_hype' | 'ipo_gmp',
  level: Level,
  opts?: { speed?: number },   // speed: 2 = twice as fast, handy while iterating
): AsyncGenerator<ThesisEvent>
```

All three scenarios are verified end to end: 35–41 events each, all 8 stages complete,
a verdict, and **zero unsourced findings**. Levels really do differ — the `new`
explanation of P/E is 208 characters, the `independent` one is 31.

Realistic delays baked in. **Start here today, before the backend exists.** All three scenarios are also our demo scripts — so building against them is literally building the demo.

### Other endpoints (screens 2 & 3)

| Method | Path | Returns |
|---|---|---|
| GET | `/api/stocks` | List of ~20 covered stocks |
| GET | `/api/stocks/:ticker` | Stock profile payload |
| GET | `/api/glossary/:term?level=` | Term explanation for the popover |
| GET | `/api/profile` | Current profile (level, known concepts, holdings) |
| POST | `/api/demo/seed` | Time Machine reseed → returns new profile |

All use the existing session cookie — **always pass `credentials: "include"`**.

---

## 9. Repo gotchas — read this before your AI wastes an hour

These are the things that will actually bite you.

### ⚠️ This is Next.js 16, not the Next.js your AI knows
There's a warning in `apps/web/AGENTS.md` about exactly this. APIs and conventions have changed from what's in AI training data. When the AI writes something that errors:

> Tell it: *"Read the relevant guide in `node_modules/next/dist/docs/` before answering."*

That's the fix. It works.

### ⚠️ Tailwind v4 has no `tailwind.config.js`
Config lives in CSS (`packages/ui/src/styles/globals.css`), via `@theme`. If your AI tries to create `tailwind.config.js`, stop it — the file won't do anything and you'll lose 20 minutes wondering why your colour doesn't apply.

### ⚠️ React Compiler is enabled
**Do not write `useMemo` or `useCallback` for performance.** It's automatic. If AI adds them everywhere, it's noise — harmless but it clutters files you need to read.

### ⚠️ `"use client"` at the top of anything interactive
Any file with `useState`, `useEffect`, event handlers, or our hooks needs `"use client"` as its first line. Symptom if you forget: *"You're importing a component that needs useState..."*

### ⚠️ Environment variables go through varlock, not `process.env`
```ts
import { ENV } from "@/env";
ENV.NEXT_PUBLIC_SERVER_URL   // ✅
process.env.NEXT_PUBLIC_...  // ❌ don't
```

### ⚠️ Ports
Web is **3001**, server is **3000**. If you fetch `localhost:3001/api/...` you're hitting yourself, not the backend.

### ⚠️ Workspace imports use the full package name
```ts
import { Button } from "@bit-n-build-2026/ui/components/button";  // ✅
import { Button } from "../../packages/ui/...";                   // ❌
```

### ⚠️ Colours come from theme tokens
Use `bg-background` `text-foreground` `text-muted-foreground` `border-border` etc. **Never** `bg-white` or `text-black` — dark mode is already wired and hardcoded colours will break it. A broken dark mode on a projector is a bad look.

---

## 10. Ready-to-paste AI prompts

Do these in order. One chat per task, or at least one clear message per task.

**Every prompt should start with:**
> *Read `docs/handoff-frontend.md` and `docs/product-thesis.md` first. Follow the repo gotchas in §9 exactly.*

---

**Task 1 — the tier badge (start small, build confidence)**
> Create `apps/web/src/components/thesis/source-tier-badge.tsx`. A small badge component taking a `tier` prop of type `SourceTier` from `@bit-n-build-2026/contracts`. Show an icon + a short text label + a colour. Map: official = green/shield, filing = green/file-text, press = amber/newspaper, market_data = blue/chart, social = red/message-circle. Use lucide-react icons and Tailwind theme tokens only — no hardcoded colours. Colour must never be the only signal; always show the text label too. Keep it under 50 lines.

**Task 2 — the source card**
> Create `apps/web/src/components/thesis/source-card.tsx`. Props: a `SourceRef` plus an optional `stance`. Show the tier badge, the title, the publisher and date, and the snippet as a short quote. If `url` is present the whole card links out in a new tab. If a stance is given, show it as a small marker: supports = check, contradicts = alert-triangle, neutral = minus. Compact — these stack in a list of 6+.

**Task 3 — the stage card shell**
> Create `apps/web/src/components/thesis/stage-card.tsx`. Props: `title`, `status` ('pending' | 'running' | 'done' | 'failed'), and children. Pending renders a Skeleton from `@bit-n-build-2026/ui/components/skeleton`. Running shows an animated indicator. Done shows the children with a check. Failed shows the message but keeps the card visible — never blank the screen. Use `motion` from the `motion` package so content fades and slides up slightly as it appears.

**Task 4 — the hook**
> Create `apps/web/src/hooks/use-thesis-run.ts` following §7 of `docs/handoff-frontend.md` exactly, including the `MIN_STAGE_MS` pacing and the `USE_MOCK` flag. Do NOT write a reducer — import `reduceThesis` and `initialThesisState` from `@bit-n-build-2026/contracts`, they already exist. Also create `apps/web/src/lib/thesis-client.ts` exactly as shown in §7.

**Task 5 — the input**
> Create `apps/web/src/components/thesis/thesis-input.tsx`. A large textarea with the placeholder "Government increased defense spending, so I want to buy HAL", a submit button, and three clickable example chips rendered from `MOCK_EXAMPLE_QUERIES` exported by `@bit-n-build-2026/contracts/mock`. Plain `useState` — do not use @tanstack/react-form. On submit, call an `onSubmit(query)` prop.

**Task 6 — the page**
> Create `apps/web/src/app/thesis/page.tsx`. Wire `ThesisInput` to `useThesisRun`. Before a run, show the input centred and large. After submit, collapse the input to a compact header and render the stage timeline below using StageCard, following the ASCII layout in §11. Build the remaining stage components as separate files under `components/thesis/`.

Then continue with the counter panel, verdict card, metric grid, Time Machine bar, and stock profile the same way — one file per request.

### How to work with the AI effectively

- **One file per request.** "Build the thesis page" gives you 600 broken lines. "Build the source card" gives you 40 good ones.
- **When something breaks, paste the actual error text.** Don't describe it. The exact message is the most useful thing you can give it.
- **If it's wrong twice in the same way, the context is wrong, not the model.** Start a fresh chat and re-paste this doc.
- **Refuse scope creep.** If AI offers to add a charting library, a state manager, or a settings page — no. §5 lists what we're not adding, and it's there because each one costs an hour we don't have.
- **Check it used our stuff:** imports from `@bit-n-build-2026/ui/components/*`, theme tokens not hex codes, `"use client"` where needed. These three catch most of the mistakes.
- **Commit after every working component.** `git add -A && git commit -m "source card"`. If AI wrecks something at hour 9, you lose 10 minutes instead of everything.

---

## 11. Screen 1 — Thesis Investigation (full spec)

### The interaction

One large, inviting input. The placeholder is a real sentence, not "Search stocks":

> *"Government increased defense spending, so I want to buy HAL"*

Below it, three tappable example theses. These also **de-risk the live demo** — one click, no typing, no typos on stage:

- *"Everyone on Instagram is saying this stock will explode"*
- *"Defense spending is up, so HAL should benefit"*
- *"This IPO has a high GMP so it should list well"*

User submits → input collapses to a compact header → **the investigation assembles below it.**

### The single most important requirement

> **The investigation must visibly build itself, stage by stage, in front of the judges.**

Not a spinner followed by a wall of text. Stages appear as skeletons, then fill. Source cards land one at a time. Counter-evidence arrives **last, always** — that's the emotional beat of the whole demo.

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  "Government increased defense spending, so buy HAL"    │
│  [Day 0][Day 5][Day 15][Day 25]        ← demo bar       │
├─────────────────────────────────────────────────────────┤
│ ✓ YOUR CLAIM                                            │
│   [trigger: defense budget ↑] [asset: HAL]              │
│   [mechanism: more orders] [horizon: not specified]     │
├─────────────────────────────────────────────────────────┤
│ ✓ SOURCES CHECKED                        6 sources      │
│   🟢 PIB — Union Budget defense allocation    ✓supports │
│   🟢 HAL Q2 FY26 investor presentation        ✓supports │
│   🔵 NSE market data — price & ratios         ·neutral  │
│   🟡 Business Standard — sector outlook       ✗contra   │
├─────────────────────────────────────────────────────────┤
│ ✓ IS THE TRIGGER REAL?                                  │
│   Yes — defense allocation rose 13% YoY.     [2 sources]│
├─────────────────────────────────────────────────────────┤
│ ✓ DOES IT REACH HAL?                                    │
│   Partly — HAL's order book is heavily...    [1 source] │
├─────────────────────────────────────────────────────────┤
│ ✓ THE NUMBERS                     ← no AI, raw data     │
│   P/E 28.4  (sector median 19.2)   ↑ high               │
│   EPS ₹—    52wk ₹— – ₹—     Debt/Equity —              │
├─────────────────────────────────────────────────────────┤
│ ⚠ WHAT COULD PROVE YOU WRONG        ← lands LAST        │
│   The budget increase is public information and may     │
│   already be reflected in the price.         [1 source] │
├─────────────────────────────────────────────────────────┤
│ 📘 WHAT YOU JUST LEARNED                                │
│   P/E · order book · "priced in"                        │
├─────────────────────────────────────────────────────────┤
│ WHERE YOU STAND                                         │
│   Holds on:  trigger is real · company is exposed       │
│   Weak on:   valuation already elevated                 │
│   Go check:  order book growth vs. peers                │
│   ⓘ This is not a recommendation to buy or sell.        │
└─────────────────────────────────────────────────────────┘
```

### Non-negotiable visual rules

1. **Every claim shows its citation.** A number without a `[n sources]` affordance next to it is a bug. Clicking it opens the source.
2. **Source tier is always visible.** Colour + icon + text label — never colour alone (accessibility, and judges may be squinting at a projector).
3. **Counter-evidence is styled as prominently as supporting evidence.** Do not bury it in small grey text. It's our entire thesis, literally.
4. **No BUY/SELL anywhere, ever.** No green "good stock" badge, no score out of 10. If a design instinct says "add a rating," resist it — that instinct is the thing we're arguing against.
5. The disclaimer in the verdict block is permanent UI, not a footer.

### Empty / error states

- **Query can't be parsed** → show what it *did* extract and ask the user to name the company. Don't fail hard.
- **A stage fails** → mark that stage failed, keep the rest of the investigation visible. Never blank the screen.
- **Unknown ticker** (not in our 20) → be honest: *"We don't have verified sources for that company yet."* Then list what we do cover. **Honesty here is on-brand** — if a judge tries a random ticker, this demonstrates rule #1 instead of breaking.

---

## 12. Screen 2 — Stock profile

Route: `/stocks/[ticker]`, data from `GET /api/stocks/:ticker`. Reached from any ticker chip in the app.

Not a trading terminal. Sections, top to bottom:

1. **What does this company actually do?** — two plain sentences. No jargon.
2. **The numbers** — a small grid of metric cards. Value, sector median, a high/low/normal indicator, a one-line explanation, and a citation. Every metric tappable → term popover.
3. **Risk, with reasons** — never a bare score:
   - Price volatility — High / Medium / Low, *because…*
   - Debt — …
   - Valuation — …
   - Business stability — …

   Each row carries its own reason and citation. **A number without a reason beside it is exactly what we're arguing against.**
4. **Recent sources** — documents and announcements we hold for this company, tier-badged, newest first.
5. **CTA:** *"Thinking about investing in this? Tell us why →"* — drops the user into the thesis screen with the ticker prefilled. **This is how the two screens connect.**

---

## 13. Screen 3 — Demo control bar (Time Machine)

A small, always-visible bar with four buttons: **Day 0 · Day 5 · Day 15 · Day 25**.

`POST /api/demo/seed { stage: 'day0' | 'day5' | 'day15' | 'day25' }` resets and reseeds the logged-in user's profile, returns it. Then re-run the current thesis.

Render a compact summary of the active profile so the change is legible on a projector:

```
Day 15 · learning · knows: P/E, EPS, 52-week range · 3 positions · 2 past theses
```

**The demo beat:** same query, hit Day 0, hit Day 25, watch the explanations change depth and watch the AI reference a past thesis. Make that transition feel deliberate — **a brief highlight on the changed text helps enormously.**

Style it as a visible demo affordance. It is one. Don't hide it in a settings menu — the judges need to see us press it.

---

## 14. Design direction

- **Calm, not Bloomberg.** Our user is intimidated by finance UIs. Generous whitespace, one clear idea per section, restrained colour.
- **Colour carries meaning, sparingly.** Only stance (supports/contradicts/neutral) and source tier get strong colour. If everything is coloured, the contradiction panel stops reading as important — and that panel is the point.
- **Typography does the hierarchy.** Stage titles should feel like section headings in a report, not dashboard widget chrome.
- **Dark mode already works** — use theme tokens, never hardcode.
- **Mobile:** the stage timeline must stack cleanly. Judges may well look at it on a phone.

---

## 15. Definition of done

Screen 1 is done when, without the backend running:

- [ ] You can click an example thesis and watch the full investigation assemble
- [ ] Stages appear as skeletons then fill, one after another
- [ ] Source cards land one at a time with visible tier badges
- [ ] Counter-evidence appears last and is visually prominent
- [ ] Every number has a clickable citation affordance
- [ ] The verdict shows holds-on / weak-on / go-check plus the disclaimer
- [ ] Nothing anywhere says BUY, SELL, or gives a score
- [ ] Dark mode looks right
- [ ] It doesn't break at phone width
