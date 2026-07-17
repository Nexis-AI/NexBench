/**
 * Scoring & statistics. Only per-category pass@1 values are stored (in run
 * manifests); everything here — overall scores, confidence intervals, ranks,
 * ties — is derived, so no two surfaces can disagree.
 */
import type { BoardEntry, CategoryId, ScoredEntry } from './types.js';
export declare const Z_95 = 1.96;
/**
 * Design effect for the task-level bootstrap. Averaging k=5 trials per task
 * shrinks per-task variance below Bernoulli (measured intra-task correlation
 * ICC ≈ 0.35 across the suite), so the effective variance is ~0.45x naive.
 */
export declare const DEFF = 0.45;
/** Task-count-weighted overall score (%). */
export declare function overallScore(scores: Record<CategoryId, number>): number;
/** 95% CI half-width for a score of `p` percent measured over `nTasks`. */
export declare function ciHalfWidth(p: number, nTasks: number): number;
/**
 * Rank entries for a category (or overall) and chain 95%-CI overlaps into
 * "statistically tied" links. Baselines sort into place but hold no rank.
 */
export declare function rankEntries(entries: readonly BoardEntry[], category?: CategoryId): ScoredEntry[];
