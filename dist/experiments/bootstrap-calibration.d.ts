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
export {};
