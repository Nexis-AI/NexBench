/**
 * NEXBENCH domain types. The run manifest is the canonical, wire-format
 * artifact: every leaderboard row is one validated manifest JSON. UI-facing
 * types (BoardEntry, ScoredEntry) are derived views over manifests.
 */

export type CategoryId =
  | 'execution'
  | 'swaps'
  | 'bridging'
  | 'defi'
  | 'research'
  | 'security'
  | 'analysis'
  | 'governance';

export type BenchCategory = {
  id: CategoryId;
  /** Three-letter code used in task ids, chips, and radar axes. */
  code: string;
  label: string;
  /** Number of tasks; doubles as the category weight in the overall score. */
  tasks: number;
  description: string;
  /** Environment note shown on category cards. */
  env: string;
};

export type BenchEnvironment = { name: string; pin: string; note?: string };

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

/** A task specification as stored under tasks/. */
export type BenchTask = {
  id: string;
  category: CategoryId;
  title: string;
  difficulty: Difficulty;
  env: string;
  description: string;
  /** Human-readable statement of what the programmatic checker asserts. */
  checker: string;
};

/* ————————————————————————— run manifests ————————————————————————— */

export type AgentClass = 'agent' | 'human-baseline' | 'scripted-baseline';
export type ProvenanceKind = 'reference' | 'seed' | 'community';
export type VerificationTier = 'verified' | 'self-reported';

export type CategoryResult = { passAt1: number };

export type RunMetrics = {
  /** Reliability: share of tasks solved on all k trials. */
  passHat5: number;
  /** Safety-violation rate per 100 tasks. */
  svrPer100: number;
  gasOverspendPct: number;
  costPerTaskUsd: number;
  medianTaskSeconds: number;
};

/** Wire format `nexbench.run/2.1` — what `nexbench submit` produces. */
export type RunManifest = {
  schema: string;
  suite: {
    name: string;
    version: string;
    totalTasks: number;
    trialsPerTask: number;
  };
  agent: {
    id: string;
    name: string;
    scaffold: string;
    model: string;
    class: AgentClass;
    openSource: boolean;
  };
  submitter: {
    name: string;
    contact: string;
    github?: string;
  };
  run: {
    completedAt: string; // ISO date
    harnessVersion: string;
    harnessBuild: string; // sha256:… of the published harness image
    envPinsDigest: string; // sha256:… over the pinned environment set
  };
  results: {
    /** pass@1 (%) per category, 4-decimal precision on the trial grid. */
    categories: Record<CategoryId, CategoryResult>;
    metrics: RunMetrics;
  };
  integrity: {
    /** nbr1_<16 hex> — recomputable content hash; the public run id. */
    runId: string;
    /** Merkle root over the per-task action/verifier trace archive. */
    traceRoot: string;
    canaryClean: boolean;
  };
  provenance: {
    kind: ProvenanceKind;
    tier: VerificationTier;
    verifiedBy?: string;
    verifiedAt?: string;
  };
};

/* ————————————————————————— derived views ————————————————————————— */

/** Flat, UI-friendly projection of a manifest. */
export type BoardEntry = {
  id: string;
  runId: string;
  name: string;
  scaffold: string;
  model: string;
  runBy: string;
  openSource: boolean;
  verified: boolean;
  kind: ProvenanceKind;
  date: string;
  scores: Record<CategoryId, number>;
  passHat5: number;
  svr: number;
  gasOverspend: number;
  costPerTask: number;
  medianSeconds: number;
  baseline?: 'human' | 'scripted';
};

export type ScoredEntry = BoardEntry & {
  overall: number;
  ci: number;
  /** 1-based rank among non-baseline entries; null for baselines. */
  rank: number | null;
  /** Rank of the entry this one is statistically tied with, if any. */
  tiedWithRank: number | null;
};
