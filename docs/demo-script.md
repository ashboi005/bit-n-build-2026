| Field | Enter |
|---|---|
| Age | 18–24 |
| Experience | I've never invested |
| Goal | I mostly want to understand how this works |
| Horizon | 3 to 5 years |
| If it dropped 20% | **I'd want to sell straight away** |
| Monthly amount | **← the judge's number** |
| Notes | I'm a student, money from part-time work |


## 2 · Chat — the judge's number  ·  30s
How much should I put into my first stock?

## 3 · Thesis — the bad idea  ·  60s
Go to **thesis**, type:
> **My friend told me to buy HAL because defence spending is going up**

Let it assemble. **Don't talk over it.** Stop on:

**① It names the assumption they never said out loud**
> *mechanism: "Higher defence spending → more orders for HAL → higher revenue → higher share price."*

**② It argues against them, with a real source**
> "The defence budget increase was public and widely expected… defence share prices
> had already re-rated sharply before it."

**③ 🎯 The line to stop on**
> **"'my friend told me' is not evidence. The friend may be right, but the sentence
> gives you no way to check whether they are."**

🗣️ *"It didn't rate the stock. It graded the reasoning — and found the weakest part
was where the idea came from."*

Then **click a source.**

---

## 4 · Day 90 — same screen, same kind of question  ·  60s

1. Click **Day 90** → bar reads `independent · knows 7 · 4 positions · 3 past theses`
2. Still on **thesis**, type:

> **Everyone on Instagram is saying BEL will keep going up**

### The difference, verbatim

**Day 15 verdict:**
> "Your trigger is Instagram chatter. The sources contain no sentiment or social-media
> data at all…"

**Day 90 verdict:**
> "The trigger is Instagram chatter… **This is the same shape as your 2026-07-18
> defence trade: you bought on attention.**"

🗣️ *"Same question. It remembers the trade that broke — and the date."*

> Optional, if they want more: the **"go check" steps** also get sharper —
> Day 15 says "look up revenue for three years", Day 90 says "trace the
> capital-acquisition budget line to BEL's segment revenue in the next two quarters".

---

## 5 · What changed  ·  30s

Open **what changed** at Day 90:

```
BEL — "Everyone is talking about this defence stock so it will keep rising"
⚠ NOT HELD UP     ₹454.16 → ₹405.50  (-10.7%)
[warning]   Your reasoning: the specific reason you gave has not held up
[attention] Large share of your portfolio
NEW filing  2026-09-11  Bharat Electronics Ltd — Appointment
```

🗣️ *"It's not saying sell. It's saying the reason he gave hasn't held up, and here's
what to check."*

---

# Push-back answers

**"Isn't this a chatbot?"**
Three things enforced in code, not prompts:
- Can't state an unsourced number — invented citations are stripped. Caught one
  live: `[screener_hal_bel]`, an id it fused from two real ones.
- Can't recommend — buy/sell/probability language is blocked.
- Argues against the user by design; the challenge stage always runs.

**"Type a company you don't cover."** ✅ Invite it.
> "We don't have verified sources for Wipro Limited yet. Here's what we do cover."

🗣️ *"Every number has to come from somewhere. If we haven't checked a company, we
say so instead of guessing."*

**"Is the data live?"**
🗣️ *"Real data from BSE, Screener and NSE — 20 companies, 233 documents including
filings from yesterday. A committed snapshot we refresh on demand, so an upstream
rate-limit can't break a demo."* ❌ **Never say "live".**

**"Why only 20?"**
🗣️ *"Ingestion decision, not a technical limit — same pipeline works for any listed
company. Each one needs a sector for peer comparison and a plain-English
description, and our promise is verified sources. Better to cover 20 properly than
2,000 badly."*

**If a ⚠️ unverified-figure note appears** — don't hide it.
🗣️ *"That's our own check catching the model. It flagged a number it couldn't trace
to a source. Most products would have shown it to you confidently."*

---

# Prompt bank

**Thesis**
- `My friend told me to buy HAL because defence spending is going up` ← Day 0
- `Everyone on Instagram is saying BEL will keep going up` ← Day 15 / Day 90 contrast
- `Defence spending is up, so HAL should benefit` ← Day 45
- `HAL's P/E is 35 against a sector median of 48 — is the order book enough?` ← Day 90
- `I want to invest long term in something safe and established` ← discovery, no company

**Chat**
- `How much should I put into my first stock?` ← the judge's number
- `Is BEL too much of my portfolio?`
- `Remind me what I said I struggle with?` ← cross-thread memory
- `What does P/E mean and should I care?`

---

# Two rules

1. **Never auto-submit the prefilled prompt.** Press send yourself — a human
   pressing the button is what proves it's live.
2. **Never say "live data".** Say *"real data, refreshed on demand."*

**Total: ~4 minutes.**
