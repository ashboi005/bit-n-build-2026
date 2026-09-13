# Demo script — rehearsed, with real outputs

Everything below was run against the live system. The quotes are verbatim.

---

## Before you start

```bash
bun run --filter @bit-n-build-2026/sources refresh   # so dates read as current
curl -s localhost:3000/api/health                    # expect stocks: 20
```

Check `vectors` says `{"store":"qdrant", ...}` and not `{"status":"indexing"}`.
Give it ~30 seconds after a restart.

---

## The spine

> **Reset → onboard live → ask a bad thesis → jump to Day 90 → ask it again**

Four beats. The last one is the product.

---

# Beat 1 — Reset, and onboard in front of them

Hit **Reset**. It deletes the account and drops you at sign-up. Sign up fresh.

## 🎯 The killer move: ask a judge for a number

When onboarding asks for a monthly budget, **turn to a judge and ask them to
shout a random amount.** Type exactly what they say.

Enter these:

| Question | Answer |
|---|---|
| How old are you? | **18–24** |
| Have you invested before? | **I've never invested** |
| What are you hoping to get out of this? | **I mostly want to understand how this works** |
| When might you need this money back? | **3 to 5 years** |
| If your investment dropped 20%? | **I'd want to sell straight away** |
| Roughly how much a month? | **← the judge's number** |
| Anything else? | *"I'm a student and this is money from my part-time work"* |

## Then go to chat and ask:

> **"How much should I put into my first stock?"**

Tested with ₹1,332. Verbatim reply:

> "You have about **₹1,332 a month** available to invest… You also said you would
> **sell immediately if a stock dropped 20%**. This means you should pick a company
> that is not extremely volatile. For example, Reliance Industries has a 52-week
> range of ₹1,250 to ₹1,612, which is a moderate swing [screener_reliance_fundamentals].
> …you may need the money in **3 to 5 years**, which is a good time frame."

**Three things a judge can verify in one answer:** their number, their risk answer,
their time horizon. Plus a cited real figure.

> Say: *"Nobody typed that number into a prompt. It came from what I answered
> ninety seconds ago, and it'll still be there in six weeks."*

---

# Beat 2 — The bad thesis

Go to the thesis screen and type:

> **"My friend told me to buy HAL because defence spending is going up"**

Watch it assemble. **Don't narrate over it.** Stop on two things:

**It structures their hidden assumption** — the user never said this out loud:

> mechanism: *"Higher defence spending leads to more orders for HAL, which leads to
> higher revenue and therefore a higher share price."*

**It argues against them,** citing an actual Business Standard piece:

> "The defence budget increase was public and widely expected, and analysts say
> defence share prices had already re-rated sharply before it, so the news the
> friend is citing may already be reflected in the price."

## 🎯 The line to stop on

In the verdict:

> **"There is also a source-of-advice problem worth noticing: 'my friend told me'
> is not evidence. The friend may be right, but the sentence gives you no way to
> check whether they are."**

> Say: *"It didn't rate the stock. It graded the reasoning — and noticed the
> weakest part was where the idea came from."*

Then click a source. Every number traces back.

---

# Beat 3 — Day 90. Same kind of question.

Hit **Day 90**. The bar shows: `independent · knows 7 concepts · 4 positions · 3 past theses`.

Now ask the *same kind* of hype question the beginner would ask:

> **"Everyone on Instagram is saying BEL will keep going up. Should I put more in?"**

## Day 15 answers like this:

> "Your history shows you bought ITC because you thought a big company was safe…
> BEL's price-to-earnings ratio is 48.1, which is very high… You told me you would
> panic-sell if your investment dropped 20%."

## Day 90 answers like this:

> **"Your history shows you bought BEL after seeing it on three different reels in
> one day, and that move broke because you bought after the price had already
> moved up.**
>
> …BEL has a very high valuation with a P/E of 48.1, which is much higher than the
> rest of the sector.
>
> **You previously skipped Nestle India because its P/E was too high and you could
> not find a reason the earnings justified it.**"

## 🎯 This is the whole pitch in one screen

> Say: *"Same question. The difference is it remembers the thesis that broke, and
> the time they walked away from a stock for a good reason. No friend remembers
> that. No chatbot has it."*

---

# Beat 4 — "What changed since you last looked"

Open it at Day 90:

```
BEL — bought, thesis: "Everyone is talking about this defence stock so it will keep rising"
  ⚠ NOT HELD UP    ₹454.16 → ₹405.50  (-10.7%)
  [warning]   Your reasoning: the specific reason you gave has not held up
  [attention] Large share of your portfolio
  NEW filing  2026-09-11  Bharat Electronics Ltd — Appointment
```

> Say: *"It's not telling him to sell. It's telling him the reason he gave has
> not held up, and pointing at what to check."*

---

# If a judge pushes back

**"Isn't this just a chatbot?"**
Three answers, all enforced in code, not prompts:
- It cannot state an unsourced number — invented citations are stripped
  automatically. Caught one live: `[screener_hal_bel]`, an id the model invented
  by fusing two real ones.
- It cannot recommend — buy/sell/probability language is blocked.
- It argues against the user by design; the challenge stage always runs.

**"Type a company you don't cover."** Invite this. You get:

> "We don't have verified sources for Wipro Limited yet. We only cover companies
> we've actually checked — here's what we do cover."

> Say: *"Every number we show has to come from somewhere. If we haven't checked a
> company, we say so instead of guessing. That's the whole product in one screen."*

**"Is the data live?"**
Say: *"Real market data from BSE, Screener and NSE — 20 companies, 233 documents
including filings from yesterday. It's a committed snapshot we refresh on demand,
deliberately, so an upstream rate-limit can't break a demo."* **Do not say "live".**

**"Why only 20?"**
> *"It's an ingestion decision, not a technical limit — same pipeline works for any
> listed company. But each one needs a sector for peer comparison and a
> plain-English description, and our promise is verified sources. We'd rather cover
> 20 properly than 2,000 badly."*

**If a ⚠️ unverified-figure note appears** — don't hide it:
> *"That's our own check catching the model. It flagged a number it couldn't trace
> to a source. Most products would have shown it to you confidently."*

---

# Prompt bank

**Chat**
- "How much should I put into my first stock?" ← the judge's-number moment
- "Is BEL too much of my portfolio?"
- "What does P/E mean and should I care?"
- "Remind me what I said I struggle with?" ← proves cross-thread memory

**Thesis**
- "My friend told me to buy HAL because defence spending is going up" ← Day 0
- "Everyone on Instagram is saying BEL will keep going up" ← Day 15
- "Defence spending is up, so HAL should benefit" ← Day 45
- "HAL's P/E is 35 against a sector median of 48 — is the order book enough?" ← Day 90

**Discovery** (no company named)
- "I want to invest long term in something safe and established"

---

# Timing

| Beat | Time |
|---|---|
| Reset + onboard | 60s |
| The judge's-number chat | 30s |
| Thesis investigation | ~20s to run, 40s to talk through |
| Day 90 + same question | 45s |
| What changed | 30s |
| **Total** | **~4 minutes**, leaving room for questions |

## Two things to avoid

- **Don't auto-submit the prefilled prompt.** Press send yourself — a human
  pressing the button is what proves it is live.
- **Don't say "live data".** Say "real data, refreshed on demand."
