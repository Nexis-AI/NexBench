/**
 * A deliberately partial reference agent. It clears the easy tasks, is
 * unreliable on best-execution and drainer triage, and gets PnL accounting
 * wrong — so a public-dev run shows a realistic spread and, importantly,
 * pass^5 well below pass@1. Use it as the template to beat, and read it
 * alongside the scripted baseline to see what "solved" looks like.
 */
import type { Action, Agent, Observation } from '../env/types.js';
export declare class ExampleAgent implements Agent {
    private rand;
    reset(taskId: string, trial: number): void;
    step(obs: Observation): Action;
}
export declare const exampleAgent: ExampleAgent;
export default exampleAgent;
