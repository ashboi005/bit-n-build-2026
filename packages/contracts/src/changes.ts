/**
 * "What changed since you last looked."
 *
 * The one thing no friend, trainer or generic assistant can do: the user told us
 * WHY they acted, and we kept it. This revisits each decision against what has
 * happened since, and tests the specific reasoning they gave — not the stock.
 *
 * ⚠️ Every signal here is computed in CODE from figures and documents we hold,
 * each carrying its citations. The model is only allowed to phrase things, never
 * to decide what changed. And as everywhere else: this never says buy or sell.
 */

import type { SourceRef } from "./thesis";
import type { DecisionAction } from "./activity";

export type ChangeSeverity = "info" | "attention" | "warning";

export type ChangeSignalKind =
  | "price_move"
  | "new_filing"
  | "valuation_shift"
  | "concentration"
  | "thesis_untested";

export interface ChangeSignal {
  kind: ChangeSignalKind;
  severity: ChangeSeverity;
  /** Short label for the UI chip. */
  label: string;
  /** One plain sentence, with the actual numbers in it. */
  detail: string;
  sourceIds: string[];
}

/** How the user's original reasoning is holding up. Never a view on the asset. */
export type ThesisStatus = "holding" | "weakening" | "broken" | "too_early" | "unclear";

export interface ChangeItem {
  ticker: string;
  companyName: string;

  decision: {
    id: string;
    action: DecisionAction;
    /** Their own words for why. The thing being tested. */
    thesis: string | null;
    reasoning: string | null;
    decidedAt: string;
    daysAgo: number;
    quantity: number | null;
    pricePerShare: number | null;
  };

  /** Null when we have no reference price for the decision. */
  price: {
    then: number;
    now: number;
    changePct: number;
    direction: "up" | "down" | "flat";
  } | null;

  /** Only for positions they actually hold. */
  position: {
    quantity: number;
    investedValue: number;
    currentValue: number;
    profitLoss: number;
    profitLossPct: number;
    /** Share of their whole portfolio, 0-1. */
    weight: number;
  } | null;

  /** Documents published after they decided. This is the "what's new" part. */
  newDocuments: SourceRef[];

  signals: ChangeSignal[];

  thesisStatus: ThesisStatus;
  /** One sentence tying it together. Written at the user's level. */
  headline: string;
  /** Specific things to go and check. Teaches research, never concludes. */
  nextChecks: string[];
}

export interface ChangeReport {
  generatedAt: string;
  /** Sorted most-worth-your-attention first. */
  items: ChangeItem[];
  summary: {
    reviewed: number;
    needsAttention: number;
    /** Total unrealised P/L across held positions, when prices are available. */
    portfolioProfitLoss: number | null;
    portfolioProfitLossPct: number | null;
  };
  /** Shown on screen. This is a review of reasoning, not advice. */
  disclaimer: string;
}

export const CHANGES_DISCLAIMER =
  "This revisits the reasons you gave for each decision against what has happened since. " +
  "It is not advice to buy, sell or hold — it is a prompt to check whether your own " +
  "reasoning still holds.";

/** Thresholds, kept here so the UI can label consistently with the backend. */
export const PRICE_MOVE_ATTENTION = 0.07;
export const PRICE_MOVE_WARNING = 0.15;
/** Above this share of a portfolio, concentration is worth saying out loud. */
export const CONCENTRATION_WARNING = 0.35;
