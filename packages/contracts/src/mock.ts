/**
 * Mock thesis runs, so the frontend can be built before the backend exists.
 *
 * ⚠️ EVERY NUMBER IN THIS FILE IS ILLUSTRATIVE PLACEHOLDER DATA.
 * It is shaped like real data so the UI can be built against it. It is NOT real
 * market data and must never reach a user. Real figures come from
 * packages/sources with real citations attached.
 *
 * Usage:
 *   import { mockThesisRun } from "@bit-n-build-2026/contracts/mock";
 *   for await (const event of mockThesisRun("hal_defense", "new")) { ... }
 */

import type {
  Concept,
  Finding,
  Level,
  Metric,
  ParsedClaim,
  SourceRef,
  StageId,
  ThesisEvent,
  Verdict,
} from "./thesis";
import { STAGE_LABELS, VERDICT_DISCLAIMER } from "./thesis";

export type MockScenario = "hal_defense" | "instagram_hype" | "ipo_gmp";

interface ScenarioData {
  query: string;
  claim: ParsedClaim;
  sources: SourceRef[];
  /** Stage -> findings emitted during that stage. */
  findings: Partial<Record<StageId, Finding[]>>;
  metrics: Metric[];
  concepts: Omit<Concept, "explanation" | "alreadyKnown">[];
  /** Explanation per level, keyed by concept key. */
  conceptByLevel: Record<string, Record<Level, string>>;
  verdict: Verdict;
}

/** Concepts a user at each level is assumed to already know. */
const KNOWN_BY_LEVEL: Record<Level, string[]> = {
  new: [],
  learning: ["pe_ratio"],
  practicing: ["pe_ratio", "eps", "week52_range"],
  independent: ["pe_ratio", "eps", "week52_range", "order_book", "priced_in", "debt_to_equity"],
};

