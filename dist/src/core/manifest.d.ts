/**
 * Manifest assembly. The harness produces raw per-trial outcomes; this module
 * turns them into a canonical `nexbench.run/2.1` manifest with a recomputed
 * runId. Because the runId is a content hash (see integrity.ts), assembly is
 * the only correct way to obtain a valid one — you cannot hand-author it.
 */
import type { AgentClass, CategoryId, ProvenanceKind, RunManifest, RunMetrics, VerificationTier } from './types.js';
export type ManifestDraft = {
    agent: {
        id: string;
        name: string;
        scaffold: string;
        model: string;
        class?: AgentClass;
        openSource?: boolean;
    };
    submitter: {
        name: string;
        contact: string;
        github?: string;
    };
    run?: {
        completedAt?: string;
        harnessVersion?: string;
        harnessBuild?: string;
        envPinsDigest?: string;
    };
    /** Raw pass@1 (%) per category — snapped onto the trial grid on assembly. */
    categories: Record<CategoryId, number>;
    metrics: RunMetrics;
    integrity: {
        traceRoot: string;
        canaryClean: boolean;
    };
    provenance?: {
        kind?: ProvenanceKind;
        tier?: VerificationTier;
        verifiedBy?: string;
        verifiedAt?: string;
    };
};
/**
 * Assemble a complete, hash-valid manifest from a draft. Category rates and the
 * task-grid metrics are snapped onto their achievable grids so a manifest built
 * from real trial counts always passes the trial-grid check. The runId is then
 * computed over the finished results block.
 */
export declare function assembleManifest(draft: ManifestDraft): Promise<RunManifest>;
/** Today's date as an ISO calendar day (UTC), matching manifest convention. */
export declare function isoDate(d?: Date): string;
