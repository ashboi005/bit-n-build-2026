# Mind Over Money — Product Thesis

**Bit N Build 2026, Punjab Round**
Team: Ashwath (backend + RAG), Sayam (frontend/UX), Tushar (sources platform), PM (pitch/deck/script)
Build window: ~12 hours

---

## 1. The one-liner

> **We don't tell beginners what to buy. We stress-test *why* they want to buy it — and show them every source we used.**

Longer form, for the deck:

> An evidence-backed investment research companion that turns a beginner's investment idea into a guided investigation — verifying the claim, connecting it to the company, showing the real numbers, arguing the other side, and teaching the concepts along the way.

---

## 2. Where this came from (user research)

We interviewed a real casual investor — a layman who trades occasionally and learned everything himself. The interview reframed the problem.

### His actual workflow

> Hear about a stock or sector → Google it → learn what P/E, EPS, valuation mean → check 52-week high/low and trend → check company background → factor in sector news and government budget allocation → decide → slowly build intuition through experience.

### What he told us, verbatim in substance

| # | What he said | What it means for the product |
|---|---|---|
| 1 | He checks valuation, company background, P/E, EPS — but **had to learn all of it himself**, through training, Google, and friends | The friction isn't the metric, it's the *interpretation* and how scattered the learning is |
| 2 | He uses 52-week high/low to judge trend and entry timing | Beginners reason in **chains** ("this signal → therefore buy"), not in isolated metrics |
| 3 | "If the government allocates budget to defense, it's just known you buy defense shares." For a new IPO, he checks GMP | Real reasoning is **event → sector → company**. Context, not a standalone number |
| 4 | **"AI should give sources, otherwise not trustable."** Instagram and hype reels are not trustworthy. Even a bank's advice he'd still verify | Sourcing is a **product law**, not a feature |
| 5 | "A person will have to understand everything" — his fear of risk is really a fear of not understanding | The goal isn't to remove the thinking. It's to make the thinking possible |

### The insight

The problem statement says beginners don't understand financial information. That's only half of it. The real gap our interview exposed:

> **Even once you understand P/E and EPS individually, nobody teaches you how to put them together to evaluate the reason you wanted to buy in the first place.**

Financial literacy is not vocabulary. It's reasoning.

---

## 3. Two product laws

These are architecture, not slogans. Both are enforced in code and both are demoable.

### Law 1 — No unsourced number reaches the screen

Every figure the AI states carries a source id. The model is required to emit `{ claim, sourceIds[] }`; **any claim with an empty array is dropped server-side before it renders.** The AI physically cannot invent a number and have it appear.

Sources carry a visible tier:

- 🟢 **Official** — government, SEBI, exchange, RBI, PIB
- 🟢 **Filing** — annual report, quarterly result, investor presentation
- 🟡 **Press** — established financial publication
- 🔵 **Market data** — price, volume, ratios
- 🔴 **Social / unverified** — shown, labelled, and never used as evidence

This directly answers the interview's strongest signal: *AI without sources is not trustable.*

### Law 2 — The AI never rates an asset

No `BUY`. No "72% chance of going up." No score out of 10 presented as truth.

It evaluates **the user's reasoning**, not the asset. This is what separates us from the obvious build ("AI stock dashboard") and it's what survives a judge asking *"how do you justify that recommendation?"* — we don't make one.

---

## 4. The hero: Thesis Investigation

The user types what they'd actually say out loud:

> *"Government increased defense spending, so I want to buy HAL."*

The app does not answer. It **opens an investigation, and assembles it visibly** on screen, stage by stage:

| Stage | What lands on screen |
|---|---|
| **Your claim** | Parsed into chips: *trigger event · asset · mechanism · time horizon*. The user sees their own thinking structured for the first time |
| **Sources** | Source cards appear one at a time as they're checked, each with a tier badge |
| **Is the trigger actually true?** | ✓ / ✗ against an official source |
| **Does it actually touch this company?** | The exposure link, cited |
| **What do the numbers say?** | Raw fundamentals, **zero AI** — straight from the data pipeline |
| **What could prove you wrong?** | Counter-evidence. Always present, always last |
| **What you just learned** | The 2–3 concepts used, explained at the user's current level |
| **Where you stand** | *"Your reasoning holds on A and B. It's weak on C. Go check D."* Never buy/sell |

The counter-evidence panel arriving **last and always** is the emotional beat of the demo. It's the moment a judge sees this isn't a hype machine — it's the opposite of one.

### Why this is the right centrepiece

It is the natural extension of the problem statement rather than a bolt-on. A beginner's real mental model is:

> "I saw X, therefore stock Y will go up."

Every single one of the four PS focus areas gets exercised in service of testing that one sentence — LLM document processing, intuitive interfaces over dense data, risk evaluation against a user profile, and data-driven logic that counters impulsive trend-following. We don't implement them as four separate features. They're four stages of one investigation.

---

## 5. The differentiator: real money from day one, with memory

This is the part of the pitch that isn't a UI argument.

### Paper trading doesn't build confidence — it postpones it

A simulator lets you win and lose money that was never real. Nothing is learned emotionally, because nothing was at stake. The moment that user puts in a real ₹10,000, every instinct the simulator gave them evaporates — they're a beginner again, except now they're scared and it's expensive.

**Fear is not removed by practice on fake money. It's removed by understanding.**

### A friend or a trainer doesn't remember you

