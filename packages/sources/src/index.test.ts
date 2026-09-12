import { describe, expect, test } from "bun:test";
import type { Snapshot } from "./snapshot";
import { createSources } from "./index";

function sourceDocument(id: string, text: string) {
  return {
    id,
    title: id,
    publisher: "PIB",
    tier: "official" as const,
    url: `https://example.test/${id}`,
    pdfUrl: null,
    publishedAt: "2026-09-12T10:00:00.000Z",
    tickers: ["ACME"],
    sectors: ["Industry"],
    text,
    chunks: [{ id: `${id}-chunk`, text }],
  };
}

describe("createSources", () => {
  test("returns library evidence before a more keyword-dense saved fallback document", async () => {
    const library = sourceDocument("library-budget", "budget increased");
    const fallback = sourceDocument("snapshot-budget", "budget allocation increased");
    const snapshot = {
      stocks: new Map(),
      documents: new Map([
        [library.id, library],
        [fallback.id, fallback],
      ]),
      glossary: new Map(),
      libraryDocuments: new Map([[library.id, library]]),
    } as Snapshot;

    const hits = createSources(snapshot).searchSources("budget allocation", { tickers: ["ACME"] });

    expect(hits.map((hit) => hit.docId)).toEqual(["library-budget", "snapshot-budget"]);
  });
});
