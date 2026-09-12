# Demo — how it works, and the one rule

## The rule

> # The pipeline always runs.
>
> Seeding sets up **who the user is**. It never sets up **what the AI says**.
>
> There is no playback mode, no cached verdict, no pre-computed findings, and no
> branch anywhere in the codebase that behaves differently during a demo.

When we hit Day 15 and run a thesis, `/api/thesis/stream` executes all eight
stages, calls the model live, retrieves from the same sources, and applies the
same citation and no-recommendation guards it would for any user at any time.

**If a judge ignores our suggested question and types their own, it works exactly
the same way.** That is the whole point — and it's the answer if anyone asks
whether the demo is scripted.

The only thing seeding changes is *how deeply things get explained*, because that
is genuinely what the user profile is for.

---

## What the seed actually writes

A real row in the `user_profile` Postgres table:

| Column | What it holds |
|---|---|
| `level` | new / learning / practicing / independent |
| `known_concepts` | glossary keys already explained — so we stop re-explaining |
| `holdings` | positions, each with its share of the portfolio |
| `past_theses` | previous theses, whether they held up or broke, and the lesson |
| `day_index` | days since they started |

If a judge asks to see the data, open the table. There is data.

---

## The four personas

| Stage | Level | Knows | Holds | Past theses |
|---|---|---|---|---|
| **Day 0** | new | nothing | nothing | none |
| **Day 5** | learning | P/E | ITC | 1 unresolved |
| **Day 15** | practicing | P/E, EPS, 52-week, order book | ITC, TATAMOTORS, BEL | 2 — one **broke** |
| **Day 25** | independent | + priced in, D/E, valuation | + INFY | 3 — one broke, two held |

The Day 15 broken thesis is deliberate:

> *"Everyone is talking about this defence stock so it will keep rising"* → **broke**
> Lesson: *"You bought on attention, not on a mechanism. The move had already
> happened before you heard about it."*

That's what lets the AI at Day 25 reference a mistake the user actually made.
No friend, no trainer and no YouTube channel remembers that. We do.

---

## Two ways to seed

### In the UI — the Time Machine bar

`POST /api/demo/seed { "stage": "day15" }`

Returns the new profile plus a `suggestedPrompt` for the UI to prefill.

**`suggestedPrompt` is a question, not an answer.** It saves typing on stage and
avoids a typo in front of judges. Nothing downstream of it is canned.

| Stage | Suggested question |
|---|---|
| Day 0 | "Government increased defense spending, so I want to buy HAL" |
| Day 5 | "Everyone on Instagram is saying this stock will explode" |
| Day 15 | "Defence spending is up, so HAL should benefit" |
| Day 25 | "HAL's P/E looks high against the sector — is the order book enough to justify it?" |

### From the CLI — before the demo starts

```bash
bun run --filter server seed:demo you@email.com day15
```

Prints the resulting profile so you can confirm state before walking on stage.

---

## Running the demo

1. **Seed Day 0.** Ask the defence question. Let it assemble. Stop on the
   counter-evidence panel: *"notice it just argued against the user."*
2. **Click a source.** *"Every number here came from somewhere. Here's where."*
3. **Hit Day 25. Same question.** The explanations shorten, and the AI references
   the thesis the user got wrong on Day 15.
4. **Invite a judge to type their own.** This is the strongest move available —
   it proves nothing is scripted. It works; it just needs a company in our
   dataset.

### Expected timing

A full run is **~15 seconds** against live models — eight stages, five model
calls, zero cached. If it's much slower, the gateway is having a moment; the
run still completes because every stage degrades independently.

### If something fails mid-demo

It degrades honestly and keeps going. A failed stage shows its reason
(*"No sources available to check this against"*) and the rest of the
investigation continues. Nothing blanks the screen.

If a judge asks for a company outside our 20, it says so plainly and lists what
we do cover. **Let that happen if it happens** — it demonstrates the core promise
better than any slide: we don't have verified sources, so we don't make anything
up.

---

## What to say if asked "is this just a chatbot?"

Three answers, all verifiable in the code:

1. **It cannot state an unsourced number.** Every claim must carry source ids;
   `enforceCitations()` drops any that don't, and strips invented ids. Tested
   against a deliberately adversarial model.
2. **It cannot recommend.** `checkNoRecommendation()` blocks buy/sell/probability
   language before it's emitted.
3. **It argues against the user by design.** The challenge stage exists solely to
   find reasons the reasoning is wrong, and always runs.

Those are enforced in code, not requested in a prompt.
