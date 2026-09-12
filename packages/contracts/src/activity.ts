/**
 * Onboarding, decisions and chat.
 *
 * These three feed the RAG context. The product's claim is that the AI knows
 * things a friend cannot — who you are, what you hold, and what you decided last
 * time. This file is where those become types.
 */

import type { Level, SourceRef } from "./thesis";

/* ------------------------------------------------------------------ *
 * Onboarding — the initial context the dynamic profile starts from
 * ------------------------------------------------------------------ */

export const AGE_BANDS = ["18-24", "25-34", "35-44", "45-54", "55+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const PRIMARY_GOALS = [
  "learn_first",
  "grow_savings",
  "regular_income",
  "specific_goal",
  "try_trading",
] as const;
export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];

export const RISK_COMFORTS = ["sell_immediately", "worry_hold", "hold_calmly", "buy_more"] as const;
export type RiskComfort = (typeof RISK_COMFORTS)[number];

export const EXPERIENCES = ["never", "tried_a_bit", "invest_regularly"] as const;
export type Experience = (typeof EXPERIENCES)[number];

export const HORIZONS = ["under_1y", "1_3y", "3_5y", "over_5y", "unsure"] as const;
export type OnboardingHorizon = (typeof HORIZONS)[number];

/** Human-readable labels. The UI renders these; the AI reads the keys. */
export const ONBOARDING_LABELS = {
  primaryGoal: {
    learn_first: "I mostly want to understand how this works before risking much",
    grow_savings: "Grow my savings over time",
    regular_income: "Earn regular income from dividends",
    specific_goal: "Save towards something specific",
    try_trading: "Try short-term trading",
  },
  riskComfort: {
    sell_immediately: "I'd want to sell straight away",
    worry_hold: "I'd worry a lot but probably hold",
    hold_calmly: "I'd hold and wait it out",
    buy_more: "I'd see it as a chance to buy more",
  },
  experience: {
    never: "I've never invested",
    tried_a_bit: "I've tried a bit",
    invest_regularly: "I invest regularly",
  },
  horizon: {
    under_1y: "Less than a year",
    "1_3y": "1 to 3 years",
    "3_5y": "3 to 5 years",
    over_5y: "More than 5 years",
    unsure: "Not sure yet",
  },
} as const;

export interface OnboardingAnswers {
  ageBand: AgeBand | null;
  primaryGoal: PrimaryGoal | null;
  riskComfort: RiskComfort | null;
  experience: Experience | null;
  /** Rough monthly amount in INR. */
  monthlyBudget: number | null;
  horizon: OnboardingHorizon | null;
  notes: string | null;
}

export interface OnboardingState extends OnboardingAnswers {
  complete: boolean;
  onboardedAt: string | null;
  /** Level we derived from their answers. They can outgrow it. */
  derivedLevel: Level;
}

/**
 * Starting level from experience alone.
 *
 * Deliberately conservative: over-explaining briefly is recoverable, and being
 * talked over on day one is what makes beginners give up. The profile moves them
 * up as concepts get taught.
 */
export function deriveLevel(answers: OnboardingAnswers): Level {
  if (answers.experience === "invest_regularly") return "practicing";
  if (answers.experience === "tried_a_bit") return "learning";
  return "new";
}

/* ------------------------------------------------------------------ *
 * Decisions — what the user actually did
 * ------------------------------------------------------------------ */

export const DECISION_ACTIONS = ["bought", "sold", "skipped", "watching"] as const;
export type DecisionAction = (typeof DECISION_ACTIONS)[number];

export const DECISION_OUTCOMES = ["held_up", "broke", "unresolved"] as const;
export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];

export interface Decision {
  id: string;
  ticker: string;
  companyName: string;
  action: DecisionAction;
  /** Null for skipped and watching. */
  quantity: number | null;
  pricePerShare: number | null;
  /** The thesis that led here, in the user's own words. */
  thesis: string | null;
  investigationSummary: string | null;
  /** Why they went ahead, or why they didn't. */
  reasoning: string | null;
  outcome: DecisionOutcome;
  outcomeNote: string | null;
  decidedAt: string;
}

export interface RecordDecisionRequest {
  ticker: string;
  action: DecisionAction;
  quantity?: number | null;
  pricePerShare?: number | null;
  thesis?: string | null;
  investigationSummary?: string | null;
  reasoning?: string | null;
}

/** Portfolio derived from decisions — we never ask the user to maintain it twice. */
export interface PortfolioPosition {
  ticker: string;
  companyName: string;
  quantity: number;
  avgPrice: number;
  investedValue: number;
  /** Current value, when we have a price for it. */
  currentValue: number | null;
  /** Share of total portfolio, 0-1. Lets the AI say "this is 40% of your money". */
  weight: number;
}

export interface Portfolio {
  positions: PortfolioPosition[];
  totalInvested: number;
  totalCurrent: number | null;
  /** Companies they investigated and deliberately did not buy. Also context. */
  skipped: { ticker: string; companyName: string; reasoning: string | null }[];
  watching: { ticker: string; companyName: string }[];
}

/* ------------------------------------------------------------------ *
 * Chat
 * ------------------------------------------------------------------ */

export interface ChatMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  sourceIds: string[];
  conceptKeys: string[];
  createdAt: string;
}

/**
 * A conversation, for listing and resuming.
 *
 * Without this the frontend has to hold the threadId in memory, so navigating
 * away or refreshing orphans the conversation — the messages are still in the
 * database but nothing can find them again.
 */
export interface ChatThread {
  threadId: string;
  /** First thing the user said, trimmed. Used as the thread's title. */
  title: string;
  /** Last message in the thread, for a preview line. */
  lastMessage: string;
  lastRole: "user" | "assistant";
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatRequest {
  message: string;
  /** Omit to start a new thread. */
  threadId?: string;
}

/** Chat streams too, so answers appear as they're written. */
export type ChatEvent =
  | { type: "chat.started"; threadId: string; messageId: string }
  | { type: "chat.context"; usedPortfolio: boolean; sources: SourceRef[] }
  | { type: "chat.delta"; text: string }
  | { type: "chat.sources"; sources: SourceRef[] }
  | { type: "chat.completed"; messageId: string; content: string }
  | { type: "chat.failed"; message: string };
