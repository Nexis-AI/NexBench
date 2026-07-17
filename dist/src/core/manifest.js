/**
 * Manifest assembly. The harness produces raw per-trial outcomes; this module
 * turns them into a canonical `nexbench.run/2.1` manifest with a recomputed
 * runId. Because the runId is a content hash (see integrity.ts), assembly is
 * the only correct way to obtain a valid one — you cannot hand-author it.
 */
import { computeRunId, snapToTaskGrid, snapToTrialGrid } from './integrity.js';
import { BENCH_NAME, BENCH_SCHEMA, BENCH_VERSION, categories, ENV_PINS_DIGEST, HARNESS_BUILD, HARNESS_VERSION, KNOWN_HARNESS_BUILDS, TOTAL_TASKS, TRIALS_PER_TASK, } from './suite.js';
/**
 * Assemble a complete, hash-valid manifest from a draft. Category rates and the
 * task-grid metrics are snapped onto their achievable grids so a manifest built
 * from real trial counts always passes the trial-grid check. The runId is then
 * computed over the finished results block.
 */
export async function assembleManifest(draft) {
    const harnessVersion = draft.run?.harnessVersion ?? HARNESS_VERSION;
    const harnessBuild = draft.run?.harnessBuild ??
        KNOWN_HARNESS_BUILDS[harnessVersion] ??
        (harnessVersion === HARNESS_VERSION ? HARNESS_BUILD : undefined);
    if (!harnessBuild) {
        throw new Error(`harnessBuild is required for unpublished harness version ${harnessVersion}`);
    }
    const snappedCategories = Object.fromEntries(categories.map((c) => [c.id, { passAt1: snapToTrialGrid(draft.categories[c.id], c.tasks) }]));
    const metrics = {
        passHat5: snapToTaskGrid(draft.metrics.passHat5, TOTAL_TASKS),
        svrPer100: snapToTaskGrid(draft.metrics.svrPer100, TOTAL_TASKS),
        gasOverspendPct: Number(draft.metrics.gasOverspendPct.toFixed(4)),
        costPerTaskUsd: Number(draft.metrics.costPerTaskUsd.toFixed(4)),
        medianTaskSeconds: draft.metrics.medianTaskSeconds,
    };
    const base = {
        schema: BENCH_SCHEMA,
        suite: {
            name: BENCH_NAME,
            version: BENCH_VERSION,
            totalTasks: TOTAL_TASKS,
            trialsPerTask: TRIALS_PER_TASK,
        },
        agent: {
            id: draft.agent.id,
            name: draft.agent.name,
            scaffold: draft.agent.scaffold,
            model: draft.agent.model,
            class: draft.agent.class ?? 'agent',
            openSource: draft.agent.openSource ?? false,
        },
        submitter: {
            name: draft.submitter.name,
            contact: draft.submitter.contact,
            ...(draft.submitter.github ? { github: draft.submitter.github } : {}),
        },
        run: {
            completedAt: draft.run?.completedAt ?? isoDate(),
            harnessVersion,
            harnessBuild,
            envPinsDigest: draft.run?.envPinsDigest ?? ENV_PINS_DIGEST,
        },
        results: { categories: snappedCategories, metrics },
    };
    const runId = await computeRunId(base);
    return {
        ...base,
        integrity: {
            runId,
            traceRoot: draft.integrity.traceRoot,
            canaryClean: draft.integrity.canaryClean,
        },
        provenance: {
            kind: draft.provenance?.kind ?? 'community',
            tier: draft.provenance?.tier ?? 'self-reported',
            ...(draft.provenance?.verifiedBy ? { verifiedBy: draft.provenance.verifiedBy } : {}),
            ...(draft.provenance?.verifiedAt ? { verifiedAt: draft.provenance.verifiedAt } : {}),
        },
    };
}
/** Today's date as an ISO calendar day (UTC), matching manifest convention. */
export function isoDate(d = new Date()) {
    return d.toISOString().slice(0, 10);
}
