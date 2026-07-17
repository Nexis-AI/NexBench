/**
 * The run loop. The harness — not the agent — owns the clock, the step budget,
 * and the trial seeds. For each task it runs k independent trials, grades each
 * with the task's programmatic checker, and aggregates onto the same trial grid
 * the leaderboard uses. The output is a `nexbench.dev/2.1` development report:
 * a real, reproducible score over the runnable public split, explicitly NOT a
 * leaderboard manifest (that requires the full reference environment).
 */
import type { AgentClass, CategoryId, Difficulty } from '../core/types.js';
import { type AgentLike, type TaskModule } from '../env/types.js';
import { type EvidenceTaskRecord } from './trace.js';
export type DevTaskResult = {
    id: string;
    category: CategoryId;
    title: string;
    difficulty: Difficulty;
    passAt1: number;
    passAll: boolean;
    detail: string;
};
export type DevReport = {
    schema: string;
    suite: {
        name: string;
        version: string;
        trialsPerTask: number;
        mode: 'public-dev';
    };
    agent: {
        id: string;
        name: string;
        scaffold: string;
        model: string;
        class: AgentClass;
        openSource: boolean;
    };
    run: {
        completedAt: string;
        harnessVersion: string;
        tasksRun: number;
    };
    results: {
        categories: Partial<Record<CategoryId, {
            passAt1: number;
            tasks: number;
        }>>;
        tasks: DevTaskResult[];
        metrics: {
            passHat5: number;
            svrPer100: number;
            gasOverspendPct: number;
            costPerTaskUsd: number;
            medianTaskSeconds: number;
        };
    };
    integrity: {
        traceRoot: string;
        canaryClean: boolean;
    };
    note: string;
};
export type RunOptions = {
    trials?: number;
    completedAt?: string;
    agent?: Partial<DevReport['agent']>;
    onProgress?: (msg: string) => void;
};
/** Run k trials of each task and produce trace records + a dev report. */
export declare function runSuite(agentLike: AgentLike, tasks: readonly TaskModule[], opts?: RunOptions): Promise<{
    report: DevReport;
    records: EvidenceTaskRecord[];
}>;
