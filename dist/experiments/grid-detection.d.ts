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
export {};
