/**
 * The agent <-> harness interface. An agent is a single step function; the
 * harness owns the loop, the clock, and all entropy. This is the exact
 * `Observation`/`Action` contract re-exported from the package root, so an
 * adapter can `import type { Observation, Action } from 'nexbench'`.
 */
import type { CategoryId, Difficulty } from '../core/types.js';
export type Json = null | boolean | number | string | Json[] | {
    [k: string]: Json;
};
export type Budget = {
    stepsRemaining: number;
    secondsRemaining: number;
    usdRemaining: number;
};
export type TaskBrief = {
    id: string;
    category: CategoryId;
    title: string;
    difficulty: Difficulty;
    /** The task statement handed to the agent (contains the embedded canary). */
    brief: string;
};
/** Everything the agent sees on a single step. */
export type Observation = {
    task: TaskBrief;
    /** 0-based step index within the current trial. */
    step: number;
    /** Address the agent operates from. */
    wallet: {
        address: string;
        chain: string;
    };
    /** Result of the agent's previous action (absent on the first step). */
    last?: ActionResult;
    budget: Budget;
};
/** Read-only view into chain, pool, oracle, or wallet state. */
export type RpcCall = {
    type: 'rpc_call';
    method: string;
    params?: Json;
};
/** A state-changing intent the harness signs and applies against the fork. */
export type SignRequest = {
    type: 'sign_request';
    intent: Intent;
};
/** A query against the frozen research corpus. */
export type CorpusQuery = {
    type: 'corpus_query';
    query: string;
};
/** Free-form scratchpad; recorded in the trace, never scored directly. */
export type Note = {
    type: 'note';
    text: string;
};
/** Finalize the task, optionally with a structured answer for graded tasks. */
export type Submit = {
    type: 'submit';
    answer?: Json;
};
export type Action = RpcCall | SignRequest | CorpusQuery | Note | Submit;
/** The documented adapter contract: one function, driven by the harness. */
export type StepFn = (obs: Observation) => Action | Promise<Action>;
/**
 * Stateful agents implement the object form. `reset` is called once before each
 * trial so per-trial memory does not leak across the k independent trials.
 */
export interface Agent {
    reset?(taskId: string, trial: number): void;
    step: StepFn;
}
export type AgentLike = StepFn | Agent;
/** Normalize either agent form to an { reset, step } pair. */
export declare function asAgent(a: AgentLike): Required<Pick<Agent, 'step'>> & Agent;
/** State-changing intents. Each maps to a deterministic world transition. */
export type Intent = {
    kind: 'transfer';
    token: string;
    to: string;
    amount: string;
} | {
    kind: 'approve';
    token: string;
    spender: string;
    amount: string;
} | {
    kind: 'revoke';
    token: string;
    spender: string;
} | {
    kind: 'swap';
    pool: string;
    tokenIn: string;
    amountIn: string;
    minOut: string;
} | {
    kind: 'safe_batch_transfer';
    token: string;
    payees: {
        to: string;
        amount: string;
    }[];
} | {
    kind: 'bridge_deposit';
    bridge: string;
    token: string;
    amount: string;
    toChain: string;
};
/** What an action returns to the agent on the next observation. */
export type ActionResult = {
    ok: boolean;
    /** Structured payload for rpc/corpus reads. */
    data?: Json;
    /** Present when the action failed (bad params, safety block, budget). */
    error?: string;
    /** Model/gas cost charged for this step, in USD-equivalent. */
    costUsd?: number;
};
export type TrialOutcome = {
    /** Task solved on this trial per the programmatic checker. */
    passed: boolean;
    /** A hard safety violation occurred (drives the SVR metric; forces fail). */
    violation: boolean;
    /** USD-equivalent spend across the trial. */
    costUsd: number;
    /** Gas overspend versus the frozen-oracle optimum; required for full evidence. */
    gasOverspendPct?: number;
    /** Wall-clock seconds simulated across the trial. */
    seconds: number;
    /** Steps consumed. */
    steps: number;
    /** Human-readable note on why it passed/failed (for the trace). */
    detail: string;
};
/**
 * A runnable task. `build` returns a fresh Environment seeded for one trial;
 * distinct seeds produce distinct-but-deterministic instances so trials are
 * independent yet reproducible.
 */
export type TaskModule = {
    id: string;
    category: CategoryId;
    title: string;
    difficulty: Difficulty;
    brief: string;
    /** Max agent steps for a trial of this task. */
    maxSteps: number;
    build: (seed: number) => Environment;
};
/** A single-trial world the agent acts on. */
export interface Environment {
    /** Address the agent operates from, surfaced in the observation. */
    readonly walletAddress: string;
    readonly chain: string;
    /** Apply one action, mutating world state; returns the agent-visible result. */
    apply(action: Action): ActionResult;
    /** True once the agent has submitted or the task auto-completes. */
    isDone(): boolean;
    /** Grade the final world state. Called once, after the loop ends. */
    score(): {
        passed: boolean;
        violation: boolean;
        detail: string;
    };
    /** Cumulative resource usage across the trial so far. */
    usage(): {
        costUsd: number;
        seconds: number;
    };
}
