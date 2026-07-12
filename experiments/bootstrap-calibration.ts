/**
 * Experiment: calibrate the confidence-interval design effect (DEFF).
 *
 * NEXBENCH reports a 95% CI of the form  1.96 · sqrt( p(1-p) · DEFF / N ).
 * Averaging k independent trials per task shrinks the sampling variance of a
 * category score below the naive Bernoulli variance p(1-p)/N. This Monte Carlo
 * estimates the true variance under a task-level bootstrap (tasks carry latent
 * difficulty; trials within a task are correlated) and recovers the DEFF that
 * makes the analytic interval match — the value pinned in scoring.ts.
 *
 * Run: npm run experiment:bootstrap
 */

import { ciHalfWidth, DEFF } from '../src/core/scoring.js';
import { categories } from '../src/core/suite.js';
import { mulberry32 } from '../src/harness/rng.js';

const K = 5;
const REPLICATIONS = 8000;
const rng = mulberry32(0x9e3779b9);

/** Draw a per-task latent pass probability with meaningful spread. */
function drawTaskP(mean: number): number {
  // Logit-normal around `mean` gives task-to-task difficulty variation (ICC).
  const z = gaussian();
  const logit = Math.log(mean / (1 - mean)) + 1.15 * z;
  return 1 / (1 + Math.exp(-logit));
}

function gaussian(): number {
  // Box–Muller from the seeded uniform stream.
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** One simulated category run → its pass@1 score (%). */
function simulateScore(nTasks: number, meanP: number): number {
  let successes = 0;
  for (let t = 0; t < nTasks; t++) {
    const p = drawTaskP(meanP);
    for (let i = 0; i < K; i++) if (rng() < p) successes++;
  }
  return (successes / (nTasks * K)) * 100;
}

function std(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

console.log(`NEXBENCH — bootstrap CI calibration (k=${K} trials, ${REPLICATIONS} replications)\n`);
console.log('category            N    mean%   empirical½   analytic½   impliedDEFF');
console.log('------------------  ---  ------  ----------   ---------   -----------');

const implied: number[] = [];
for (const c of [...categories].sort((a, b) => a.tasks - b.tasks)) {
  const meanP = 0.55; // representative mid-suite difficulty
  const scores: number[] = [];
  for (let r = 0; r < REPLICATIONS; r++) scores.push(simulateScore(c.tasks, meanP));
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const empHalf = 1.96 * std(scores);
  const analytic = ciHalfWidth(mean, c.tasks);
  // DEFF that would make the analytic half-width equal the empirical one.
  const q = mean / 100;
  const bernoulliHalf = 1.96 * Math.sqrt((q * (1 - q)) / c.tasks) * 100;
  const impliedDeff = (empHalf / bernoulliHalf) ** 2;
  implied.push(impliedDeff);
  console.log(
    `${c.label.padEnd(18)}  ${String(c.tasks).padStart(3)}  ${mean.toFixed(1).padStart(6)}  ${empHalf.toFixed(3).padStart(10)}   ${analytic.toFixed(3).padStart(9)}   ${impliedDeff.toFixed(3).padStart(11)}`,
  );
}

const meanImplied = implied.reduce((a, b) => a + b, 0) / implied.length;
console.log(`\nmean implied DEFF ≈ ${meanImplied.toFixed(3)}  (pinned in scoring.ts: DEFF = ${DEFF})`);
console.log(
  meanImplied < DEFF + 0.15
    ? '✓ the pinned DEFF is conservative-to-accurate for this difficulty spread.'
    : '⚠ consider re-pinning DEFF — the empirical design effect drifted.',
);
