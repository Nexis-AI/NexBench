/**
 * Experiment: how well does the trial grid catch fabricated scores?
 *
 * A real pass@1 over N tasks x k trials can only equal m/(N·k)·100 for integer
 * m. A person fabricating a leaderboard entry types "nice" numbers (75.0, 80.5,
 * 88…). This experiment measures the probability such a fabricated number
 * accidentally lands on the achievable grid (a detection miss) across the eight
 * category sizes, and confirms every genuinely achievable value passes.
 *
 * Run: npm run experiment:grid
 */

import { isOnTrialGrid, snapToTrialGrid } from '../src/core/integrity.js';
import { categories, TRIALS_PER_TASK } from '../src/core/suite.js';

const K = TRIALS_PER_TASK;

/** Fabricator vocabularies: the "pretty" numbers people actually type. */
const VOCABS: { name: string; values: number[] }[] = [
  { name: 'integers 0–100', values: range(0, 100, 1) },
  { name: 'halves (x.0 / x.5)', values: range(0, 200, 1).map((h) => h / 2) },
  { name: 'one-decimal', values: range(0, 1000, 1).map((d) => d / 10) },
];

function range(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  for (let v = lo; v <= hi; v += step) out.push(v);
  return out;
}

console.log(`NEXBENCH — trial-grid fabrication detection (k=${K})\n`);
console.log('For each category size N, grid step = 100/(N·k). A fabricated score is');
console.log('"missed" only if it happens to fall on that grid.\n');

console.log('category            N   step%    miss: integers  halves  one-dec');
console.log('------------------  --  ------   --------------  ------  -------');

// Per-vocab joint miss = product of per-category miss rates (a manifest must
// clear the grid in ALL eight categories to survive, so detection compounds).
const jointMiss = VOCABS.map(() => 1);
const perCategoryMiss: { label: string; misses: number[] }[] = [];

for (const c of [...categories].sort((a, b) => a.tasks - b.tasks)) {
  const step = 100 / (c.tasks * K);
  const misses = VOCABS.map((v) => v.values.filter((x) => isOnTrialGrid(x, c.tasks)).length / v.values.length);
  misses.forEach((m, i) => (jointMiss[i]! *= m));
  perCategoryMiss.push({ label: c.label, misses });
  console.log(
    `${c.label.padEnd(18)}  ${String(c.tasks).padStart(2)}  ${step.toFixed(3).padStart(6)}   ${pct(misses[0]!).padStart(14)}  ${pct(misses[1]!).padStart(6)}  ${pct(misses[2]!).padStart(7)}`,
  );
}

// Sanity: every genuinely achievable value passes (zero false rejections).
let falseReject = 0;
for (const c of categories) {
  for (let m = 0; m <= c.tasks * K; m++) {
    const real = snapToTrialGrid((m / (c.tasks * K)) * 100, c.tasks);
    if (!isOnTrialGrid(real, c.tasks)) falseReject++;
  }
}

console.log('\nJoint detection of a fully fabricated manifest (must clear all 8 categories):');
VOCABS.forEach((v, i) => {
  console.log(`  fabricator uses ${v.name.padEnd(20)} → caught ${pct(1 - jointMiss[i]!)}`);
});

// The weakest single category (coarsest grid) is the one to know about.
const weakest = perCategoryMiss.reduce((w, c) => (Math.max(...c.misses) > Math.max(...w.misses) ? c : w));
console.log(`\nWeakest single category: ${weakest.label} (integer-miss ${pct(weakest.misses[0]!)}).`);
console.log('Small categories with a coarse grid are individually weak against integer');
console.log('guesses — but the grid is one of twelve checks, and the runId content hash');
console.log('must still recompute over the fabricated block, which it will not.');
console.log(`\nFalse rejections of genuinely achievable scores: ${falseReject} (must be 0).`);

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}
