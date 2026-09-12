import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StockRecord } from "@bit-n-build-2026/contracts";

import { loadSnapshot } from "./snapshot";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { force: true, recursive: true });
});

function makeDataDir() {
  const root = mkdtempSync(join(tmpdir(), "layered-sources-"));
  tempDirs.push(root);
  for (const layer of ["library", "snapshot", "cache"]) {
    mkdirSync(join(root, layer, "stocks"), { recursive: true });
    mkdirSync(join(root, layer, "documents"), { recursive: true });
  }
  return root;
}

function writeJson(path: string, data: unknown) {
  writeFileSync(path, JSON.stringify(data));
}

function stock(metrics: Array<{ key: string; sourceIds: string[] }>, priceSourceId = "library-price"): StockRecord {
  return {
    ticker: "ACME",
    bseCode: "123",
    isin: "INE000A01001",
    name: "Acme Industries Ltd",
    sector: "Industry",
    business: "Acme makes industrial components. It sells them to manufacturers.",
    price: {
      last: 100,
      change: 1,
      changePct: 1,
      dayHigh: 101,
      dayLow: 99,
      week52High: 120,
      week52Low: 80,
      asOf: "2026-09-12T10:00:00.000Z",
      sourceId: priceSourceId,
    },
    metrics: metrics.map((metric) => ({
      ...metric,
      label: metric.key,
      value: 1,
      display: "1",
      unit: null,
      sectorMedian: null,
      direction: "normal",
      explanation: "",
    })),
    history: [],
    sectorMedians: {},
    risk: [],
    documentIds: [],
    newsIds: [],
  };
}

function document(id: string) {
  return {
    id,
    title: id,
    publisher: "BSE",
    tier: "market_data",
    url: `https://example.test/${id}`,
    pdfUrl: null,
    publishedAt: "2026-09-12T10:00:00.000Z",
    tickers: ["ACME"],
    sectors: ["Industry"],
    text: id,
    chunks: [{ id: `${id}-chunk`, text: id }],
  };
}

function glossaryEntry(key: string, oneLiner: string) {
  return {
    key,
    term: key,
    oneLiner,
    byLevel: { new: key, learning: key, practicing: key, independent: key },
    related: [],
  };
}

