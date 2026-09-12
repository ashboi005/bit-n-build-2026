/**
 * Zod schemas for each LLM step.
 *
 * Every stage returns structured data, never prose. That's what lets us
 * enforce citations mechanically instead of trusting the model to behave.
 */

import { z } from "zod";

export const claimSchema = z.object({
  trigger: z
    .object({
      text: z.string().describe("The event the user believes happened"),
      kind: z.enum(["policy", "news", "earnings", "social", "price", "other"]),
    })
    .nullable(),
  asset: z
    .object({
      ticker: z.string().describe("NSE ticker symbol, uppercase"),
      name: z.string(),
    })
    .nullable(),
  mechanism: z
    .string()
    .nullable()
    .describe("The causal step the user assumes, e.g. 'more orders -> more revenue'"),
  horizon: z.enum(["intraday", "short", "long", "unspecified"]),
});

export type ClaimOutput = z.infer<typeof claimSchema>;

const findingSchema = z.object({
  text: z.string().describe("One sentence, plain English, no jargon"),
  stance: z.enum(["supports", "contradicts", "neutral", "unverified"]),
  strength: z.enum(["strong", "moderate", "weak"]),
  sourceIds: z
    .array(z.string())
    .describe("Ids of provided sources supporting this. Never empty, never invented."),
});

/**
 * No .max() here on purpose. A cap in the schema turns "returned one finding too
 * many" into "the whole stage silently vanished". The prompt asks for a limit and
 * the engine slices — a soft limit, not a validation failure.
 */
export const findingsSchema = z.object({
  findings: z.array(findingSchema),
});

export type FindingsOutput = z.infer<typeof findingsSchema>;

export const verdictSchema = z.object({
  holdsOn: z.array(z.string()).describe("Parts of the user's reasoning the evidence supports"),
  weakOn: z.array(z.string()).describe("Parts the evidence undermines"),
  unverified: z.array(z.string()).describe("Parts we could not check"),
  nextChecks: z.array(z.string()).describe("Specific questions the user should investigate next"),
});

export type VerdictOutput = z.infer<typeof verdictSchema>;

export const explanationSchema = z.object({
  explanation: z.string().describe("Explanation written at the user's level"),
});
