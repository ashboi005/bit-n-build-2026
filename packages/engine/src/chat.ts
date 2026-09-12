/**
 * General chat — "what does P/E mean", "how is my portfolio looking",
 * "should I be worried about my BEL position".
 *
 * Retrieval pulls from two places at once: public market sources, and the
 * user's OWN context (onboarding answers, decisions, past theses). That is what
 * lets one answer combine "the defence budget rose" with "you already hold 20%
 * BEL and told us you'd panic-sell in a drop".
 *
 * Same two laws as the investigation: cite everything, never recommend.
 */

import type {
  ChatEvent,
  ChatMessage,
  SourceRef,
} from "@bit-n-build-2026/contracts";
import { GROUND_RULES, auditCitations, checkNoRecommendation, type Llm } from "@bit-n-build-2026/llm";
import type { Retriever } from "@bit-n-build-2026/rag";

import { fullContextBlock, type UserContext } from "./context";
import type { SourcesPort } from "./ports";

const CHAT_SYSTEM = `${GROUND_RULES}

You are a research companion for a first-time investor in India. You are not a
broker, an advisor, or a hype channel.

How to answer:
- Plain English. One idea per sentence. No jargon without expanding it.
- Cite sources inline using the id exactly as given, in square brackets:
  [screener_bel], not [source_screener_bel]. Never add a prefix to an id, and
  never cite an id you were not given. If the sources don't answer the question,
  say so rather than filling the gap from memory.
- If the question is about THEIR situation, use what you know about them. Their
  portfolio, what they told you at signup, and what they decided before are all
  fair game and are the most useful thing you have.

CITING vs REMEMBERING — these are different things:
- Market facts (a price, a ratio, a filing, a government release) come from the
  SOURCES and must carry a source id.
- Things this user did or told you come from their own record. State those
  plainly with NO citation — "your history shows you bought BEL after seeing it
  on reels" needs no [id], and attaching one is wrong, because no market source
  says that. Citing a source for something it does not contain is the one thing
  that would make the whole product untrustworthy.

ABOUT THEIR HISTORY — be precise, this matters:
- Only refer to decisions and dates that actually appear in the context below.
  Never invent a past event, a month, or an outcome.
- A decision is only a MISTAKE if its recorded outcome says "broke". A decision
  with outcome "unresolved" is just something they did — describe it neutrally.
  Telling someone they repeated a mistake that never happened destroys the one
  thing that makes you useful, which is that you actually remember correctly.
- If their history genuinely shows the same reasoning failing before, say so
  plainly and early, and name the specific past decision.
- Never tell them to buy, sell or hold. If they ask "should I buy X", answer with
  what the evidence says and what they should check, then hand the decision back.
- Short answers are good. Two paragraphs is usually plenty.`;

export interface ChatDeps {
  llm: Llm;
  retriever: Retriever;
  sources: SourcesPort;
  /**
   * Model for chat. Prefer a NON-reasoning model here: reasoning models stream
   * a `thinking` field first and can exhaust the token budget before any
   * content appears, which shows up as a silently empty reply.
   */
  model?: string;
}

export interface ChatOptions {
  userId: string;
  threadId: string;
  messageId: string;
  message: string;
  context: UserContext;
  /** Prior turns, oldest first. Trimmed by the caller. */
  history: ChatMessage[];
  signal?: AbortSignal;
}

