/**
 * The runnable subset of the public-dev split. Each module builds a fresh,
 * deterministic world for one trial and ships a programmatic checker that
 * asserts on final state or a submitted answer — never an LLM judge. These six
 * span every action type (rpc_call, sign_request, corpus_query, note, submit)
 * so an adapter that clears them exercises the whole interface.
 *
 * The remaining public-split tasks ship as specs in tasks/public-dev.json for
 * the task explorer; they run only against the reference fork environment.
 */
import type { TaskModule } from '../types.js';
export declare function computePnl(trades: {
    kind: 'buy' | 'sell';
    qty: number;
    priceUsd: number;
}[], markPriceUsd: number): {
    realized: number;
    unrealized: number;
    holdings: number;
};
export declare function parseKvFacts(text: string): {
    key: string;
    value: string;
}[];
export declare const RUNNABLE_TASKS: readonly TaskModule[];
export declare const RUNNABLE_BY_ID: ReadonlyMap<string, TaskModule>;
