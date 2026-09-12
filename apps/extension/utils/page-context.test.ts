import { describe, expect, test } from "bun:test";

import { buildDraft, sanitizeSelection } from "./page-context";

describe("page context", () => {
  test("builds a Groww draft from visible selected text without forwarding page data", () => {
    const result = buildDraft({
      hostname: "groww.in",
      selectedText: "HAL share price is moving after new defence orders",
      visibleText: "Hindustan Aeronautics Ltd (HAL) NSE: HAL",
      hiddenText: "account balance ₹12,00,000",
      url: "https://groww.in/stocks/hal?portfolio=private",
    });

    expect(result).toEqual({
      adapterId: "groww",
      draft: "Investigate HAL: HAL share price is moving after new defence orders",
      pageContext: "HAL share price is moving after new defence orders",
    });
    expect(JSON.stringify(result)).not.toContain("groww.in");
    expect(JSON.stringify(result)).not.toContain("12,00,000");
  });

  test("rejects empty, oversized, and hidden-field page input", () => {
    expect(sanitizeSelection("  ")).toBeNull();
    expect(sanitizeSelection("x".repeat(1_501))).toBeNull();
    expect(sanitizeSelection("Account balance: ₹12,00,000", { isHidden: true })).toBeNull();
  });

  test("does not turn URLs or portfolio/order data into a query", () => {
    expect(sanitizeSelection("See https://groww.in/stocks/hal")).toBeNull();
    expect(sanitizeSelection("My portfolio holding: 100 HAL shares")).toBeNull();
    expect(sanitizeSelection("Order status: filled at ₹4,000")).toBeNull();
  });

  test("uses a generic editable draft when no Groww adapter applies", () => {
    expect(
      buildDraft({
        hostname: "example.com",
        selectedText: "TCS margins may improve next quarter",
        visibleText: "unrelated visible headline",
      }),
    ).toEqual({
      adapterId: "generic",
      draft: "Investigate this claim: TCS margins may improve next quarter",
      pageContext: "TCS margins may improve next quarter",
    });
  });
});
