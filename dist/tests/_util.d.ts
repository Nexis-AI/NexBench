import type { RunManifest } from '../src/core/types.js';
/** Package root, resolved from the compiled test location (dist/tests). */
export declare function root(): string;
export declare function resultsDir(): string;
export declare function loadJson<T = unknown>(path: string): T;
export declare function referenceManifests(): {
    file: string;
    manifest: RunManifest;
}[];