Ask a friend for advice and they know roughly nothing about your situation. They don't remember the decision you made three weeks ago, they don't know what fraction of your portfolio this trade represents, they don't remember where you took a loss and why, and they definitely don't remember which concepts you've already had explained to you twice.

**The AI does.** Complete context, permanently:

- What you've already learned — so it stops over-explaining
- What you hold, and what proportion of your portfolio this decision is
- Which theses of yours held up and which ones broke
- Where you took losses, and what the reasoning error actually was

That memory is the thing no friend, no trainer, and no YouTube channel can give you. It's also what makes advice specific rather than generic.

### So the user invests real money from day one — with a net

They're making real decisions with real consequences, which is the only way honest confidence is built. But every decision is stress-tested before they make it, and every outcome is remembered and fed back.

Losses will still happen. **Losses happen to everyone** — to the novice, to the person who took formal training, to the friend giving advice. That's not a failure mode, that's the market. The difference is that here, a loss comes with a recorded reason and a lesson attached, instead of being a mystery that makes you never try again.

### And then you leave

Which leads to the most unusual thing about this product, and the line we should open or close the pitch with:

> **The software is designed to make itself obsolete.**

Use it for four months, six months, eight months — however long it takes until you're confident enough. The whole arc is:

| Stage | User asks | AI does |
|---|---|---|
| **1** | "What is P/E?" | Explains the concept |
| **2** | "What does this P/E mean for *this* company?" | Explains using real company data |
| **3** | "I think this is expensive — am I right?" | Provides sources, comparison, counter-arguments |
| **4** | *(doesn't ask)* | User researches independently. They don't need us |

Every other fintech product is built to maximise how long you stay. We're built around the opposite promise: **stay exactly as long as you need to, and leave when you're ready.** That's a genuinely different relationship with a financial product, and it's the most quotable thing in the pitch.

---

## 6. Making personalisation visible: the Time Machine

Personalisation that a judge can't *see* in a five-minute demo may as well not exist. So we show it directly.

A demo control bar: **`Day 0 · Day 5 · Day 15 · Day 25`**

Each button resets the user's state and reseeds a profile from a script — concepts learned, portfolio held, past questions asked, past theses and their outcomes. Then we **run the same thesis again**:

- **Day 0** — *"P/E is 28.4. That means investors are paying ₹28.40 for every ₹1 the company earns. Here's why that matters…"*
- **Day 25** — *"P/E 28.4 against a sector median of 19.2. You already know this one — the real question is whether the order book justifies the premium."*

Same screen. Same query. Four seconds apart. That's the proof.

It also demonstrates the memory argument from §5 in a way words can't: at Day 25 the AI references a thesis the user got wrong on Day 15.

---

## 7. Scope

### Building

1. **Thesis Investigation** — the hero, streamed and visibly assembling
2. **Simplified stock profile** — plain-English business summary, fundamentals with tap-to-explain, risk breakdown with reasons, all cited
3. **Time Machine demo bar** — profile reseed across 4 stages

Which covers the PS minimum scope: beginner dashboard with simplified asset profiles ✓, plain-English translation of terms ✓, visual risk indicator ✓, guided decision flow without hype ✓.

### Not building

Portfolio tracker · price prediction · buy/sell signals · literacy-progress gamification (great pitch line, wrong 12-hour feature — it's day-60 value) · technical indicators · watchlists · social feed · notifications.

Every one of these is a way to lose the demo.

---

## 8. Architecture at a glance

```
apps/web        (Sayam)   Next.js — 3 screens, consumes an SSE event stream
apps/server     (Ashwath) Elysia — SSE thesis endpoint, REST, auth (already done)
packages/agents (Ashwath) Mastra — investigation workflow, citation enforcement
packages/sources(Tushar)  Seeded dataset + retrieval + optional live fetchers
packages/contracts        Shared types + mock event generator  ← written first
```

`packages/contracts` exists so that **Sayam builds the entire hero screen against mock streaming data from minute one** and is never blocked on the backend or the dataset. In a 12-hour build, the interface contract is the most valuable artifact in the repo.

Auth is already complete — better-auth + Drizzle, `/api/auth/*` mounted, sign-in/sign-up/dashboard shipped.

---

## 9. Demo script skeleton (for PM)

1. **Frame it with the real person.** "My father trades occasionally. He learned P/E, EPS and valuation entirely on his own, through training and Google. This is built for him."
2. **Type his actual reasoning.** *"Government increased defense spending, so I want to buy HAL."*
3. **Let it assemble.** Don't narrate over it. The stages landing one by one is the product.
4. **Stop on counter-evidence.** "Notice it just argued against the user."
5. **Click a source.** "Every number on this screen came from somewhere. Here's where."
6. **Hit Day 25.** Same query. Watch the explanation change. "It remembers what he's learned."
7. **Land the close.** "Every other app wants him to stay forever. We want him to not need us in six months."

### Likely judge questions

- *"Isn't this just a chatbot?"* → It can't say BUY, it can't state a number without a source, and it argues against the user by design. Those are enforced in code, not in a prompt.
- *"How is this different from ChatGPT?"* → ChatGPT doesn't know his portfolio, doesn't remember the thesis he got wrong last month, and will happily invent a P/E ratio.
- *"Where does the data come from?"* → Official sources first, tiered and labelled on screen. Show the badge.
- *"Is this financial advice?"* → No. It never rates an asset. It evaluates the user's reasoning and hands the decision back.
