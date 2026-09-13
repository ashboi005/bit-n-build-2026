/**
 * The Time Machine.
 *
 * Four snapshots of the same person at different points in their learning.
 * Seeding a stage rewrites that user's state so the next investigation or chat
 * genuinely behaves like day 0, 5, 15 or 25 — the pipeline itself is untouched.
 *
 * ⚠️ Personas define DECISIONS, not holdings. The portfolio is derived from
 * decisions everywhere else in the product, so if a persona listed holdings
 * separately the two could disagree — and a demo where the profile says "3
 * positions" while the portfolio says "you hold nothing" is worse than no demo.
 */

import type { DecisionAction, DemoStage, PastThesis, UserProfile } from "@bit-n-build-2026/contracts";

export interface PersonaDecision {
  ticker: string;
  companyName: string;
  action: DecisionAction;
  quantity: number | null;
  /**
   * What they paid, as an offset from the CURRENT price in the snapshot.
   * -0.08 means they bought 8% below today's price, so they are up 8%.
   *
   * Absolute prices were tried first and were a mistake: they drift out of date
   * the moment Tushar refreshes the data, and a hardcoded ₹980 for Tata Motors
   * (its pre-demerger price) against a real ₹302 showed the demo user a 40%
   * loss nobody intended. An offset keeps the story deterministic whatever the
   * real price is.
   */
  priceOffsetPct: number | null;
  thesis: string | null;
  reasoning: string | null;
  outcome: "held_up" | "broke" | "unresolved";
  outcomeNote: string | null;
  /** How long before "today" this happened. Dates are computed at seed time. */
  daysAgo: number;
}

export interface Persona {
  dayIndex: number;
  level: UserProfile["level"];
  knownConcepts: string[];
  pastTheses: PastThesis[];
  decisions: PersonaDecision[];
  /** Onboarding answers, so the AI knows who it is talking to from the start. */
  onboarding: {
    ageBand: string | null;
    primaryGoal: string | null;
    riskComfort: string | null;
    experience: string | null;
    monthlyBudget: number | null;
    horizon: string | null;
    notes: string | null;
  };
}

/**
 * ⚠️ NEVER put a biographical claim in `notes`.
 *
 * This once read "My father trades occasionally and I want to understand what he
 * does." Seeding writes it into the real `user_profile` row, so the assistant
 * then told a live tester about a father who does not exist and a budget they
 * never chose. Inventing facts about the user is the single worst failure this
 * product can have — it is the exact opposite of what we promise.
 *
 * Keep notes to a stated preference, or null.
 */
const ONBOARDING_BASE = {
  ageBand: "25-34",
  primaryGoal: "learn_first",
  riskComfort: "worry_hold",
  experience: "never",
  monthlyBudget: 10000,
  horizon: "over_5y",
  notes: null as string | null,
};

/**
 * Day 0 is a genuine blank slate: no onboarding answers at all.
 *
 * Anything non-null here gets asserted back at whoever is using the app, so a
 * "reset" that quietly installs opinions is worse than no reset. A real tester
 * who hits Day 0 should find the assistant knows nothing about them.
 */
const ONBOARDING_BLANK = {
  ageBand: null,
  primaryGoal: null,
  riskComfort: null,
  experience: null,
  monthlyBudget: null,
  horizon: null,
  notes: null,
};

