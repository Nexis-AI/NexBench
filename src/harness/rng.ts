/**
 * Deterministic entropy. The harness owns all randomness so a re-run of the
 * same (agent, task, trial) reproduces bit-for-bit. Agents that need stochastic
 * behavior derive it from the trial seed handed to `reset`, never from the
 * ambient clock or Math.random.
 */

/** FNV-1a over the joined parts → a 32-bit seed. */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261 >>> 0;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG: fast, seedable, good enough for trial jitter. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