export async function* runChat(deps: ChatDeps, opts: ChatOptions): AsyncGenerator<ChatEvent> {
  const { llm, retriever, sources } = deps;

  yield { type: "chat.started", threadId: opts.threadId, messageId: opts.messageId };

  // Retrieve across public sources AND this user's own memories in one pass.
  let sourceRefs: SourceRef[] = [];
  let personalSnippets: string[] = [];

  try {
    const hits = await retriever.search(opts.message, {
      limit: 10,
      filter: { owner: opts.userId },
      minScore: 0.25,
    });

    const seen = new Set<string>();
    for (const hit of hits) {
      if (hit.payload.kind === "source") {
        if (seen.has(hit.payload.docId)) continue;
        seen.add(hit.payload.docId);
        const doc = sources.getDocument(hit.payload.docId);
        if (!doc) continue;
        sourceRefs.push({
          id: doc.id,
          title: doc.title,
          publisher: doc.publisher,
          url: doc.url,
          tier: doc.tier,
          publishedAt: doc.publishedAt,
          snippet: hit.payload.text.slice(0, 300),
        });
      } else {
        personalSnippets.push(hit.payload.text);
      }
    }
  } catch (error) {
    // Retrieval failing must not kill the conversation — we still have the
    // user's context, which is most of the value for personal questions.
    console.warn("[chat] retrieval failed:", error instanceof Error ? error.message : error);
  }

  sourceRefs = sourceRefs.slice(0, 6);
  personalSnippets = personalSnippets.slice(0, 4);

  yield {
    type: "chat.context",
    usedPortfolio: opts.context.portfolio.positions.length > 0,
    sources: sourceRefs,
  };

  const sourcesBlock = sourceRefs.length
    ? [
        "SOURCES — cite these inline as [id]. Do not cite anything else.",
        ...sourceRefs.map(
          (s) => `[${s.id}] (${s.tier}) ${s.publisher} — ${s.title}\n    "${s.snippet}"`,
        ),
      ].join("\n")
    : "SOURCES: none matched this question. Say plainly that you don't have a source for it rather than answering from memory.";

  const recalled = personalSnippets.length
    ? `RELEVANT THINGS THEY TOLD YOU BEFORE:\n${personalSnippets.map((s) => `- ${s}`).join("\n")}`
    : "";

  const messages = [
    {
      role: "system" as const,
      content: [CHAT_SYSTEM, "", fullContextBlock(opts.context), "", recalled]
        .filter(Boolean)
        .join("\n"),
    },
    ...opts.history.map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
    { role: "user" as const, content: `${sourcesBlock}\n\nTHEIR QUESTION: ${opts.message}` },
  ];

  let full = "";
  try {
    for await (const delta of llm.chatStream({
      messages,
      model: deps.model,
      maxTokens: 1200,
      signal: opts.signal,
    })) {
      full += delta;
      yield { type: "chat.delta", text: delta };
    }
  } catch (error) {
    yield {
      type: "chat.failed",
      message: error instanceof Error ? error.message : "Chat failed",
    };
    return;
  }

  // An empty reply is a real failure mode, not an edge case: a reasoning model
  // can spend the whole budget thinking and emit no content at all. Say so
  // rather than showing the user a blank bubble.
  if (!full.trim()) {
    yield {
      type: "chat.failed",
      message:
        "The model returned no text. If it is a reasoning model, raise max_tokens or use a non-reasoning one.",
    };
    return;
  }

  /**
   * Validate citations.
   *
   * The investigation pipeline drops a badly-cited finding outright, but chat
   * streams prose so nothing can be withheld mid-flight. Instead we audit the
   * finished answer: invented source ids are stripped, and any sentence stating
   * a figure its cited source does not contain is reported.
   *
   * The audited text is what `chat.completed` carries and what gets persisted —
   * the raw deltas are only for the typing effect.
   */
  const sourceText = new Map(sourceRefs.map((s) => [s.id.toLowerCase(), `${s.title} ${s.snippet}`]));
  const audit = auditCitations(full, sourceText);
  full = audit.text;

  if (audit.removed.length || audit.unsupported.length) {
    console.log(
      `[guard] chat audit — removed invented ids: ${audit.removed.join(", ") || "none"}` +
        ` | unsupported figures: ${audit.unsupported.length}`,
    );
  }

  yield {
    type: "chat.audit",
    valid: audit.valid,
    removed: audit.removed,
    unsupported: audit.unsupported,
  };

  // Law 2, checked after the fact for chat: we stream, so we can't withhold
  // tokens. If it slipped through, append the correction rather than pretend.
  const check = checkNoRecommendation(full);
  if (!check.clean) {
    const note =
      "\n\n_(Correction: that read as a recommendation. It isn't one — " +
      "this is what the evidence says, and the decision is yours.)_";
    full += note;
    yield { type: "chat.delta", text: note };
  }

  if (sourceRefs.length) yield { type: "chat.sources", sources: sourceRefs };
  yield { type: "chat.completed", messageId: opts.messageId, content: full };
}
