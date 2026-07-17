/**
 * The agent <-> harness interface. An agent is a single step function; the
 * harness owns the loop, the clock, and all entropy. This is the exact
 * `Observation`/`Action` contract re-exported from the package root, so an
 * adapter can `import type { Observation, Action } from 'nexbench'`.
 */
/** Normalize either agent form to an { reset, step } pair. */
export function asAgent(a) {
    return typeof a === 'function' ? { step: a } : a;
}
