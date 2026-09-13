export const MAX_SELECTION_CHARS = 1_500;

export type PageContext = {
  hostname: string;
  selectedText: string;
  visibleText?: string;
  /** Never read or transmitted. Present only to make the boundary testable. */
  hiddenText?: string;
  /** Never read or transmitted. Present only to make the boundary testable. */
  url?: string;
};

export type Draft = {
  adapterId: "groww" | "generic";
  draft: string;
  /** Local-only context that helps the user review the draft. */
  pageContext: string;
};

/**
 * Derives only a human-readable company name from a Groww stock-page URL.
 * The original URL, query string, and fragment are deliberately discarded.
 */
export function companyFromGrowwUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "groww.in") return null;

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length !== 2 || segments[0] !== "stocks") return null;

    const slug = decodeURIComponent(segments[1] ?? "");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) return null;

    return slug
      .split("-")
      .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1).toLowerCase()}`)
      .join(" ");
  } catch {
    return null;
  }
}

/** Creates the single reviewed query sent to the existing thesis endpoint. */
export function buildGrowwQuery(companyName: string | null, question: string): string | null {
  const safeQuestion = sanitizeSelection(question);
  if (!companyName || !safeQuestion) return null;
  return `Regarding ${companyName}: ${safeQuestion}`;
}

export function sanitizeSelection(
  value: string,
  options: { isHidden?: boolean } = {},
): string | null {
  if (options.isHidden) return null;

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > MAX_SELECTION_CHARS) return null;
  if (/https?:\/\//i.test(normalized)) return null;
  if (/\b(portfolio|holding|account\s+balance|order\s+(?:status|id)|quantity)\b/i.test(normalized)) {
    return null;
  }
  return normalized;
}

function growwTicker(visibleText: string): string | null {
  const match = visibleText.match(/(?:NSE|BSE)\s*:\s*([A-Z][A-Z0-9&-]{1,14})\b/i);
  return match?.[1]?.toUpperCase() ?? null;
}

/**
 * Converts user-selected, visible text into a local draft. It intentionally
 * does not return a URL, HTML, hidden fields, screenshots, or page metadata.
 */
export function buildDraft(context: PageContext): Draft | null {
  const selectedText = sanitizeSelection(context.selectedText);
  if (!selectedText) return null;

  if (context.hostname.toLowerCase() === "groww.in") {
    const ticker = growwTicker(context.visibleText ?? "");
    if (ticker) {
      return {
        adapterId: "groww",
        draft: `Investigate ${ticker}: ${selectedText}`,
        pageContext: selectedText,
      };
    }
  }

  return {
    adapterId: "generic",
    draft: `Investigate this claim: ${selectedText}`,
    pageContext: selectedText,
  };
}
