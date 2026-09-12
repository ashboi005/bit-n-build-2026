import { index, integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * What the user actually did after an investigation.
 *
 * They don't buy through us — we're not a broker. But the AI needs to know
 * whether they acted, because "you looked at this and didn't buy" and "you put
 * 40% of your portfolio into this" are completely different contexts for the
 * next conversation. This table is the memory a friend can't give you.
 */
export const userDecision = pgTable(
  "user_decision",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    ticker: text("ticker").notNull(),
    companyName: text("company_name").notNull(),

    /** bought | sold | skipped | watching */
    action: text("action").notNull(),

    /** Null for skipped/watching. */
    quantity: real("quantity"),
    pricePerShare: real("price_per_share"),

    /**
     * The market price when they decided — needed for "what changed since".
     * Distinct from pricePerShare: a "skipped" or "watching" decision has no
     * purchase price but still has a reference point to measure against.
     */
    priceAtDecision: real("price_at_decision"),

    /** The thesis that led here, in the user's own words. */
    thesis: text("thesis"),
    /** What the investigation concluded, so we can compare later. */
    investigationSummary: text("investigation_summary"),
    /** Why they went ahead, or why they didn't. The most useful field here. */
    reasoning: text("reasoning"),

    /** held_up | broke | unresolved — filled in later, when we can tell. */
    outcome: text("outcome").notNull().default("unresolved"),
    outcomeNote: text("outcome_note"),

    decidedAt: timestamp("decided_at").defaultNow().notNull(),
  },
  (table) => [index("user_decision_user_idx").on(table.userId)],
);

/**
 * General chat. Separate from investigations — this is "what does P/E mean",
 * "how is my portfolio looking", "why did you say that".
 */
export const chatMessage = pgTable(
  "chat_message",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /** Groups messages into a conversation. */
    threadId: text("thread_id").notNull(),

    /** user | assistant */
    role: text("role").notNull(),
    content: text("content").notNull(),

    /** Source ids cited, so a chat answer is as accountable as an investigation. */
    sourceIds: jsonb("source_ids").$type<string[]>().notNull().default([]),
    /** Concept keys touched, so chat also teaches and updates what they know. */
    conceptKeys: jsonb("concept_keys").$type<string[]>().notNull().default([]),

    tokensUsed: integer("tokens_used"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("chat_message_thread_idx").on(table.threadId)],
);
