/** `nexbench run` — execute the runnable public-dev suite with an agent. */
import { type DevReport } from '../../harness/run.js';
import { type Args } from '../util.js';
export declare function runCmd(args: Args): Promise<void>;
export declare function printScorecard(report: DevReport): void;
