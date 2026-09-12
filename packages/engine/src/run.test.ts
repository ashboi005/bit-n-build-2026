import { describe, expect, test } from "bun:test";

import { runThesis } from "./run";

describe("runThesis", () => {
  test("reports missing verified coverage when source retrieval is empty", async () => {
    const events = runThesis({
      llm: {
        structured: async () => ({
          trigger: null,
          asset: { ticker: "UNKNOWN", name: "Unknown Co" },
          mechanism: null,
          horizon: "unspecified",
        }),
      } as never,
      profile: {
        get: () => ({
          dayIndex: 0,
          holdings: [],
          knownConcepts: [],
          level: "new",
          pastTheses: [],
          startedAt: "2026-09-12T00:00:00.000Z",
        }),
        learnConcepts: () => undefined,
      },
      sources: {
        listStocks: () => [],
      getDocument: () => null,
        getGlossary: () => null,
        getStock: () => null,
        resolveTicker: () => null,
        searchSources: () => [],
      },
    }, { query: "Should I buy UNKNOWN?" });

    for await (const event of events) {
      if (event.type === "stage.failed" && event.stage === "gather") {
        expect(event.message).toBe("We don't have verified coverage for this company or claim yet.");
        return;
      }
    }

    throw new Error("Expected the gather stage to fail for missing coverage");
  });
});
