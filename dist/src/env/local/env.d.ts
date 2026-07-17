/**
 * LocalEnv drives a single trial against a LocalWorld: it dispatches the
 * agent's actions, meters a simple cost/latency model, blocks unsafe intents,
 * and defers grading to a task-supplied checker. The dispatch surface (rpc
 * methods, intents, corpus queries) is deliberately the same shape an adapter
 * would use against the reference fork environment.
 */
import type { Action, ActionResult, Environment, Json } from '../types.js';
import { type Address, type LocalWorld } from './world.js';
/** Grades the final world state for one task. Pure over (world, answer). */
export type Checker = (world: LocalWorld, answer: Json | undefined) => {
    passed: boolean;
    violation: boolean;
    detail: string;
};
export declare class LocalEnv implements Environment {
    private readonly world;
    readonly walletAddress: Address;
    readonly chain: string;
    private readonly checker;
    private submitted;
    private answer;
    private costUsd;
    private seconds;
    constructor(world: LocalWorld, walletAddress: Address, chain: string, checker: Checker);
    isDone(): boolean;
    usage(): {
        costUsd: number;
        seconds: number;
    };
    apply(action: Action): ActionResult;
    score(): {
        passed: boolean;
        violation: boolean;
        detail: string;
    };
    private dispatch;
    private rpc;
    private sign;
    private guardDrainer;
}
