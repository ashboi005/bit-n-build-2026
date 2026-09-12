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

export const DEMO_STAGES = ["day0", "day5", "day15", "day25"] as const;
export type DemoStage = (typeof DEMO_STAGES)[number];

export const DEMO_STAGE_LABELS: Record<DemoStage, string> = {
  day0: "Day 0",
  day5: "Day 5",
  day15: "Day 15",
  day25: "Day 25",
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
