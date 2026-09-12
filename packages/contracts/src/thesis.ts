/**
 * The thesis investigation contract.
 *
 * This is the single source of truth shared by the frontend (apps/web),
 * the server (apps/server) and the agent workflow (packages/agents).
 * If you change anything here, tell the other two owners.
 */

/** The ordered stages of an investigation. The UI renders them in this order. */
export const STAGE_IDS = [
  "parse",
  "gather",
  "verify_trigger",
  "link_exposure",
  "fundamentals",
  "challenge",
  "learn",
  "verdict",
] as const;

export type StageId = (typeof STAGE_IDS)[number];

/** Human-readable stage titles. The server sends these too, but the UI can fall back here. */
export const STAGE_LABELS: Record<StageId, string> = {
  parse: "Your claim",
  gather: "Sources checked",
  verify_trigger: "Is the trigger real?",
  link_exposure: "Does it reach this company?",
  fundamentals: "The numbers",
  challenge: "What could prove you wrong",
  learn: "What you just learned",
  verdict: "Where you stand",
};

/**
 * Where a piece of evidence came from. Drives the badge on screen.
 * `social` is ingested so we can argue against it — never as supporting evidence.
 */
export type SourceTier = "official" | "filing" | "press" | "market_data" | "social";

/** How a source or finding relates to the user's claim. */
export type Stance = "supports" | "contradicts" | "neutral" | "unverified";

/** How much the user already knows. Drives explanation depth. */
export type Level = "new" | "learning" | "practicing" | "independent";

export interface SourceRef {
  id: string;
  title: string;
  publisher: string;
  url: string | null;
  tier: SourceTier;
  /** ISO date string. */
  publishedAt: string | null;
  /** The actual line we quoted. Shown on the source card. */
  snippet: string;
}

export type TriggerKind = "policy" | "news" | "earnings" | "social" | "price" | "other";

export type Horizon = "intraday" | "short" | "long" | "unspecified";

export interface ParsedClaim {
  raw: string;
  trigger: { text: string; kind: TriggerKind } | null;
  asset: { ticker: string; name: string } | null;
  /** The causal step the user is assuming, e.g. "more orders -> more revenue". */
  mechanism: string | null;
  horizon: Horizon;
}

export interface Finding {
  id: string;
  stage: StageId;
  /** One sentence, plain English. */
  text: string;
  stance: Stance;
  strength: "strong" | "moderate" | "weak";
  /**
   * NEVER empty. The server drops any finding with no sources before it is sent.
   * This is how "no unsourced claim reaches the screen" is enforced.
   */
  sourceIds: string[];
}

export interface Metric {
  key: string;
  label: string;
  value: number | null;
  /** Pre-formatted for display, e.g. "28.4" or "₹1,70,171 Cr". */
  display: string;
  unit: string | null;
  sectorMedian: number | null;
  direction: "high" | "low" | "normal" | "unknown";
  /** Already written at the user's level. The UI does not adjust this. */
  explanation: string;
  sourceIds: string[];
}

export interface Concept {
  key: string;
  term: string;
  oneLiner: string;
  /** Level-adjusted by the server. */
  explanation: string;
  /** True => render as a subtle "you already know this" chip instead of a full card. */
  alreadyKnown: boolean;
}

export interface Verdict {
  holdsOn: string[];
  weakOn: string[];
  unverified: string[];
  nextChecks: string[];
  disclaimer: string;
}

/** The standard disclaimer. Permanent UI, not a footer. */
export const VERDICT_DISCLAIMER =
  "This is not a recommendation to buy or sell. It is an assessment of your reasoning.";

export type ThesisEvent =
  | { type: "run.started"; runId: string; query: string; level: Level; at: string }
  | { type: "claim.parsed"; claim: ParsedClaim }
  | { type: "stage.started"; stage: StageId; label: string }
  | { type: "source.found"; source: SourceRef }
  | { type: "source.checked"; sourceId: string; stance: Stance }
  | { type: "finding.added"; finding: Finding }
  | { type: "metrics.ready"; metrics: Metric[] }
  | { type: "concept.taught"; concept: Concept }
  | { type: "stage.completed"; stage: StageId }
  | { type: "stage.failed"; stage: StageId; message: string }
  | { type: "verdict.ready"; verdict: Verdict }
  | { type: "run.completed"; runId: string; durationMs: number }
  | { type: "run.failed"; message: string }
  /**
   * The user named no company ("I want to invest long term"). The stream
   * switches to discovery events from here. Additive: a client that ignores
   * this still behaves correctly, it just shows nothing further.
   */
  | { type: "run.needs_discovery"; query: string };

