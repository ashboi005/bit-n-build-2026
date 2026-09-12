/**
 * Generalised intent — "I want to invest long term" with no company named.
 *
 * ⚠️ THIS IS NOT A RECOMMENDATION ENGINE.
 *
 * The product's second law is that we never rate or recommend an asset. So this
 * does not rank, score or suggest. It FILTERS our covered universe by the
 * characteristics the user described, shows what matched and why — each reason
 * cited to real data — and hands the decision back.
 *
 * The output is "here are companies whose numbers match what you said you
 * wanted; pick one and let's investigate it properly", not "buy these".
 */

import type { SourceRef } from "./thesis";

export interface DiscoveryIntent {
  raw: string;
  /** long term, income, learning, short term trade... */
  goal: string | null;
  horizon: "intraday" | "short" | "long" | "unspecified";
  /** Sectors they named, if any. */
  sectors: string[];
  /** Characteristics we can actually filter on. */
  wants: {
    lowDebt: boolean;
    lowVolatility: boolean;
    dividendIncome: boolean;
    largeEstablished: boolean;
    cheapValuation: boolean;
  };
}

export interface DiscoveryCandidate {
  ticker: string;
  name: string;
  sector: string;
  /** Two plain sentences about the business. */
  business: string;
  /**
   * Why it matched the stated characteristics. Each line is a fact with a
   * citation — never an opinion about whether it is a good investment.
   */
  matchedOn: { label: string; detail: string; sourceIds: string[] }[];
  /** What to be aware of. Always populated — nothing is presented as safe. */
  watchOut: { label: string; detail: string; sourceIds: string[] }[];
}

export type DiscoveryEvent =
  | { type: "discovery.started"; query: string }
  | { type: "discovery.intent"; intent: DiscoveryIntent }
  | { type: "discovery.source"; source: SourceRef }
  | { type: "discovery.candidate"; candidate: DiscoveryCandidate }
  | {
      type: "discovery.completed";
      /** How many of our covered companies we looked at. Honesty about scope. */
      universeSize: number;
      matched: number;
      /** Always shown: this is a filter over our coverage, not the whole market. */
      disclaimer: string;
      nextStep: string;
    }
  | { type: "discovery.failed"; message: string };

export const DISCOVERY_DISCLAIMER =
  "These are companies from the list we hold verified sources for — not the whole market, " +
  "and not a recommendation. They match the characteristics you described. Pick one and we'll " +
  "test your reasoning for it properly.";

export const DISCOVERY_NEXT_STEP =
  "Tell us which one interests you and why, and we'll investigate that reasoning.";