describe("loadSnapshot", () => {
  test("loads the committed primary library by default", () => {
    expect(loadSnapshot().libraryDocuments.has("pib_budget_defence")).toBe(true);
  });

  test("keeps library values, fills missing metrics from the saved snapshot, and uses only fresh citable cache entries", () => {
    const root = makeDataDir();
    writeJson(join(root, "library", "stocks", "ACME.json"), stock([{ key: "pe", sourceIds: ["library-price"] }]));
    writeJson(join(root, "library", "documents", "library-price.json"), document("library-price"));
    writeJson(join(root, "snapshot", "stocks", "ACME.json"), stock([{ key: "eps", sourceIds: ["snapshot-eps"] }]));
    writeJson(join(root, "snapshot", "documents", "snapshot-eps.json"), document("snapshot-eps"));
    writeJson(join(root, "cache", "stocks", "ACME.json"), {
      fetchedAt: "2026-09-12T08:00:00.000Z",
      stock: stock([{ key: "roe", sourceIds: ["cached-roe"] }], "cached-roe"),
      documents: [document("cached-roe")],
    });
    writeJson(join(root, "cache", "documents", "stale.json"), {
      fetchedAt: "2026-09-12T01:00:00.000Z",
      document: document("stale"),
    });

    const snapshot = loadSnapshot({
      cacheDir: join(root, "cache"),
      libraryDir: join(root, "library"),
      now: new Date("2026-09-12T10:00:00.000Z"),
      snapshotDir: join(root, "snapshot"),
    });

    const record = snapshot.stocks.get("ACME");
    expect(record?.price.sourceId).toBe("library-price");
    expect(record?.metrics.map((metric) => metric.key)).toEqual(["pe", "eps", "roe"]);
    expect(snapshot.documents.has("library-price")).toBe(true);
    expect(snapshot.documents.has("snapshot-eps")).toBe(true);
    expect(snapshot.documents.has("cached-roe")).toBe(true);
    expect(snapshot.documents.has("stale")).toBe(false);
  });

  test("replaces a null library metric with a cited saved fallback value", () => {
    const root = makeDataDir();
    const libraryStock = stock([{ key: "pe", sourceIds: ["library-price"] }]);
    const libraryMetric = libraryStock.metrics[0] as { value: number | null; display: string };
    libraryMetric.value = null;
    libraryMetric.display = "—";
    writeJson(join(root, "library", "stocks", "ACME.json"), libraryStock);
    writeJson(join(root, "library", "documents", "library-price.json"), document("library-price"));
    writeJson(join(root, "snapshot", "stocks", "ACME.json"), stock([{ key: "pe", sourceIds: ["snapshot-pe"] }]));
    writeJson(join(root, "snapshot", "documents", "snapshot-pe.json"), document("snapshot-pe"));

    const snapshot = loadSnapshot({
      libraryDir: join(root, "library"),
      snapshotDir: join(root, "snapshot"),
    });

    expect(snapshot.stocks.get("ACME")?.metrics[0]).toMatchObject({ value: 1, sourceIds: ["snapshot-pe"] });
  });

  test("uses saved price history when the curated library record has none", () => {
    const root = makeDataDir();
    const libraryStock = stock([{ key: "pe", sourceIds: ["library-price"] }]);
    const savedStock = stock([{ key: "pe", sourceIds: ["snapshot-price"] }], "snapshot-price");
    savedStock.history = [{ date: "2026-09-11", close: 1258 }];

    writeJson(join(root, "library", "stocks", "ACME.json"), libraryStock);
    writeJson(join(root, "library", "documents", "library-price.json"), document("library-price"));
    writeJson(join(root, "snapshot", "stocks", "ACME.json"), savedStock);
    writeJson(join(root, "snapshot", "documents", "snapshot-price.json"), document("snapshot-price"));

    const snapshot = loadSnapshot({
      libraryDir: join(root, "library"),
      snapshotDir: join(root, "snapshot"),
    });

    expect(snapshot.stocks.get("ACME")?.history).toEqual([{ date: "2026-09-11", close: 1258 }]);
  });

  test("keeps a null library metric when a same-id fallback source conflicts", () => {
    const root = makeDataDir();
    const libraryStock = stock([{ key: "pe", sourceIds: ["shared-pe"] }]);
    const libraryMetric = libraryStock.metrics[0] as { value: number | null; display: string };
    libraryMetric.value = null;
    libraryMetric.display = "—";
    writeJson(join(root, "library", "stocks", "ACME.json"), libraryStock);
    writeJson(join(root, "library", "documents", "shared-pe.json"), document("shared-pe"));
    writeJson(join(root, "snapshot", "stocks", "ACME.json"), stock([{ key: "pe", sourceIds: ["shared-pe"] }]));
    const conflictingDocument = document("shared-pe");
    conflictingDocument.text = "newer but conflicting metric evidence";
    conflictingDocument.chunks = [{ id: "shared-pe-chunk", text: conflictingDocument.text }];
    writeJson(join(root, "snapshot", "documents", "shared-pe.json"), conflictingDocument);

    const snapshot = loadSnapshot({
      libraryDir: join(root, "library"),
      snapshotDir: join(root, "snapshot"),
    });

    expect(snapshot.stocks.get("ACME")?.metrics[0]).toMatchObject({ value: null, sourceIds: ["shared-pe"] });
  });

  test("does not append a fallback metric whose citation is shadowed by conflicting library evidence", () => {
    const root = makeDataDir();
    writeJson(join(root, "library", "stocks", "ACME.json"), stock([{ key: "pe", sourceIds: ["library-price"] }]));
    writeJson(join(root, "library", "documents", "library-price.json"), document("library-price"));
    writeJson(join(root, "library", "documents", "shared-eps.json"), document("shared-eps"));
    writeJson(join(root, "snapshot", "stocks", "ACME.json"), stock([{ key: "eps", sourceIds: ["shared-eps"] }]));
    const conflictingDocument = document("shared-eps");
    conflictingDocument.text = "different fallback source content";
    conflictingDocument.chunks = [{ id: "shared-eps-chunk", text: conflictingDocument.text }];
    writeJson(join(root, "snapshot", "documents", "shared-eps.json"), conflictingDocument);

    const snapshot = loadSnapshot({
      libraryDir: join(root, "library"),
      snapshotDir: join(root, "snapshot"),
    });

    expect(snapshot.stocks.get("ACME")?.metrics.map((metric) => metric.key)).toEqual(["pe"]);
  });

  test("ignores cache entries without citable source documents", () => {
    const root = makeDataDir();
    writeJson(join(root, "cache", "stocks", "ACME.json"), {
      fetchedAt: "2026-09-12T08:00:00.000Z",
      stock: stock([{ key: "roe", sourceIds: ["missing-source"] }], "missing-source"),
      documents: [],
    });

    const snapshot = loadSnapshot({
      cacheDir: join(root, "cache"),
      libraryDir: join(root, "library"),
      now: new Date("2026-09-12T10:00:00.000Z"),
      snapshotDir: join(root, "snapshot"),
    });

    expect(snapshot.stocks.has("ACME")).toBe(false);
  });

  test("uses a fresh cached stock when its cited documents are present", () => {
    const root = makeDataDir();
    writeJson(join(root, "cache", "stocks", "ACME.json"), {
      fetchedAt: "2026-09-12T08:00:00.000Z",
      stock: stock([{ key: "roe", sourceIds: ["cached-roe"] }], "cached-roe"),
      documents: [document("cached-roe")],
    });

    const snapshot = loadSnapshot({
      cacheDir: join(root, "cache"),
      libraryDir: join(root, "library"),
      now: new Date("2026-09-12T10:00:00.000Z"),
      snapshotDir: join(root, "snapshot"),
    });

    expect(snapshot.stocks.get("ACME")?.metrics.map((metric) => metric.key)).toEqual(["roe"]);
  });

  test("ignores a cached stock when its price citation is absent", () => {
    const root = makeDataDir();
    writeJson(join(root, "cache", "stocks", "ACME.json"), {
      fetchedAt: "2026-09-12T08:00:00.000Z",
      stock: stock([], "missing-price-source"),
      documents: [],
    });

    const snapshot = loadSnapshot({
      cacheDir: join(root, "cache"),
      libraryDir: join(root, "library"),
      now: new Date("2026-09-12T10:00:00.000Z"),
      snapshotDir: join(root, "snapshot"),
    });

    expect(snapshot.stocks.has("ACME")).toBe(false);
  });

  test("ignores malformed cache records instead of crashing", () => {
    const root = makeDataDir();
    writeJson(join(root, "cache", "stocks", "ACME.json"), {
      fetchedAt: "2026-09-12T08:00:00.000Z",
      stock: { ticker: "ACME", metrics: [], risk: null },
      documents: [],
    });

    expect(() => loadSnapshot({
      cacheDir: join(root, "cache"),
      libraryDir: join(root, "library"),
      now: new Date("2026-09-12T10:00:00.000Z"),
      snapshotDir: join(root, "snapshot"),
    })).not.toThrow();
  });

  test("ignores cached metrics with no source citation", () => {
    const root = makeDataDir();
    writeJson(join(root, "cache", "stocks", "ACME.json"), {
      fetchedAt: "2026-09-12T08:00:00.000Z",
      stock: stock([{ key: "roe", sourceIds: [] }], "cached-roe"),
      documents: [document("cached-roe")],
    });

    const snapshot = loadSnapshot({
      cacheDir: join(root, "cache"),
      libraryDir: join(root, "library"),
      now: new Date("2026-09-12T10:00:00.000Z"),
      snapshotDir: join(root, "snapshot"),
    });

    expect(snapshot.stocks.has("ACME")).toBe(false);
  });

  test("ignores cached metrics with blank source IDs", () => {
    const root = makeDataDir();
    writeJson(join(root, "cache", "stocks", "ACME.json"), {
      fetchedAt: "2026-09-12T08:00:00.000Z",
      stock: stock([{ key: "roe", sourceIds: [""] }], "cached-roe"),
      documents: [document("cached-roe")],
    });

    const snapshot = loadSnapshot({
      cacheDir: join(root, "cache"),
      libraryDir: join(root, "library"),
      now: new Date("2026-09-12T10:00:00.000Z"),
      snapshotDir: join(root, "snapshot"),
    });

    expect(snapshot.stocks.has("ACME")).toBe(false);
  });

  test("ignores cached records with an invalid price as-of timestamp", () => {
    const root = makeDataDir();
    const cachedStock = stock([{ key: "roe", sourceIds: ["cached-roe"] }], "cached-roe");
    cachedStock.price.asOf = "not-a-date";
    writeJson(join(root, "cache", "stocks", "ACME.json"), {
      fetchedAt: "2026-09-12T08:00:00.000Z",
      stock: cachedStock,
      documents: [document("cached-roe")],
    });

    const snapshot = loadSnapshot({
      cacheDir: join(root, "cache"),
      libraryDir: join(root, "library"),
      now: new Date("2026-09-12T10:00:00.000Z"),
      snapshotDir: join(root, "snapshot"),
    });

    expect(snapshot.stocks.has("ACME")).toBe(false);
  });

  test("rejects a new cached stock whose source is shadowed by conflicting library evidence", () => {
    const root = makeDataDir();
    writeJson(join(root, "library", "documents", "shared-price.json"), document("shared-price"));
    const cacheDocument = document("shared-price");
    cacheDocument.text = "different cached source content";
    cacheDocument.chunks = [{ id: "shared-price-chunk", text: cacheDocument.text }];
    writeJson(join(root, "cache", "stocks", "ACME.json"), {
      fetchedAt: "2026-09-12T08:00:00.000Z",
      stock: stock([], "shared-price"),
      documents: [cacheDocument],
    });

    const snapshot = loadSnapshot({
      cacheDir: join(root, "cache"),
      libraryDir: join(root, "library"),
      now: new Date("2026-09-12T10:00:00.000Z"),
      snapshotDir: join(root, "snapshot"),
    });

    expect(snapshot.stocks.has("ACME")).toBe(false);
  });

  test("rejects cached evidence without a source URL and timestamp", () => {
    const root = makeDataDir();
    const cacheDocument = document("cached-roe");
    const mutableCacheDocument = cacheDocument as { url: string | null; publishedAt: string | null };
    mutableCacheDocument.url = null;
    mutableCacheDocument.publishedAt = null;
    writeJson(join(root, "cache", "stocks", "ACME.json"), {
      fetchedAt: "2026-09-12T08:00:00.000Z",
      stock: stock([{ key: "roe", sourceIds: ["cached-roe"] }], "cached-roe"),
      documents: [cacheDocument],
    });

    const snapshot = loadSnapshot({
      cacheDir: join(root, "cache"),
      libraryDir: join(root, "library"),
      now: new Date("2026-09-12T10:00:00.000Z"),
      snapshotDir: join(root, "snapshot"),
    });

    expect(snapshot.stocks.has("ACME")).toBe(false);
  });

  test("rejects a later cached stock when its source ID conflicts with an earlier cache entry", () => {
    const root = makeDataDir();
    const firstDocument = document("shared-cache-source");
    const firstStock = stock([], "shared-cache-source");
    const secondDocument = document("shared-cache-source");
    secondDocument.text = "conflicting second cache source";
    secondDocument.chunks = [{ id: "shared-cache-source-chunk", text: secondDocument.text }];
    const secondStock = stock([], "shared-cache-source");
    secondStock.ticker = "BETA";
    secondStock.name = "Beta Industries Ltd";

    writeJson(join(root, "cache", "stocks", "ACME.json"), {
      fetchedAt: "2026-09-12T08:00:00.000Z",
      stock: firstStock,
      documents: [firstDocument],
    });
    writeJson(join(root, "cache", "stocks", "BETA.json"), {
      fetchedAt: "2026-09-12T08:00:00.000Z",
      stock: secondStock,
      documents: [secondDocument],
    });

    const snapshot = loadSnapshot({
      cacheDir: join(root, "cache"),
      libraryDir: join(root, "library"),
      now: new Date("2026-09-12T10:00:00.000Z"),
      snapshotDir: join(root, "snapshot"),
    });

    expect(snapshot.stocks.has("ACME")).toBe(true);
    expect(snapshot.stocks.has("BETA")).toBe(false);
  });

  test("ignores malformed cached documents before they can reach source search", () => {
    const root = makeDataDir();
    writeJson(join(root, "cache", "documents", "bad.json"), {
      fetchedAt: "2026-09-12T08:00:00.000Z",
      document: { id: "bad" },
    });

    const snapshot = loadSnapshot({
      cacheDir: join(root, "cache"),
      libraryDir: join(root, "library"),
      now: new Date("2026-09-12T10:00:00.000Z"),
      snapshotDir: join(root, "snapshot"),
    });

    expect(snapshot.documents.has("bad")).toBe(false);
  });

  test("ignores malformed saved stock records before callers can resolve them", () => {
    const root = makeDataDir();
    writeJson(join(root, "library", "stocks", "bad.json"), { ticker: "BROKEN", metrics: [] });

    const snapshot = loadSnapshot({
      libraryDir: join(root, "library"),
      snapshotDir: join(root, "snapshot"),
    });

    expect(snapshot.stocks.has("BROKEN")).toBe(false);
  });

  test("keeps a primary library glossary entry over the saved fallback entry", () => {
    const root = makeDataDir();
    writeJson(join(root, "library", "glossary.json"), [glossaryEntry("pe", "Library definition")]);
    writeJson(join(root, "snapshot", "glossary.json"), [glossaryEntry("pe", "Snapshot definition")]);

    const snapshot = loadSnapshot({
      libraryDir: join(root, "library"),
      snapshotDir: join(root, "snapshot"),
    });

    expect(snapshot.glossary.get("pe")?.oneLiner).toBe("Library definition");
  });
});