export type ThesisEventType = ThesisEvent["type"];

/** Request body for POST /api/thesis/stream. The user comes from the session cookie. */
export interface ThesisRequest {
  query: string;
}

/* ------------------------------------------------------------------ *
 * Reduced state — what the UI actually renders.
 * The event reducer lives in the frontend, but the shape lives here so
 * both sides agree on it.
 * ------------------------------------------------------------------ */

export type RunStatus = "idle" | "running" | "done" | "failed";
export type StageStatus = "pending" | "running" | "done" | "failed";

export interface StageState {
  status: StageStatus;
  label: string;
  findings: Finding[];
  message?: string;
}

export interface ThesisState {
  status: RunStatus;
  runId: string | null;
  query: string;
  level: Level;
  claim: ParsedClaim | null;
  stages: Record<StageId, StageState>;
  sources: Record<string, SourceRef & { stance?: Stance }>;
  metrics: Metric[];
  concepts: Concept[];
  verdict: Verdict | null;
  error: string | null;
}

export function initialThesisState(): ThesisState {
  const stages = {} as Record<StageId, StageState>;
  for (const id of STAGE_IDS) {
    stages[id] = { status: "pending", label: STAGE_LABELS[id], findings: [] };
  }
  return {
    status: "idle",
    runId: null,
    query: "",
    level: "new",
    claim: null,
    stages,
    sources: {},
    metrics: [],
    concepts: [],
    verdict: null,
    error: null,
  };
}

/**
 * Fold one event into the state. Pure — safe to call from a React setState updater.
 * This is the ONLY place that needs to know events exist.
 */
export function reduceThesis(state: ThesisState, event: ThesisEvent): ThesisState {
  switch (event.type) {
    case "run.started":
      return {
        ...initialThesisState(),
        status: "running",
        runId: event.runId,
        query: event.query,
        level: event.level,
      };

    case "claim.parsed":
      return { ...state, claim: event.claim };

    case "stage.started":
      return {
        ...state,
        stages: {
          ...state.stages,
          [event.stage]: { ...state.stages[event.stage], status: "running", label: event.label },
        },
      };

    case "source.found":
      return {
        ...state,
        sources: { ...state.sources, [event.source.id]: event.source },
      };

    case "source.checked": {
      const existing = state.sources[event.sourceId];
      if (!existing) return state;
      return {
        ...state,
        sources: { ...state.sources, [event.sourceId]: { ...existing, stance: event.stance } },
      };
    }

    case "finding.added": {
      const stage = state.stages[event.finding.stage];
      return {
        ...state,
        stages: {
          ...state.stages,
          [event.finding.stage]: { ...stage, findings: [...stage.findings, event.finding] },
        },
      };
    }

    case "metrics.ready":
      return { ...state, metrics: event.metrics };

    case "concept.taught":
      return { ...state, concepts: [...state.concepts, event.concept] };

    case "stage.completed":
      return {
        ...state,
        stages: {
          ...state.stages,
          [event.stage]: { ...state.stages[event.stage], status: "done" },
        },
      };

    case "stage.failed":
      return {
        ...state,
        stages: {
          ...state.stages,
          [event.stage]: {
            ...state.stages[event.stage],
            status: "failed",
            message: event.message,
          },
        },
      };

    case "verdict.ready":
      return { ...state, verdict: event.verdict };

    case "run.completed":
      return { ...state, status: "done" };

    case "run.failed":
      return { ...state, status: "failed", error: event.message };

    case "run.needs_discovery":
      // The stream continues with discovery events, which this reducer does not
      // own. Mark the run done so the UI stops showing stages as pending.
      return { ...state, status: "done" };
  }
}
