/** What we store in the vector index. */
export interface VectorPoint {
  id: string;
  vector: number[];
  payload: VectorPayload;
}

export interface VectorPayload {
  /** Which document this chunk came from. */
  docId: string;
  text: string;
  /** Source tier, so we can filter to official-only when it matters. */
  tier: string;
  tickers: string[];
  sectors: string[];
  /**
   * Owner of this point. "public" for market sources; a user id for that user's
   * own context. Personal context is NEVER returned to another user.
   */
  owner: string;
  /** source | decision | profile | chat — what kind of memory this is. */
  kind: string;
}

export interface VectorHit {
  id: string;
  score: number;
  payload: VectorPayload;
}

export interface SearchFilter {
  owner?: string;
  kinds?: string[];
  tickers?: string[];
  tiers?: string[];
}

export interface VectorStore {
  readonly name: string;
  ready(): Promise<boolean>;
  upsert(points: VectorPoint[]): Promise<void>;
  search(vector: number[], limit: number, filter?: SearchFilter): Promise<VectorHit[]>;
  count(): Promise<number>;
  reset(): Promise<void>;
}

export const PUBLIC_OWNER = "public";
