/**
 * The Time Machine.
 *
 * Four snapshots of the same user at different points in their learning. Hitting
 * a button reseeds the profile, and re-running the same thesis produces visibly
 * different output — which is how personalisation becomes something a judge can
 * see in four seconds instead of something we claim.
 */

import type { DemoStage, UserProfile } from "@bit-n-build-2026/contracts";

/**
 * What this user would plausibly ask at each stage. The UI prefills it.
 *
 * ⚠️ These are questions, not answers. The pipeline runs for real every time —
 * nothing here is a canned response. See docs/demo.md.
 */
export const DEMO_PROMPTS: Record<DemoStage, string> = {
  day0: "Government increased defense spending, so I want to buy HAL",
  day5: "Everyone on Instagram is saying this stock will explode",
  day15: "Defence spending is up, so HAL should benefit",
  day25: "HAL's P/E looks high against the sector — is the order book enough to justify it?",
};

export const DEMO_PERSONAS: Record<DemoStage, UserProfile> = {
  day0: {
    level: "new",
    knownConcepts: [],
    holdings: [],
    pastTheses: [],
    startedAt: "2026-09-12",
    dayIndex: 0,
  },

  day5: {
    level: "learning",
    knownConcepts: ["pe"],
    holdings: [
      { ticker: "ITC", name: "ITC Ltd", quantity: 20, avgPrice: 412, weight: 1 },
    ],
    pastTheses: [
      {
        id: "pt1",
        at: "2026-09-14",
        query: "ITC is a big company so it must be safe",
        ticker: "ITC",
        outcome: "unresolved",
        lesson: "Size is not the same as safety — you wanted a reason, not a reputation.",
      },
    ],
    startedAt: "2026-09-12",
    dayIndex: 5,
  },

  day15: {
    level: "practicing",
    knownConcepts: ["pe", "eps", "week52_range", "order_book"],
    holdings: [
      { ticker: "ITC", name: "ITC Ltd", quantity: 20, avgPrice: 412, weight: 0.42 },
      { ticker: "TATAMOTORS", name: "Tata Motors Ltd", quantity: 8, avgPrice: 980, weight: 0.38 },
      { ticker: "BEL", name: "Bharat Electronics Ltd", quantity: 15, avgPrice: 290, weight: 0.2 },
    ],
    pastTheses: [
      {
        id: "pt1",
        at: "2026-09-14",
        query: "ITC is a big company so it must be safe",
        ticker: "ITC",
        outcome: "held_up",
        lesson: "Size is not the same as safety — you wanted a reason, not a reputation.",
      },
      {
        id: "pt2",
        at: "2026-09-22",
        query: "Everyone is talking about this defence stock so it will keep rising",
        ticker: "BEL",
        outcome: "broke",
        lesson:
          "You bought on attention, not on a mechanism. The move had already happened before you heard about it.",
      },
    ],
    startedAt: "2026-09-12",
    dayIndex: 15,
  },

  day25: {
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
    holdings: [
      { ticker: "ITC", name: "ITC Ltd", quantity: 20, avgPrice: 412, weight: 0.28 },
      { ticker: "TATAMOTORS", name: "Tata Motors Ltd", quantity: 8, avgPrice: 980, weight: 0.26 },
      { ticker: "BEL", name: "Bharat Electronics Ltd", quantity: 15, avgPrice: 290, weight: 0.16 },
      { ticker: "INFY", name: "Infosys Ltd", quantity: 12, avgPrice: 1560, weight: 0.3 },
    ],
    pastTheses: [
      {
        id: "pt1",
        at: "2026-09-14",
        query: "ITC is a big company so it must be safe",
        ticker: "ITC",
        outcome: "held_up",
        lesson: "Size is not the same as safety — you wanted a reason, not a reputation.",
      },
      {
        id: "pt2",
        at: "2026-09-22",
        query: "Everyone is talking about this defence stock so it will keep rising",
        ticker: "BEL",
        outcome: "broke",
        lesson:
          "You bought on attention, not on a mechanism. The move had already happened before you heard about it.",
      },
      {
        id: "pt3",
        at: "2026-10-02",
        query: "Infosys looks cheap compared to its own history",
        ticker: "INFY",
        outcome: "held_up",
        lesson:
          "You compared valuation to peers and to its own past, and checked whether earnings justified it.",
      },
    ],
    startedAt: "2026-09-12",
    dayIndex: 25,
  },
};
