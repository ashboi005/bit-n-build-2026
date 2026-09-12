"use client";

import { useCallback, useRef, useState } from "react";
import { initialThesisState, reduceThesis, type ThesisState, type SourceRef, type DiscoveryCandidate, type DiscoveryEvent, type DiscoveryIntent } from "@bit-n-build-2026/contracts";
import { mockThesisRun, pickScenario } from "@bit-n-build-2026/contracts/mock";
import { streamThesis } from "@/lib/thesis-client";

const USE_MOCK = false;
const MIN_STAGE_MS = 450;

export interface DiscoveryState {
  status: "idle" | "running" | "done" | "failed";
  intent: DiscoveryIntent | null;
  sources: Record<string, SourceRef>;
  candidates: DiscoveryCandidate[];
  summary: { universeSize: number; matched: number; disclaimer: string; nextStep: string } | null;
  error: string | null;
}

export function initialDiscoveryState(): DiscoveryState {
  return {
    status: "idle",
    intent: null,
    sources: {},
    candidates: [],
    summary: null,
    error: null,
  };
}

export function reduceDiscovery(state: DiscoveryState, event: DiscoveryEvent): DiscoveryState {
  switch (event.type) {
    case "discovery.started":
      return { ...state, status: "running" };
    case "discovery.intent":
      return { ...state, intent: event.intent };
    case "discovery.source":
      return {
        ...state,
        sources: { ...state.sources, [event.source.id]: event.source },
      };
    case "discovery.candidate":
      return { ...state, candidates: [...state.candidates, event.candidate] };
    case "discovery.completed":
      return {
        ...state,
        status: "done",
        summary: {
          universeSize: event.universeSize,
          matched: event.matched,
          disclaimer: event.disclaimer,
          nextStep: event.nextStep,
        },
      };
    case "discovery.failed":
      return { ...state, status: "failed", error: event.message };
    default:
      return state;
  }
}

export function useThesisRun() {
  const [thesisState, setThesisState] = useState<ThesisState>(initialThesisState);
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState | null>(null);
  const [mode, setMode] = useState<"thesis" | "discovery">("thesis");
  
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (query: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    
    setMode("thesis");
    setThesisState({ ...initialThesisState(), status: "running" });
    setDiscoveryState(null);

    const source = USE_MOCK
      ? mockThesisRun(pickScenario(query), "new")
      : streamThesis(query, ac.signal);

    let last = Date.now();
    try {
      // We expect event to be ThesisEvent | DiscoveryEvent.
      // mockThesisRun only returns ThesisEvent, but streamThesis returns both.
      for await (const event of source as any) {
        const elapsed = Date.now() - last;
        if (elapsed < MIN_STAGE_MS) {
          await new Promise((r) => setTimeout(r, MIN_STAGE_MS - elapsed));
        }
        last = Date.now();

        if (event.type.startsWith("discovery.")) {
          setMode("discovery");
          setDiscoveryState((s) => reduceDiscovery(s || initialDiscoveryState(), event as DiscoveryEvent));
        } else {
          setThesisState((s) => reduceThesis(s, event as any));
          if (event.type === "run.needs_discovery") {
            setMode("discovery");
            setDiscoveryState(initialDiscoveryState());
          }
        }
      }
    } catch (err) {
      if (!ac.signal.aborted) {
        setThesisState((s) => ({ ...s, status: "failed" }));
      }
    }
  }, []);

  return { 
    ...thesisState, 
    discoveryState,
    mode,
    run 
  };
}
