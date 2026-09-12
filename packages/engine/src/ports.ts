/**
 * What the engine needs from the outside world.
 *
 * Deliberately narrow: the engine depends on this interface, not on
 * packages/sources directly. That means it runs today against a stub while
 * Tushar builds the real thing, and switching is an injection change.
 */

import type {
  GlossaryEntry,
  SearchHit,
  SearchOptions,
  SourceDocument,
  StockRecord,
  UserProfile,
} from "@bit-n-build-2026/contracts";

export interface SourcesPort {
  getStock(ticker: string): StockRecord | null;
  getDocument(id: string): SourceDocument | null;
  searchSources(query: string, opts?: SearchOptions): SearchHit[];
  getGlossary(term: string): GlossaryEntry | null;
  resolveTicker(text: string): { ticker: string; name: string } | null;
}

export interface ProfilePort {
  get(): Promise<UserProfile> | UserProfile;
  /** Record concepts we just taught, so we stop re-explaining them. */
  learnConcepts(keys: string[]): Promise<void> | void;
}