const SCENARIOS: Record<MockScenario, ScenarioData> = {
  hal_defense: {
    query: "Government increased defense spending, so I want to buy HAL",
    claim: {
      raw: "Government increased defense spending, so I want to buy HAL",
      trigger: { text: "Government increased defense spending", kind: "policy" },
      asset: { ticker: "HAL", name: "Hindustan Aeronautics Ltd" },
      mechanism: "More defense budget → more orders for HAL → higher revenue",
      horizon: "unspecified",
    },
    sources: [
      {
        id: "s1",
        title: "Union Budget 2026-27: Defence allocation raised",
        publisher: "PIB",
        url: "https://www.pib.gov.in/",
        tier: "official",
        publishedAt: "2026-02-01",
        snippet:
          "The allocation to the Ministry of Defence has been increased over the previous financial year, with a higher share directed to capital acquisition.",
      },
      {
        id: "s2",
        title: "HAL Q2 FY26 Investor Presentation",
        publisher: "Hindustan Aeronautics Ltd",
        url: null,
        tier: "filing",
        publishedAt: "2026-07-28",
        snippet:
          "Order book stood at a multi-year high, with the majority of orders originating from domestic defence programmes.",
      },
      {
        id: "s3",
        title: "HAL — market data snapshot",
        publisher: "BSE",
        url: "https://www.bseindia.com/",
        tier: "market_data",
        publishedAt: "2026-09-11",
        snippet: "Last traded price, 52-week range and valuation ratios as of close.",
      },
      {
        id: "s4",
        title: "Defence stocks: how much of the budget story is already in the price?",
        publisher: "Business Standard",
        url: "https://www.business-standard.com/",
        tier: "press",
        publishedAt: "2026-08-14",
        snippet:
          "Analysts note that defence counters have already re-rated sharply, and that budget expectations were largely anticipated by the market.",
      },
      {
        id: "s5",
        title: "Defence sector valuation comparison",
        publisher: "Screener",
        url: null,
        tier: "market_data",
        publishedAt: "2026-09-11",
        snippet: "Sector median price-to-earnings ratio across listed defence manufacturers.",
      },
    ],
    findings: {
      verify_trigger: [
        {
          id: "f1",
          stage: "verify_trigger",
          text: "Yes — the defence allocation was raised in the latest Union Budget, with more going to capital acquisition.",
          stance: "supports",
          strength: "strong",
          sourceIds: ["s1"],
        },
      ],
      link_exposure: [
        {
          id: "f2",
          stage: "link_exposure",
          text: "HAL is directly exposed — most of its order book comes from domestic defence programmes.",
          stance: "supports",
          strength: "strong",
          sourceIds: ["s2"],
        },
        {
          id: "f3",
          stage: "link_exposure",
          text: "But a bigger budget is not the same as bigger orders for one company — allocation has to convert into contracts, and other manufacturers compete for the same spend.",
          stance: "neutral",
          strength: "moderate",
          sourceIds: ["s1", "s2"],
        },
      ],
      challenge: [
        {
          id: "f4",
          stage: "challenge",
          text: "The budget increase is public information. Defence stocks have already re-rated, so much of this may be reflected in the price.",
          stance: "contradicts",
          strength: "strong",
          sourceIds: ["s4"],
        },
        {
          id: "f5",
          stage: "challenge",
          text: "HAL trades well above the defence sector's median valuation, which leaves less room for the good news to surprise.",
          stance: "contradicts",
          strength: "moderate",
          sourceIds: ["s3", "s5"],
        },
      ],
    },
    metrics: [
      {
        key: "pe",
        label: "P/E ratio",
        value: 28.4,
        display: "28.4",
        unit: null,
        sectorMedian: 19.2,
        direction: "high",
        explanation: "Higher than most other defence companies.",
        sourceIds: ["s3", "s5"],
      },
      {
        key: "eps",
        label: "EPS",
        value: 62.5,
        display: "₹62.50",
        unit: "INR",
        sectorMedian: null,
        direction: "normal",
        explanation: "Profit earned per share over the last twelve months.",
        sourceIds: ["s3"],
      },
      {
        key: "week52_range",
        label: "52-week range",
        value: null,
        display: "₹1,420 – ₹2,310",
        unit: "INR",
        sectorMedian: null,
        direction: "high",
        explanation: "Currently trading closer to the high end of the past year.",
        sourceIds: ["s3"],
      },
      {
        key: "debt_to_equity",
        label: "Debt to equity",
        value: 0.12,
        display: "0.12",
        unit: null,
        sectorMedian: 0.35,
        direction: "low",
        explanation: "Carries very little debt compared to peers.",
        sourceIds: ["s3"],
      },
    ],
    concepts: [
      { key: "pe_ratio", term: "P/E ratio", oneLiner: "What you pay for each ₹1 the company earns." },
      { key: "order_book", term: "Order book", oneLiner: "Work the company has already won but not yet delivered." },
      { key: "priced_in", term: "Priced in", oneLiner: "News everyone already knows is usually already reflected in the price." },
    ],
    conceptByLevel: {
      pe_ratio: {
        new: "P/E means price-to-earnings. At a P/E of 28.4, investors are paying ₹28.40 for every ₹1 the company earns in a year. A high number can mean people expect strong growth — or that the stock is simply expensive.",
        learning: "HAL's P/E of 28.4 sits well above the defence sector median of 19.2. That premium has to be justified by faster growth than its peers.",
        practicing: "P/E 28.4 vs sector median 19.2 — a 48% premium. The question is whether order book conversion supports it.",
        independent: "P/E 28.4 vs 19.2 sector median.",
      },
      order_book: {
        new: "An order book is the work a company has already won but hasn't delivered yet. A big order book means revenue is fairly predictable for a while — it's one of the most useful numbers for a manufacturer.",
        learning: "HAL's order book is at a multi-year high and is mostly domestic defence, which is what connects the budget news to the company.",
        practicing: "Order book is at a multi-year high — check the execution timeline, not just the headline value.",
        independent: "Order book at multi-year high, domestic defence weighted.",
      },
      priced_in: {
        new: "'Priced in' means the market already knows something, so the price has already moved. If a budget increase was announced months ago and everyone read it, buying today doesn't get you the surprise — you're paying the price that already includes the good news.",
        learning: "The budget increase was public months ago and defence stocks re-rated then. Ask what would be *new* information from here.",
        practicing: "Budget increase is largely priced in — the edge would have to come from execution beating expectations.",
        independent: "Budget increase largely priced in.",
      },
    },
    verdict: {
      holdsOn: [
        "The defence allocation really did increase",
        "HAL is genuinely exposed to that spending",
        "The company carries very little debt",
      ],
      weakOn: [
        "Valuation is already well above the sector median",
        "The budget news is public and likely reflected in the price",
      ],
      unverified: ["Whether the allocation converts into new orders specifically for HAL"],
      nextChecks: [
        "How fast is the order book actually converting into revenue?",
        "How do competing defence manufacturers' valuations compare?",
        "What share of the new allocation is for programmes HAL actually bids on?",
      ],
      disclaimer: VERDICT_DISCLAIMER,
    },
  },

  instagram_hype: {
    query: "Everyone on Instagram is saying this stock will explode",
    claim: {
      raw: "Everyone on Instagram is saying this stock will explode",
      trigger: { text: "Social media buzz", kind: "social" },
      asset: { ticker: "RELIANCE", name: "Reliance Industries Ltd" },
      mechanism: "Lots of people talking about it → price goes up",
      horizon: "short",
    },
    sources: [
      {
        id: "h1",
        title: "Social media posts referencing the stock",
        publisher: "Social media",
        url: null,
        tier: "social",
        publishedAt: "2026-09-10",
        snippet: "Multiple short-form videos claiming a large imminent move, with no stated source.",
      },
      {
        id: "h2",
        title: "Latest quarterly results",
        publisher: "Reliance Industries Ltd",
        url: null,
        tier: "filing",
        publishedAt: "2026-07-18",
        snippet: "Revenue and profit figures for the quarter, filed with the exchanges.",
      },
      {
        id: "h3",
        title: "Corporate announcements — last 60 days",
        publisher: "NSE",
        url: "https://www.nseindia.com/",
        tier: "official",
        publishedAt: "2026-09-11",
        snippet: "No announcement in the period corresponds to the claim being circulated.",
      },
      {
        id: "h4",
        title: "Market data snapshot",
        publisher: "BSE",
        url: "https://www.bseindia.com/",
        tier: "market_data",
        publishedAt: "2026-09-11",
        snippet: "Price, valuation ratios and 52-week range as of close.",
      },
    ],
    findings: {
      verify_trigger: [
        {
          id: "hf1",
          stage: "verify_trigger",
          text: "We could not verify the claim. No exchange filing or official announcement in the last 60 days corresponds to it.",
          stance: "unverified",
          strength: "strong",
          sourceIds: ["h3"],
        },
        {
          id: "hf2",
          stage: "verify_trigger",
          text: "The only source for this claim is social media posts that cite no source themselves.",
          stance: "contradicts",
          strength: "strong",
          sourceIds: ["h1"],
        },
      ],
      link_exposure: [
        {
          id: "hf3",
          stage: "link_exposure",
          text: "There is no stated mechanism here — 'people are talking about it' is not a reason the business will earn more.",
          stance: "contradicts",
          strength: "strong",
          sourceIds: ["h1"],
        },
      ],
      challenge: [
        {
          id: "hf4",
          stage: "challenge",
          text: "By the time a claim is circulating widely on social media, anyone acting on it is usually buying from the people who bought earlier.",
          stance: "contradicts",
          strength: "moderate",
          sourceIds: ["h1"],
        },
        {
          id: "hf5",
          stage: "challenge",
          text: "The company's actual results are public and unremarkable relative to the claim being made.",
          stance: "contradicts",
          strength: "moderate",
          sourceIds: ["h2"],
        },
      ],
    },
    metrics: [
      {
        key: "pe",
        label: "P/E ratio",
        value: 24.1,
        display: "24.1",
        unit: null,
        sectorMedian: 21.5,
        direction: "normal",
        explanation: "Roughly in line with similar companies.",
        sourceIds: ["h4"],
      },
      {
        key: "week52_range",
        label: "52-week range",
        value: null,
        display: "₹1,180 – ₹1,608",
        unit: "INR",
        sectorMedian: null,
        direction: "normal",
        explanation: "Trading in the middle of its range for the past year.",
        sourceIds: ["h4"],
      },
    ],
    concepts: [
      { key: "source_tier", term: "Source quality", oneLiner: "Where a claim comes from changes how much weight it deserves." },
      { key: "priced_in", term: "Priced in", oneLiner: "News everyone already knows is usually already reflected in the price." },
    ],
    conceptByLevel: {
      source_tier: {
        new: "Not all information is equal. A company's own filing with the exchange is a legal document. A video telling you a stock will explode is someone's opinion, and often someone who benefits if you buy. When the only source is the second kind, that's the finding.",
        learning: "The claim has no official or filed source behind it — only social posts. That alone is enough to set it aside.",
        practicing: "No filing or announcement corresponds to this claim. Social-only sourcing.",
        independent: "Unsourced social claim, no corresponding filing.",
      },
      priced_in: {
        new: "'Priced in' means the market already knows something, so the price has already moved. If a claim has been circulating for days, you're not early — you're late.",
        learning: "Widely circulating claims are rarely an edge; by then the move has usually happened.",
        practicing: "Late-stage social circulation — the move, if any, has likely already occurred.",
        independent: "Late social circulation.",
      },
    },
    verdict: {
      holdsOn: [],
      weakOn: [
        "The claim has no official or filed source",
        "No mechanism connects the buzz to the company earning more",
        "Widely circulated claims are rarely an early opportunity",
      ],
      unverified: ["The claim itself — we found nothing that corresponds to it"],
      nextChecks: [
        "What specific event is being claimed, and is there a filing for it?",
        "Who benefits if you buy?",
        "What would the company have to actually do for this to be true?",
      ],
      disclaimer: VERDICT_DISCLAIMER,
    },
  },

  ipo_gmp: {
    query: "This IPO has a high GMP so it should list well",
    claim: {
      raw: "This IPO has a high GMP so it should list well",
      trigger: { text: "High grey market premium", kind: "price" },
      asset: { ticker: "NEWCO", name: "Newco Industries Ltd" },
      mechanism: "High grey market premium → strong listing gain",
      horizon: "intraday",
    },
    sources: [
      {
        id: "g1",
        title: "Red Herring Prospectus",
        publisher: "SEBI",
        url: "https://www.sebi.gov.in/",
        tier: "official",
        publishedAt: "2026-08-20",
        snippet:
          "Issue details, use of proceeds, risk factors and the share of the issue that is an offer for sale by existing shareholders.",
      },
      {
        id: "g2",
        title: "Grey market premium quotes",
        publisher: "Unofficial dealers",
        url: null,
        tier: "social",
        publishedAt: "2026-09-10",
        snippet: "Indicative unofficial premium quoted ahead of listing. Not a regulated market.",
      },
      {
        id: "g3",
        title: "Financial statements in the offer document",
        publisher: "Newco Industries Ltd",
        url: null,
        tier: "filing",
        publishedAt: "2026-08-20",
        snippet: "Three years of audited revenue and profit figures as filed in the offer document.",
      },
    ],
    findings: {
      verify_trigger: [
        {
          id: "gf1",
          stage: "verify_trigger",
          text: "A grey market premium exists, but it is an unofficial, unregulated quote — not a price from any exchange.",
          stance: "neutral",
          strength: "moderate",
          sourceIds: ["g2"],
        },
      ],
      link_exposure: [
        {
          id: "gf2",
          stage: "link_exposure",
          text: "GMP reflects short-term demand for the allotment, not the company's ability to earn. It says nothing about the business.",
          stance: "contradicts",
          strength: "strong",
          sourceIds: ["g2", "g1"],
        },
      ],
      challenge: [
        {
          id: "gf3",
          stage: "challenge",
          text: "Grey market premiums are quoted by unregulated dealers and can move sharply in the days before listing.",
          stance: "contradicts",
          strength: "strong",
          sourceIds: ["g2"],
        },
        {
          id: "gf4",
          stage: "challenge",
          text: "A large part of this issue is an offer for sale — money going to existing shareholders rather than into the business.",
          stance: "contradicts",
          strength: "moderate",
          sourceIds: ["g1"],
        },
      ],
    },
    metrics: [
      {
        key: "issue_size",
        label: "Issue size",
        value: null,
        display: "₹1,250 Cr",
        unit: "INR",
        sectorMedian: null,
        direction: "unknown",
        explanation: "Total amount the company is raising in this issue.",
        sourceIds: ["g1"],
      },
      {
        key: "ofs_share",
        label: "Offer for sale share",
        value: 62,
        display: "62%",
        unit: "%",
        sectorMedian: null,
        direction: "high",
        explanation: "Most of the money goes to existing shareholders, not into the company.",
        sourceIds: ["g1"],
      },
    ],
    concepts: [
      { key: "gmp", term: "GMP (grey market premium)", oneLiner: "An unofficial, unregulated price quoted before listing." },
      { key: "ofs", term: "Offer for sale", oneLiner: "Shares sold by existing owners — that money doesn't reach the company." },
    ],
    conceptByLevel: {
      gmp: {
        new: "GMP is the grey market premium — an unofficial price some dealers quote before a share is listed. It is not an exchange price, nobody regulates it, and it can change a lot in a few days. It tells you about demand for the allotment, not about whether the company is any good.",
        learning: "GMP measures short-term allotment demand, not business quality, and it is unregulated.",
        practicing: "GMP is an unregulated demand signal, not a valuation input.",
        independent: "GMP: unregulated demand signal.",
      },
      ofs: {
        new: "In an offer for sale, existing owners are selling their own shares. That money goes to them, not into the company. If most of an issue is offer for sale, the company itself isn't getting much to grow with — worth knowing before you buy.",
        learning: "62% of this issue is an offer for sale, so most proceeds go to existing shareholders rather than the business.",
        practicing: "OFS share is 62% — limited primary capital reaching the company.",
        independent: "OFS 62%.",
      },
    },
    verdict: {
      holdsOn: ["A grey market premium does currently exist"],
      weakOn: [
        "GMP is unofficial, unregulated and can move sharply before listing",
        "It reflects allotment demand, not the company's ability to earn",
        "Most of this issue goes to existing shareholders, not into the business",
      ],
      unverified: ["Whether the listing will actually open above the issue price"],
      nextChecks: [
        "What does the company actually do, and is it profitable?",
        "What are the risk factors in the offer document?",
        "What is the issue's valuation compared to already-listed peers?",
      ],
      disclaimer: VERDICT_DISCLAIMER,
    },
  },
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Which stages emit which parts, in order. */
const STAGE_PLAN: StageId[] = [
  "parse",
  "gather",
  "verify_trigger",
  "link_exposure",
  "fundamentals",
  "challenge",
  "learn",
  "verdict",
];

/**
 * Replay a full investigation as an async stream of events, with realistic pacing.
 *
 * The shape and ordering match exactly what apps/server will emit, so switching
 * from this to the real endpoint is a one-line change in the frontend.
 */
export async function* mockThesisRun(
  scenario: MockScenario = "hal_defense",
  level: Level = "new",
  opts: { speed?: number } = {},
): AsyncGenerator<ThesisEvent> {
  const speed = opts.speed ?? 1;
  const wait = (ms: number) => sleep(ms / speed);

  const data = SCENARIOS[scenario];
  const runId = `mock_${scenario}_${Date.now()}`;
  const startedAt = Date.now();
  const known = KNOWN_BY_LEVEL[level];

  yield {
    type: "run.started",
    runId,
    query: data.query,
    level,
    at: new Date().toISOString(),
  };
  await wait(250);

  for (const stage of STAGE_PLAN) {
    yield { type: "stage.started", stage, label: STAGE_LABELS[stage] };
    await wait(300);

    switch (stage) {
      case "parse":
        yield { type: "claim.parsed", claim: data.claim };
        await wait(400);
        break;

      case "gather":
        // Sources land one at a time — this is the visual beat on screen.
        for (const source of data.sources) {
          yield { type: "source.found", source };
          await wait(220);
        }
        break;

      case "fundamentals":
        yield { type: "metrics.ready", metrics: data.metrics };
        await wait(400);
        break;

      case "learn":
        for (const concept of data.concepts) {
          const alreadyKnown = known.includes(concept.key);
          const byLevel = data.conceptByLevel[concept.key];
          yield {
            type: "concept.taught",
            concept: {
              ...concept,
              explanation: byLevel ? byLevel[level] : concept.oneLiner,
              alreadyKnown,
            },
          };
          await wait(260);
        }
        break;

      case "verdict":
        yield { type: "verdict.ready", verdict: data.verdict };
        await wait(400);
        break;

      default:
        break;
    }

    // Findings for this stage, plus the source stances they imply.
    for (const finding of data.findings[stage] ?? []) {
      yield { type: "finding.added", finding };
      await wait(340);
      for (const sourceId of finding.sourceIds) {
        yield { type: "source.checked", sourceId, stance: finding.stance };
      }
      await wait(120);
    }

    yield { type: "stage.completed", stage };
    await wait(180);
  }

  yield { type: "run.completed", runId, durationMs: Date.now() - startedAt };
}

/** Collect a whole mock run into an array — handy for tests or static previews. */
export async function collectMockRun(
  scenario: MockScenario = "hal_defense",
  level: Level = "new",
): Promise<ThesisEvent[]> {
  const events: ThesisEvent[] = [];
  for await (const event of mockThesisRun(scenario, level, { speed: 1000 })) {
    events.push(event);
  }
  return events;
}

/** Pick a scenario from free text, so the demo input can route to the right mock. */
export function pickScenario(query: string): MockScenario {
  const q = query.toLowerCase();
  if (q.includes("instagram") || q.includes("everyone") || q.includes("explode")) {
    return "instagram_hype";
  }
  if (q.includes("ipo") || q.includes("gmp") || q.includes("listing")) return "ipo_gmp";
  return "hal_defense";
}

export const MOCK_EXAMPLE_QUERIES: { scenario: MockScenario; text: string }[] = [
  { scenario: "hal_defense", text: "Defense spending is up, so HAL should benefit" },
  { scenario: "instagram_hype", text: "Everyone on Instagram is saying this stock will explode" },
  { scenario: "ipo_gmp", text: "This IPO has a high GMP so it should list well" },
];
