/**
 * User profile and the Time Machine demo control.
 *
 * The profile is what makes explanations adapt. The demo stages make that
 * adaptation visible on stage in four seconds.
 */

import type { Level } from "./thesis";

export interface Holding {
  ticker: string;
  name: string;
  quantity: number;
  avgPrice: number;
  /** Share of the user's total portfolio, 0-1. Lets the AI say "this is 40% of your portfolio". */
  weight: number;
}

export interface PastThesis {
  id: string;
  /** ISO date. */
  at: string;
  query: string;
  ticker: string | null;
  /** What the investigation concluded at the time. */
  outcome: "held_up" | "broke" | "unresolved";
  /** One line the AI can reference later: "you assumed X, but Y happened". */
  lesson: string;
}

export interface UserProfile {
  level: Level;
  /** Glossary keys the user has had explained. Drives Concept.alreadyKnown. */
  knownConcepts: string[];
  holdings: Holding[];
  pastTheses: PastThesis[];
  /** ISO date the user started. Powers "Day N". */
  startedAt: string;
  /** Days since start. Denormalised so the UI can render the Time Machine label. */
  dayIndex: number;
}

/**
 * Demo stages.
 *
 * Widened from 0/5/15/25. Five days is not enough time to have learned four
 * concepts or for an investment thesis to have visibly broken, so the story
 * strained credibility exactly where it needed to be believable. 15 / 45 / 90
 * spans a realistic learning arc, and the gaps are big enough that the change
 * in the AI's tone reads as growth rather than noise.
 *
 * day0 is not a seed — it is a full account reset. See /api/demo/reset.
 */
export const DEMO_STAGES = ["day0", "day15", "day45", "day90"] as const;
export type DemoStage = (typeof DEMO_STAGES)[number];

export const DEMO_STAGE_LABELS: Record<DemoStage, string> = {
  day0: "Reset",
  day15: "Day 15",
  day45: "Day 45",
  day90: "Day 90",
};

/** POST /api/demo/seed */
export interface DemoSeedRequest {
  stage: DemoStage;
}

export interface DemoSeedResponse {
  stage: DemoStage;
  profile: UserProfile;
  /**
   * A thesis worth typing at this stage, for the UI to prefill.
   *
   * ⚠️ This is a PROMPT, not a scripted answer. Seeding sets up the user's state
   * and suggests what to ask — the investigation that follows always runs live
   * through the real pipeline. See docs/demo.md.
   */
  suggestedPrompt: string;
}
