/**
 * The scripted baseline: a hand-written, deterministic policy that solves every
 * runnable public-dev task with fixed heuristics and no model calls. It is the
 * `scripted-baseline` reference on the leaderboard — the floor a learned agent
 * must clear — and doubles as a solvability smoke test: if the baseline stops
 * passing a task, the task or the world regressed.
 */
import type { Action, Agent, Observation } from '../env/types.js';
export declare class ScriptedBaseline implements Agent {
    private mem;
    reset(): void;
    step(obs: Observation): Action;
    /** Read payees, pay them all in a single batch transfer, submit. */
    private exe004;
    /** List allowances, queue the risky ones, revoke them one per step, submit. */
    private sec013;
    /** Quote both venues, then swap through whichever returns more. */
    private swp003;
    /** Classify signature requests with a keyword drainer heuristic. */
    private sec006;
    /** Query the corpus, parse key:value facts, submit them. */
    private res001;
    /** Pull trades + mark price, run FIFO accounting, submit realized/unrealized. */
    private anl003;
}
/** Keyword drainer heuristic — flags the classic malicious-signature patterns. */
export declare function isMalicious(summary: string): boolean;
export declare const scriptedBaseline: ScriptedBaseline;
export default scriptedBaseline;
