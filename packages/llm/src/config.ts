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
   * Merge's docs show both `gateway.merge.dev/v1` and `api-gateway.merge.dev/v1`.
   * Keep it configurable and confirm against your dashboard — if auth works but
   * every call 404s, this is the first thing to check.
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
  MERGE_BASE_URL: "https://gateway.merge.dev/v1",
  MERGE_MODEL_SMART: "anthropic/claude-opus-4-6",
  MERGE_MODEL_FAST: "google/gemini-2.5-flash",
  MERGE_MODEL_EMBED: "openai/text-embedding-3-small",
} satisfies Omit<LlmConfig, "MERGE_API_KEY">;

/**
 * ⚠️ Model ids are gateway-specific and change. Run `listModels()` once at the
 * start of the build and pin whatever it actually returns. Do not trust these
 * defaults blindly — an unknown model id fails at call time, not at startup.
 */
