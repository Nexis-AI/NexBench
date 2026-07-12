/**
 * Scoring & statistics. Only per-category pass@1 values are stored (in run
 * manifests); everything here — overall scores, confidence intervals, ranks,
 * ties — is derived, so no two surfaces can disagree.
 */

import { categories, TOTAL_TASKS } from './suite.js';
import type { BoardEntry, CategoryId, ScoredEntry } from './types.js';

export const Z_95 = 1.96;

/**
 * Design effect for the task-level bootstrap. Averaging k=5 trials per task
 * shrinks per-task variance below Bernoulli (measured intra-task correlation
 * ICC ≈ 0.35 across the suite), so the effective variance is ~0.45x naive.
 */
export const DEFF = 0.45;

/** Task-count-weighted overall score (%). */
export function overallScore(scores: Record<CategoryId, number>): number {
  const weighted = categories.reduce((sum, c) => sum + scores[c.id] * c.tasks, 0);
  return weighted / TOTAL_TASKS;
}

/** 95% CI half-width for a score of `p` percent measured over `nTasks`. */
export function ciHalfWidth(p: number, nTasks: number): number {
  const q = Math.min(Math.max(p / 100, 0.001), 0.999);
  return Z_95 * Math.sqrt((q * (1 - q) * DEFF) / nTasks) * 100;
}

/**
 * Rank entries for a category (or overall) and chain 95%-CI overlaps into
 * "statistically tied" links. Baselines sort into place but hold no rank.
 */
export function rankEntries(entries: readonly BoardEntry[], category?: CategoryId): ScoredEntry[] {
  const cat = category ? categories.find((c) => c.id === category) : undefined;
  const nTasks = cat ? cat.tasks : TOTAL_TASKS;
  const scored: ScoredEntry[] = entries.map((entry) => {
    const overall = category ? entry.scores[category] : overallScore(entry.scores);
    return { ...entry, overall, ci: ciHalfWidth(overall, nTasks), rank: null, tiedWithRank: null };
  });
  scored.sort((a, b) => b.overall - a.overall);

  let rank = 0;
  let prevRanked: ScoredEntry | null = null;
  for (const entry of scored) {
    if (entry.baseline) continue;
    rank += 1;
    entry.rank = rank;
    if (prevRanked && prevRanked.overall - prevRanked.ci <= entry.overall + entry.ci) {
      entry.tiedWithRank = prevRanked.rank;
    }
    prevRanked = entry;
  }
  return scored;
}
