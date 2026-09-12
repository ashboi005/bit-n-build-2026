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
  MERGE_MODEL_FAST: "google/gemini-3.5-flash",
  MERGE_MODEL_EMBED: "google/gemini-embedding-001",
} satisfies Omit<LlmConfig, "MERGE_API_KEY">;

/**
 * Verified present on the gateway (289 models available). Alternatives if we
 * need them: anthropic/claude-opus-5 for maximum reasoning quality at higher
 * latency, anthropic/claude-haiku-4-5-20251001 for speed.
 * google/gemini-embedding-001 is currently the only embedding model offered.
 */
