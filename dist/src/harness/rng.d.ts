/**
 * Deterministic entropy. The harness owns all randomness so a re-run of the
 * same (agent, task, trial) reproduces bit-for-bit. Agents that need stochastic
 * behavior derive it from the trial seed handed to `reset`, never from the
 * ambient clock or Math.random.
 */
/** FNV-1a over the joined parts → a 32-bit seed. */
export declare function hashSeed(...parts: (string | number)[]): number;
/** mulberry32 PRNG: fast, seedable, good enough for trial jitter. */
export declare function mulberry32(seed: number): () => number;
