"use client";

import { useCallback, useRef, useState } from "react";
import { initialThesisState, reduceThesis } from "@bit-n-build-2026/contracts";
import { mockThesisRun, pickScenario } from "@bit-n-build-2026/contracts/mock";
import { streamThesis } from "@/lib/thesis-client";

const USE_MOCK = true;
const MIN_STAGE_MS = 450;

export function useThesisRun() {
  const [state, setState] = useState(initialThesisState);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (query: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setState({ ...initialThesisState(), status: "running" });

    const source = USE_MOCK
      ? mockThesisRun(pickScenario(query), "new")
      : streamThesis(query, ac.signal);

    let last = Date.now();
    try {
      for await (const event of source) {
        const elapsed = Date.now() - last;
        if (elapsed < MIN_STAGE_MS) {
          await new Promise((r) => setTimeout(r, MIN_STAGE_MS - elapsed));
        }
        last = Date.now();
        setState((s) => reduceThesis(s, event));
      }
    } catch (err) {
      if (!ac.signal.aborted) setState((s) => ({ ...s, status: "failed" }));
    }
  }, []);

  return { ...state, run };
}