export const DEMO_PERSONAS: Record<DemoStage, Persona> = {
  /** Knows nothing, holds nothing. Every explanation starts from scratch. */
  day0: {
    dayIndex: 0,
    level: "new",
    knownConcepts: [],
    pastTheses: [],
    decisions: [],
    onboarding: ONBOARDING_BLANK,
  },

  /** Has had P/E explained once, and made one cautious purchase. */
  day15: {
    dayIndex: 15,
    level: "learning",
    knownConcepts: ["pe"],
    pastTheses: [
      {
        id: "pt1",
        at: "day-11",
        query: "ITC is a big company so it must be safe",
        ticker: "ITC",
        outcome: "unresolved",
        lesson: "Size is not the same as safety — you wanted a reason, not a reputation.",
      },
    ],
    decisions: [
      {
        ticker: "ITC",
        companyName: "ITC Ltd",
        action: "bought",
        quantity: 20,
        priceOffsetPct: -0.08,
        thesis: "ITC is a big company so it must be safe",
        reasoning: "Everyone knows the brand and my father owns it too.",
        outcome: "unresolved",
        outcomeNote: null,
        daysAgo: 11,
      },
    ],
    onboarding: { ...ONBOARDING_BASE, experience: "tried_a_bit" },
  },

  /**
   * The important one. Holds three things, and has ONE thesis that broke —
   * which is what lets the AI say "this is the same reasoning that failed for
   * you before" at day 25.
   */
  day45: {
    dayIndex: 45,
    level: "practicing",
    knownConcepts: ["pe", "eps", "week52_range", "order_book"],
    pastTheses: [
      {
        id: "pt1",
        at: "day-41",
        query: "ITC is a big company so it must be safe",
        ticker: "ITC",
        outcome: "held_up",
        lesson: "Size is not the same as safety — you wanted a reason, not a reputation.",
      },
      {
        id: "pt2",
        at: "day-12",
        query: "Everyone is talking about this defence stock so it will keep rising",
        ticker: "BEL",
        outcome: "broke",
        lesson:
          "You bought on attention, not on a mechanism. The move had already happened before you heard about it.",
      },
    ],
    decisions: [
      {
        ticker: "ITC",
        companyName: "ITC Ltd",
        action: "bought",
        quantity: 20,
        priceOffsetPct: -0.08,
        thesis: "ITC is a big company so it must be safe",
        reasoning: "Everyone knows the brand and my father owns it too.",
        outcome: "held_up",
        outcomeNote: "Still holding. The reasoning was weak but the company was fine.",
        daysAgo: 41,
      },
      {
        ticker: "TATAMOTORS",
        companyName: "Tata Motors Ltd",
        action: "bought",
        quantity: 8,
        priceOffsetPct: 0.02,
        thesis: "Car sales are recovering",
        reasoning: "I checked quarterly results before buying this time.",
        outcome: "unresolved",
        outcomeNote: null,
        daysAgo: 28,
      },
      {
        ticker: "BEL",
        companyName: "Bharat Electronics Ltd",
        action: "bought",
        quantity: 15,
        priceOffsetPct: 0.12,
        thesis: "Everyone is talking about this defence stock so it will keep rising",
        reasoning: "I saw it on three different reels in one day.",
        outcome: "broke",
        outcomeNote:
          "Bought after the move had already happened. The budget news was months old by then.",
        daysAgo: 12,
      },
    ],
    onboarding: { ...ONBOARDING_BASE, experience: "tried_a_bit" },
  },

  /**
   * Increasingly self-reliant: four positions, and crucially a company they
   * investigated and deliberately DIDN'T buy, with their reasoning recorded.
   * That "skipped" decision is the product thesis in one row.
   */
  day90: {
    dayIndex: 90,
    level: "independent",
    knownConcepts: [
      "pe",
      "eps",
      "week52_range",
      "order_book",
      "priced_in",
      "debt_to_equity",
      "valuation",
    ],
    pastTheses: [
      {
        id: "pt1",
        at: "day-86",
        query: "ITC is a big company so it must be safe",
        ticker: "ITC",
        outcome: "held_up",
        lesson: "Size is not the same as safety — you wanted a reason, not a reputation.",
      },
      {
        id: "pt2",
        at: "day-57",
        query: "Everyone is talking about this defence stock so it will keep rising",
        ticker: "BEL",
        outcome: "broke",
        lesson:
          "You bought on attention, not on a mechanism. The move had already happened before you heard about it.",
      },
      {
        id: "pt3",
        at: "day-16",
        query: "Infosys looks cheap compared to its own history",
        ticker: "INFY",
        outcome: "held_up",
        lesson:
          "You compared valuation to peers and to its own past, and checked whether earnings justified it.",
      },
    ],
    decisions: [
      {
        ticker: "ITC",
        companyName: "ITC Ltd",
        action: "bought",
        quantity: 20,
        priceOffsetPct: -0.08,
        thesis: "ITC is a big company so it must be safe",
        reasoning: "Everyone knows the brand and my father owns it too.",
        outcome: "held_up",
        outcomeNote: "Still holding. The reasoning was weak but the company was fine.",
        daysAgo: 86,
      },
      {
        ticker: "TATAMOTORS",
        companyName: "Tata Motors Ltd",
        action: "bought",
        quantity: 8,
        priceOffsetPct: 0.02,
        thesis: "Car sales are recovering",
        reasoning: "I checked quarterly results before buying this time.",
        outcome: "unresolved",
        outcomeNote: null,
        daysAgo: 72,
      },
      {
        ticker: "BEL",
        companyName: "Bharat Electronics Ltd",
        action: "bought",
        quantity: 15,
        priceOffsetPct: 0.12,
        thesis: "Everyone is talking about this defence stock so it will keep rising",
        reasoning: "I saw it on three different reels in one day.",
        outcome: "broke",
        outcomeNote:
          "Bought after the move had already happened. The budget news was months old by then.",
        daysAgo: 57,
      },
      {
        ticker: "NESTLEIND",
        companyName: "Nestle India Ltd",
        action: "skipped",
        quantity: null,
        priceOffsetPct: null,
        thesis: "Nestle is a safe household name",
        reasoning:
          "Its P/E was far above the rest of the sector and I couldn't find a reason the earnings justified it.",
        outcome: "held_up",
        outcomeNote: "Chose not to buy after checking the valuation. First time I've done that.",
        daysAgo: 31,
      },
      {
        ticker: "INFY",
        companyName: "Infosys Ltd",
        action: "bought",
        quantity: 12,
        priceOffsetPct: -0.15,
        thesis: "Infosys looks cheap compared to its own history",
        reasoning:
          "Compared its P/E to TCS and Wipro and to its own past, then checked earnings were still growing.",
        outcome: "held_up",
        outcomeNote: null,
        daysAgo: 16,
      },
    ],
    onboarding: { ...ONBOARDING_BASE, experience: "invest_regularly", monthlyBudget: 15000 },
  },
};

/**
 * What this user would plausibly ask at each stage. The UI prefills it.
 *
 * ⚠️ These are QUESTIONS, not answers. The pipeline runs for real every time —
 * nothing here is a canned response. See docs/demo.md.
 */
export const DEMO_PROMPTS: Record<DemoStage, string> = {
  day0: "My friend told me to buy HAL because defence spending is going up",
  day15: "Everyone on Instagram is saying BEL will keep going up",
  day45: "Defence spending is up, so HAL should benefit",
  day90: "HAL's P/E is 35 against a sector median of 48 — is the order book enough to justify the gap?",
};
