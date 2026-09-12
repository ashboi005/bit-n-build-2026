/**
 * Merge Gateway configuration.
 *
 * Merge Gateway (https://www.merge.dev/gateway) is an OpenAI-wire-compatible
 * LLM gateway: one API key reaches Anthropic, Google, OpenAI, Mistral and
 * others, plus embeddings. That means we swap models by changing a string,
 * which matters when a provider is slow or rate-limited an hour before judging.
 */

export type LlmConfig = {
  MERGE_API_KEY: string;
  /**
   * Base URL, including /v1.
   * Confirmed working: `api-gateway.merge.dev/v1`. The bare `gateway.merge.dev`
   * host returns 405 — it is the product page, not the API.
   */
  MERGE_BASE_URL: string;
  /** Model id for reasoning-heavy steps (claim parsing, challenge, verdict). */
  MERGE_MODEL_SMART: string;
  /** Model id for cheap, high-volume steps (rewriting an explanation to a level). */
  MERGE_MODEL_FAST: string;
  /** Embedding model id, for semantic search over source chunks. */
  MERGE_MODEL_EMBED: string;
};

export const DEFAULT_LLM_CONFIG = {
  MERGE_BASE_URL: "https://api-gateway.merge.dev/v1",
  MERGE_MODEL_SMART: "anthropic/claude-sonnet-5",
  MERGE_MODEL_FAST: "anthropic/claude-haiku-4-5-20251001",
  MERGE_MODEL_EMBED: "google/gemini-embedding-001",
} satisfies Omit<LlmConfig, "MERGE_API_KEY">;

/**
 * Verified by actually calling them (289 models are offered).
 *
 * ⚠️ Do not swap MERGE_MODEL_FAST for a gemini-*-flash model. They are reasoning
 * models on this gateway: they spend the token budget on an internal `thinking`
 * field and return truncated or null `content`, which silently produced garbage
 * one-line explanations. Measured at both 120 and 600 max_tokens.
 *
 * Also seen once: a request for google/gemini-3.5-flash was served by
 * deepseek-v4.1-flash. The gateway can route elsewhere, so always read the
 * `model` field in the response when debugging odd output.
 *
 * Alternatives: anthropic/claude-opus-5 for maximum reasoning quality at higher
 * latency. google/gemini-embedding-001 is the only embedding model offered.
 */
