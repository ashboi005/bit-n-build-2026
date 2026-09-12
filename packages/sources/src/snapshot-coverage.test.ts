import { describe, expect, test } from "bun:test";

import { loadSnapshot } from "./snapshot";

const COVERED_TICKERS = [
  "HAL", "BEL", "BDL", "RELIANCE", "TCS", "INFY", "TATAMOTORS", "ITC", "NTPC", "POWERGRID",
  "ONGC", "TATAPOWER", "HDFCBANK", "ICICIBANK", "ETERNAL", "IDEA", "ATHER", "SUZLON", "TRENT", "IREDA",
];

describe("committed 20-stock fallback", () => {
  test("contains every approved stock with citable market data", () => {
    const snapshot = loadSnapshot();

    expect([...snapshot.stocks.keys()].sort()).toEqual([...COVERED_TICKERS].sort());

    for (const ticker of COVERED_TICKERS) {
      const stock = snapshot.stocks.get(ticker);
      expect(stock?.price.sourceId).toBeTruthy();
      expect(snapshot.documents.has(stock!.price.sourceId)).toBe(true);
      expect(snapshot.documents.get(stock!.price.sourceId)?.text).toContain(`LTP ₹${stock!.price.last}`);
      expect(stock?.metrics.length).toBeGreaterThan(0);
      for (const metric of stock!.metrics) {
        expect(metric.sourceIds.length).toBeGreaterThan(0);
        for (const sourceId of metric.sourceIds) expect(snapshot.documents.has(sourceId)).toBe(true);
      }
      const latestHistory = stock!.history.at(-1);
      if (latestHistory) {
        expect(latestHistory.close / stock!.price.last).toBeGreaterThan(0.75);
        expect(latestHistory.close / stock!.price.last).toBeLessThan(1.25);
      }
    }
  });

  test("keeps chart history for every covered stock", () => {
    const snapshot = loadSnapshot();

    for (const ticker of COVERED_TICKERS) {
      expect(snapshot.stocks.get(ticker)?.history.length).toBeGreaterThan(0);
    }
  });
});
