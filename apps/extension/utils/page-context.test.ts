import { describe, expect, test } from "bun:test";

import {
  buildDraft,
  buildGrowwQuery,
  companyFromGrowwUrl,
  sanitizeSelection,
} from "./page-context";

describe("page context", () => {
  test("derives a company name from a Groww stock URL without retaining its query or fragment", () => {
    expect(companyFromGrowwUrl(
      "https://groww.in/stocks/hindustan-aeronautics-ltd?tab=performance#financials",
    )).toBe("Hindustan Aeronautics Ltd");
    expect(companyFromGrowwUrl("https://groww.in/stocks/tata%2Dconsultancy%2Dservices-ltd")).toBe(
      "Tata Consultancy Services Ltd",
    );
  });

  test("rejects malformed, non-Groww, and non-stock URLs", () => {
    expect(companyFromGrowwUrl("https://groww.in/mutual-funds/hdfc")).toBeNull();
    expect(companyFromGrowwUrl("https://example.com/stocks/hindustan-aeronautics-ltd")).toBeNull();
    expect(companyFromGrowwUrl("https://groww.in/stocks/%E0%A4%A")).toBeNull();
  });

  test("builds a reviewed pipeline query from company context without forwarding the page URL", () => {
    const query = buildGrowwQuery("Hindustan Aeronautics Ltd", "Tell me about this page");

    expect(query).toBe("Regarding Hindustan Aeronautics Ltd: Tell me about this page");
    expect(query).not.toContain("groww.in");
  });

  test("requires both company context and a question before analysis", () => {
    expect(buildGrowwQuery("Hindustan Aeronautics Ltd", " ")).toBeNull();
    expect(buildGrowwQuery(null, "Tell me about this page")).toBeNull();
  });

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
