import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * The user's learning state. This is what makes explanations adapt, and what the
 * AI reads to reference a thesis the user got wrong three weeks ago.
 *
 * Stored in Postgres rather than memory so the demo seed is a real database
 * write — if a judge asks to see the data, there is data to see.
 */
export const userProfile = pgTable("user_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),

  /** new | learning | practicing | independent */
  level: text("level").notNull().default("new"),

  /** Glossary keys already explained, so we stop re-explaining them. */
  knownConcepts: jsonb("known_concepts").$type<string[]>().notNull().default([]),

  /** Holdings, including each position's share of the portfolio. */
  holdings: jsonb("holdings").$type<unknown[]>().notNull().default([]),

  /** Past theses and whether they held up. The memory a friend can't give you. */
  pastTheses: jsonb("past_theses").$type<unknown[]>().notNull().default([]),

  /** ISO date the user started, and days elapsed — powers "Day N". */
  startedAt: text("started_at").notNull(),
  dayIndex: integer("day_index").notNull().default(0),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
