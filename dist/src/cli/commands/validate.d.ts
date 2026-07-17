/** `nexbench validate <manifest.json>` — run the 12 intake checks locally. */
import { type KnownRun } from '../../core/validate.js';
import { type Args } from '../util.js';
/** Load the bundled reference manifests as the duplicate-detection corpus. */
export declare function loadKnownRuns(dir: string): KnownRun[];
export declare function validateCmd(args: Args): Promise<void>;
