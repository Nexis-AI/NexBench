/**
 * Trace evidence bundles and signed verification attestations.
 *
 * The run manifest remains `nexbench.run/2.1`. Evidence is an additive,
 * independently content-addressed artifact so existing manifest consumers keep
 * working while a verified-run service can prove the trace archive, canary
 * scan, verifier outputs, and final decision.
 */
import { sign as nodeSign, verify as nodeVerify, } from 'node:crypto';
import { canonicalJson, computeRunId, manifestDigest } from './core/integrity.js';
import { BENCH_NAME, BENCH_VERSION, categories, ENV_PINS_DIGEST, HARNESS_BUILD, HARNESS_VERSION, } from './core/suite.js';
import { canaryClean, traceRoot, verifierEvidenceRoot, VERIFIER_EVIDENCE_SCHEMA, } from './harness/trace.js';
export const EVIDENCE_BUNDLE_SCHEMA = 'nexbench.evidence/1.0';
export const VERIFICATION_ATTESTATION_SCHEMA = 'nexbench.verification-attestation/1.0';
/** MIME type accepted by the durable attachment API; schema identity is in JSON. */
export const EVIDENCE_MIME_TYPE = 'application/json';
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;
const RUN_ID_RE = /^nbr1_[0-9a-f]{16}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const CATEGORY_IDS = new Set([
    'execution',
    'swaps',
    'bridging',
    'defi',
    'research',
    'security',
    'analysis',
    'governance',
]);
const DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'expert']);
function trialCount(tasks) {
    return tasks.reduce((sum, task) => sum + task.trials.length, 0);
}
function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function median(values) {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
}
function deriveResults(bundle) {
    const categoryResults = {};
    for (const category of categories) {
        const tasks = bundle.tasks.filter((task) => task.category === category.id);
        if (tasks.length === 0)
            continue;
        const trials = tasks.flatMap((task) => task.trials);
        categoryResults[category.id] = {
            passAt1: Number(((trials.filter((trial) => trial.outcome.passed).length / trials.length) * 100).toFixed(4)),
            tasks: tasks.length,
        };
    }
    const allTrials = bundle.tasks.flatMap((task) => task.trials);
    const gas = allTrials
        .map((trial) => trial.outcome.gasOverspendPct)
        .filter((value) => typeof value === 'number');
    return {
        categories: categoryResults,
        metrics: {
            passHat5: Number(((bundle.tasks.filter((task) => task.trials.every((trial) => trial.outcome.passed)).length /
                bundle.tasks.length) *
                100).toFixed(4)),
            svrPer100: Number(((bundle.tasks.filter((task) => task.trials.some((trial) => trial.outcome.violation)).length /
                bundle.tasks.length) *
                100).toFixed(4)),
            gasOverspendPct: gas.length === allTrials.length ? Number(mean(gas).toFixed(4)) : null,
            costPerTaskUsd: Number(mean(allTrials.map((trial) => trial.outcome.costUsd)).toFixed(4)),
            medianTaskSeconds: Number(median(allTrials.map((trial) => trial.outcome.seconds)).toFixed(3)),
        },
    };
}
function inferredTrialsPerTask(tasks) {
    if (tasks.length === 0)
        throw new Error('evidence bundle requires at least one task');
    const count = tasks[0].trials.length;
    if (count === 0 || tasks.some((task) => task.trials.length !== count)) {
        throw new Error('every evidence task must have the same non-zero trial count');
    }
    return count;
}
/**
 * Build a content-addressed evidence bundle. Full bundles are accepted only
 * when their recomputed archive root and canary result already match the exact
 * manifest they accompany.
 */
export async function buildEvidenceBundle(options) {
    const tasks = [...options.records];
    const trialsPerTask = options.trialsPerTask ?? inferredTrialsPerTask(tasks);
    const root = await traceRoot(tasks);
    const verifierRoot = await verifierEvidenceRoot(tasks);
    const clean = canaryClean(tasks);
    const manifest = options.manifest;
    if (options.mode === 'full' && !manifest) {
        throw new Error('full evidence requires the corresponding run manifest');
    }
    if (options.mode === 'public-dev' && manifest) {
        throw new Error('public-dev evidence cannot claim a leaderboard manifest');
    }
    if (manifest) {
        if (manifest.integrity.traceRoot !== root) {
            throw new Error(`trace root mismatch: manifest ${manifest.integrity.traceRoot}, evidence ${root}`);
        }
        if (manifest.integrity.canaryClean !== clean) {
            throw new Error(`canary mismatch: manifest ${manifest.integrity.canaryClean}, evidence ${clean}`);
        }
        if (manifest.suite.totalTasks !== tasks.length) {
            throw new Error(`task count mismatch: manifest ${manifest.suite.totalTasks}, evidence ${tasks.length}`);
        }
        if (manifest.suite.trialsPerTask !== trialsPerTask) {
            throw new Error(`trial count mismatch: manifest ${manifest.suite.trialsPerTask}, evidence ${trialsPerTask}`);
        }
    }
    const bundle = {
        schema: EVIDENCE_BUNDLE_SCHEMA,
        subject: {
            runId: manifest?.integrity.runId ?? null,
            manifestDigest: manifest ? await manifestDigest(manifest) : null,
            traceRoot: root,
        },
        suite: {
            name: manifest?.suite.name ?? BENCH_NAME,
            version: manifest?.suite.version ?? BENCH_VERSION,
            totalTasks: manifest?.suite.totalTasks ?? tasks.length,
            trialsPerTask,
            mode: options.mode,
        },
        run: {
            completedAt: manifest?.run.completedAt ?? options.completedAt,
            harnessVersion: manifest?.run.harnessVersion ?? options.harnessVersion ?? HARNESS_VERSION,
            harnessBuild: manifest?.run.harnessBuild ?? options.harnessBuild ?? HARNESS_BUILD,
            envPinsDigest: manifest?.run.envPinsDigest ?? options.envPinsDigest ?? ENV_PINS_DIGEST,
        },
        tasks,
        integrity: {
            taskCount: tasks.length,
            trialCount: trialCount(tasks),
            verifierEvidenceRoot: verifierRoot,
            canaryClean: clean,
        },
        generatedAt: options.generatedAt ?? new Date().toISOString(),
    };
    const verification = await verifyEvidenceBundle(bundle, manifest);
    if (!verification.ok) {
        throw new Error(`cannot build invalid evidence: ${verification.issues
            .slice(0, 3)
            .map((issue) => `${issue.path}: ${issue.message}`)
            .join('; ')}`);
    }
    return bundle;
}
/** Canonical digest used by upload receipts and signed attestations. */
export function evidenceBundleDigest(bundle) {
    return manifestDigest(bundle);
}
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function structuralIssues(input) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!isObject(input)) {
        add('schema', '(root)', 'expected object');
        return issues;
    }
    if (input.schema !== EVIDENCE_BUNDLE_SCHEMA)
        add('schema', 'schema', `expected ${EVIDENCE_BUNDLE_SCHEMA}`);
    if (!isObject(input.subject))
        add('schema', 'subject', 'expected object');
    if (!isObject(input.suite))
        add('schema', 'suite', 'expected object');
    if (!isObject(input.run))
        add('schema', 'run', 'expected object');
    if (!Array.isArray(input.tasks))
        add('schema', 'tasks', 'expected array');
    if (!isObject(input.integrity))
        add('schema', 'integrity', 'expected object');
    if (typeof input.generatedAt !== 'string' || !ISO_DATE_TIME_RE.test(input.generatedAt))
        add('schema', 'generatedAt', 'expected ISO date-time string');
    if (issues.length)
        return issues;
    const bundle = input;
    if (!['full', 'public-dev'].includes(bundle.suite.mode))
        add('schema', 'suite.mode', 'expected full or public-dev');
    if (bundle.suite.name !== BENCH_NAME)
        add('schema', 'suite.name', `expected ${BENCH_NAME}`);
    if (bundle.suite.version !== BENCH_VERSION)
        add('schema', 'suite.version', `expected ${BENCH_VERSION}`);
    if (!Number.isInteger(bundle.suite.totalTasks) || bundle.suite.totalTasks <= 0)
        add('schema', 'suite.totalTasks', 'expected positive integer');
    if (!Number.isInteger(bundle.suite.trialsPerTask) || bundle.suite.trialsPerTask <= 0)
        add('schema', 'suite.trialsPerTask', 'expected positive integer');
    if (!SHA256_RE.test(bundle.subject.traceRoot))
        add('schema', 'subject.traceRoot', 'expected sha256:<64 hex>');
    if (bundle.subject.manifestDigest !== null &&
        !SHA256_RE.test(bundle.subject.manifestDigest))
        add('schema', 'subject.manifestDigest', 'expected null or sha256:<64 hex>');
    if (bundle.subject.runId !== null && !RUN_ID_RE.test(bundle.subject.runId))
        add('schema', 'subject.runId', 'expected null or nbr1_<16 hex>');
    if (!DATE_RE.test(bundle.run.completedAt))
        add('schema', 'run.completedAt', 'expected ISO calendar date');
    if (typeof bundle.run.harnessVersion !== 'string' || bundle.run.harnessVersion.length === 0)
        add('schema', 'run.harnessVersion', 'expected non-empty string');
    for (const [field, value] of [
        ['run.harnessBuild', bundle.run.harnessBuild],
        ['run.envPinsDigest', bundle.run.envPinsDigest],
        ['integrity.verifierEvidenceRoot', bundle.integrity.verifierEvidenceRoot],
    ]) {
        if (!SHA256_RE.test(value))
            add('schema', field, 'expected sha256:<64 hex>');
    }
    if (!Number.isInteger(bundle.integrity.taskCount) || bundle.integrity.taskCount < 0)
        add('schema', 'integrity.taskCount', 'expected non-negative integer');
    if (!Number.isInteger(bundle.integrity.trialCount) || bundle.integrity.trialCount < 0)
        add('schema', 'integrity.trialCount', 'expected non-negative integer');
    if (typeof bundle.integrity.canaryClean !== 'boolean')
        add('schema', 'integrity.canaryClean', 'expected boolean');
    if (bundle.tasks.length === 0)
        add('schema', 'tasks', 'expected at least one task');
    bundle.tasks.forEach((task, taskIndex) => {
        if (!isObject(task) || typeof task.id !== 'string' || !Array.isArray(task.trials)) {
            add('schema', `tasks.${taskIndex}`, 'expected a task record with trials');
            return;
        }
        const taskPath = `tasks.${taskIndex}`;
        if (!CATEGORY_IDS.has(task.category))
            add('schema', `${taskPath}.category`, 'unknown category');
        if (typeof task.title !== 'string' || task.title.length === 0)
            add('schema', `${taskPath}.title`, 'expected non-empty string');
        if (!DIFFICULTIES.has(task.difficulty))
            add('schema', `${taskPath}.difficulty`, 'unknown difficulty');
        if (typeof task.passAt1 !== 'number' || task.passAt1 < 0 || task.passAt1 > 100)
            add('schema', `${taskPath}.passAt1`, 'expected number in [0,100]');
        if (typeof task.passAll !== 'boolean')
            add('schema', `${taskPath}.passAll`, 'expected boolean');
        if (task.trials.length === 0)
            add('schema', `${taskPath}.trials`, 'expected at least one trial');
        task.trials.forEach((trial, trialIndex) => {
            const path = `tasks.${taskIndex}.trials.${trialIndex}`;
            if (!isObject(trial) || !isObject(trial.outcome) || !Array.isArray(trial.steps)) {
                add('schema', path, 'expected trial record with outcome and steps');
                return;
            }
            if (!Number.isInteger(trial.trial) || !Number.isInteger(trial.seed))
                add('schema', path, 'trial and seed must be integers');
            if (typeof trial.outcome.passed !== 'boolean' ||
                typeof trial.outcome.violation !== 'boolean' ||
                typeof trial.outcome.costUsd !== 'number' ||
                trial.outcome.costUsd < 0 ||
                (trial.outcome.gasOverspendPct !== undefined &&
                    (typeof trial.outcome.gasOverspendPct !== 'number' ||
                        trial.outcome.gasOverspendPct < 0)) ||
                typeof trial.outcome.seconds !== 'number' ||
                trial.outcome.seconds < 0 ||
                !Number.isInteger(trial.outcome.steps) ||
                typeof trial.outcome.detail !== 'string')
                add('schema', `${path}.outcome`, 'invalid trial outcome');
            trial.steps.forEach((step, stepIndex) => {
                if (!isObject(step) ||
                    !Number.isInteger(step.step) ||
                    !isObject(step.action) ||
                    !isObject(step.result))
                    add('schema', `${path}.steps.${stepIndex}`, 'invalid action/result step');
            });
            if (!isObject(trial.verifier)) {
                add('verifier-missing', `${path}.verifier`, 'verifier evidence is required');
                return;
            }
            if (trial.verifier.schema !== VERIFIER_EVIDENCE_SCHEMA)
                add('schema', `${path}.verifier.schema`, `expected ${VERIFIER_EVIDENCE_SCHEMA}`);
            if (!isObject(trial.verifier.verifier) || !isObject(trial.verifier.verdict))
                add('schema', `${path}.verifier`, 'invalid verifier identity or verdict');
            else {
                if (typeof trial.verifier.taskId !== 'string' ||
                    !Number.isInteger(trial.verifier.trial) ||
                    typeof trial.verifier.verifier.id !== 'string' ||
                    trial.verifier.verifier.id.length === 0 ||
                    typeof trial.verifier.verifier.version !== 'string' ||
                    trial.verifier.verifier.version.length === 0 ||
                    !SHA256_RE.test(String(trial.verifier.verifier.build)) ||
                    typeof trial.verifier.verdict.passed !== 'boolean' ||
                    typeof trial.verifier.verdict.violation !== 'boolean' ||
                    !SHA256_RE.test(String(trial.verifier.evidenceDigest)))
                    add('schema', `${path}.verifier`, 'invalid verifier evidence fields');
            }
        });
    });
    return issues;
}
/** Strict structural parser for untrusted worker/API input. */
export function parseEvidenceBundle(input) {
    const issues = structuralIssues(input);
    return issues.length
        ? { ok: false, issues }
        : { ok: true, data: input };
}
function reasonCodes(issues) {
    return [...new Set(issues.map((issue) => issue.code))];
}
/**
 * Recompute every evidence claim. Passing a manifest additionally proves the
 * bundle belongs to that exact manifest, not merely that it is internally
 * self-consistent.
 */
export async function verifyEvidenceBundle(input, manifest) {
    const issues = structuralIssues(input);
    const empty = {
        traceRoot: null,
        verifierEvidenceRoot: null,
        canaryClean: null,
        evidenceBundleDigest: null,
        manifestDigest: null,
        digest: null,
        results: null,
    };
    if (issues.some((issue) => issue.code === 'schema')) {
        return {
            ok: false,
            reasonCodes: reasonCodes(issues),
            bundle: null,
            issues,
            recomputed: empty,
        };
    }
    const bundle = input;
    const taskIds = new Set();
    let actualTrialCount = 0;
    for (const [taskIndex, task] of bundle.tasks.entries()) {
        if (taskIds.has(task.id)) {
            issues.push({
                code: 'duplicate-task',
                path: `tasks.${taskIndex}.id`,
                message: `duplicate task id ${task.id}`,
            });
        }
        taskIds.add(task.id);
        const passedTrials = task.trials.filter((trial) => trial.outcome.passed).length;
        const derivedPassAt1 = Number(((passedTrials / task.trials.length) * 100).toFixed(4));
        const derivedPassAll = passedTrials === task.trials.length;
        if (Math.abs(task.passAt1 - derivedPassAt1) > 0.0001) {
            issues.push({
                code: 'task-score',
                path: `tasks.${taskIndex}.passAt1`,
                message: `stored ${task.passAt1}, derived ${derivedPassAt1}`,
            });
        }
        if (task.passAll !== derivedPassAll) {
            issues.push({
                code: 'task-score',
                path: `tasks.${taskIndex}.passAll`,
                message: `stored ${task.passAll}, derived ${derivedPassAll}`,
            });
        }
        if (task.trials.length !== bundle.suite.trialsPerTask) {
            issues.push({
                code: 'trial-count',
                path: `tasks.${taskIndex}.trials`,
                message: `expected ${bundle.suite.trialsPerTask}, received ${task.trials.length}`,
            });
        }
        actualTrialCount += task.trials.length;
        const seenTrials = new Set();
        for (const [trialIndex, trial] of task.trials.entries()) {
            const path = `tasks.${taskIndex}.trials.${trialIndex}.verifier`;
            if (seenTrials.has(trial.trial)) {
                issues.push({
                    code: 'duplicate-trial',
                    path,
                    message: `duplicate trial index ${trial.trial}`,
                });
            }
            seenTrials.add(trial.trial);
            if (trial.outcome.passed && trial.outcome.violation) {
                issues.push({
                    code: 'safety-consistency',
                    path: `tasks.${taskIndex}.trials.${trialIndex}.outcome`,
                    message: 'a safety-violating trial cannot pass',
                });
            }
            if (bundle.suite.mode === 'full' &&
                typeof trial.outcome.gasOverspendPct !== 'number') {
                issues.push({
                    code: 'gas-evidence',
                    path: `tasks.${taskIndex}.trials.${trialIndex}.outcome.gasOverspendPct`,
                    message: 'full evidence requires per-trial gas overspend',
                });
            }
            const evidence = trial.verifier;
            if (!evidence)
                continue;
            if (evidence.taskId !== task.id || evidence.trial !== trial.trial) {
                issues.push({
                    code: 'verifier-subject',
                    path,
                    message: 'verifier evidence subject does not match its task/trial',
                });
            }
            if (evidence.verdict.passed !== trial.outcome.passed ||
                evidence.verdict.violation !== trial.outcome.violation) {
                issues.push({
                    code: 'verifier-verdict',
                    path,
                    message: 'verifier verdict does not match the recorded outcome',
                });
            }
            const expectedDigest = await manifestDigest({
                taskId: task.id,
                trial: trial.trial,
                seed: trial.seed,
                outcome: trial.outcome,
                steps: trial.steps,
            });
            if (evidence.evidenceDigest !== expectedDigest) {
                issues.push({
                    code: 'verifier-digest',
                    path: `${path}.evidenceDigest`,
                    message: `stored ${evidence.evidenceDigest}, recomputed ${expectedDigest}`,
                });
            }
            if (!SHA256_RE.test(evidence.verifier.build)) {
                issues.push({
                    code: 'verifier-build',
                    path: `${path}.verifier.build`,
                    message: 'expected sha256:<64 hex>',
                });
            }
        }
    }
    if (bundle.integrity.taskCount !== bundle.tasks.length) {
        issues.push({
            code: 'task-count',
            path: 'integrity.taskCount',
            message: `stored ${bundle.integrity.taskCount}, actual ${bundle.tasks.length}`,
        });
    }
    if (bundle.integrity.trialCount !== actualTrialCount) {
        issues.push({
            code: 'trial-count',
            path: 'integrity.trialCount',
            message: `stored ${bundle.integrity.trialCount}, actual ${actualTrialCount}`,
        });
    }
    if (bundle.suite.totalTasks !== bundle.tasks.length) {
        issues.push({
            code: 'task-count',
            path: 'suite.totalTasks',
            message: `declared ${bundle.suite.totalTasks}, actual ${bundle.tasks.length}`,
        });
    }
    if (bundle.suite.mode === 'full' && (!bundle.subject.runId || !bundle.subject.manifestDigest)) {
        issues.push({
            code: 'manifest-subject',
            path: 'subject',
            message: 'full evidence requires runId and manifestDigest',
        });
    }
    if (bundle.suite.mode === 'public-dev' && (bundle.subject.runId || bundle.subject.manifestDigest)) {
        issues.push({
            code: 'manifest-subject',
            path: 'subject',
            message: 'public-dev evidence cannot claim a leaderboard manifest',
        });
    }
    const recomputedTraceRoot = await traceRoot(bundle.tasks);
    let recomputedVerifierRoot = null;
    try {
        recomputedVerifierRoot = await verifierEvidenceRoot(bundle.tasks);
    }
    catch (error) {
        issues.push({
            code: 'verifier-missing',
            path: 'tasks',
            message: error.message,
        });
    }
    const recomputedCanaryClean = canaryClean(bundle.tasks);
    const recomputedResults = deriveResults(bundle);
    const digest = await evidenceBundleDigest(bundle);
    const exactManifestDigest = manifest ? await manifestDigest(manifest) : null;
    if (bundle.subject.traceRoot !== recomputedTraceRoot) {
        issues.push({
            code: 'trace-root',
            path: 'subject.traceRoot',
            message: `stored ${bundle.subject.traceRoot}, recomputed ${recomputedTraceRoot}`,
        });
    }
    if (bundle.integrity.verifierEvidenceRoot !== recomputedVerifierRoot) {
        issues.push({
            code: 'verifier-root',
            path: 'integrity.verifierEvidenceRoot',
            message: `stored ${bundle.integrity.verifierEvidenceRoot}, recomputed ${recomputedVerifierRoot}`,
        });
    }
    if (bundle.integrity.canaryClean !== recomputedCanaryClean) {
        issues.push({
            code: 'canary',
            path: 'integrity.canaryClean',
            message: `stored ${bundle.integrity.canaryClean}, recomputed ${recomputedCanaryClean}`,
        });
    }
    if (manifest) {
        const expectedManifestDigest = exactManifestDigest;
        const expectedRunId = await computeRunId(manifest);
        const comparisons = [
            ['subject.runId', bundle.subject.runId, manifest.integrity.runId],
            ['subject.manifestDigest', bundle.subject.manifestDigest, expectedManifestDigest],
            ['subject.traceRoot', bundle.subject.traceRoot, manifest.integrity.traceRoot],
            ['suite.name', bundle.suite.name, manifest.suite.name],
            ['suite.version', bundle.suite.version, manifest.suite.version],
            ['suite.totalTasks', bundle.suite.totalTasks, manifest.suite.totalTasks],
            ['suite.trialsPerTask', bundle.suite.trialsPerTask, manifest.suite.trialsPerTask],
            ['run.completedAt', bundle.run.completedAt, manifest.run.completedAt],
            ['run.harnessVersion', bundle.run.harnessVersion, manifest.run.harnessVersion],
            ['run.harnessBuild', bundle.run.harnessBuild, manifest.run.harnessBuild],
            ['run.envPinsDigest', bundle.run.envPinsDigest, manifest.run.envPinsDigest],
            ['integrity.canaryClean', bundle.integrity.canaryClean, manifest.integrity.canaryClean],
        ];
        if (manifest.integrity.runId !== expectedRunId) {
            issues.push({
                code: 'manifest-run-id',
                path: 'manifest.integrity.runId',
                message: `stored ${manifest.integrity.runId}, recomputed ${expectedRunId}`,
            });
        }
        for (const [path, actual, expected] of comparisons) {
            if (actual !== expected) {
                issues.push({
                    code: 'manifest-mismatch',
                    path,
                    message: `evidence ${String(actual)}, manifest ${String(expected)}`,
                });
            }
        }
        if (bundle.suite.mode === 'full') {
            for (const category of categories) {
                const derived = recomputedResults.categories[category.id];
                if (!derived || derived.tasks !== category.tasks) {
                    issues.push({
                        code: 'category-count',
                        path: `tasks[category=${category.id}]`,
                        message: `expected ${category.tasks} tasks, received ${derived?.tasks ?? 0}`,
                    });
                    continue;
                }
                const claimed = manifest.results.categories[category.id].passAt1;
                if (Math.abs(derived.passAt1 - claimed) > 0.0001) {
                    issues.push({
                        code: 'score-mismatch',
                        path: `manifest.results.categories.${category.id}.passAt1`,
                        message: `manifest ${claimed}, evidence ${derived.passAt1}`,
                    });
                }
            }
            const derivedMetrics = recomputedResults.metrics;
            const claimedMetrics = manifest.results.metrics;
            const metricComparisons = [
                ['passHat5', derivedMetrics.passHat5, claimedMetrics.passHat5, 0.0001],
                ['svrPer100', derivedMetrics.svrPer100, claimedMetrics.svrPer100, 0.0001],
                [
                    'gasOverspendPct',
                    derivedMetrics.gasOverspendPct,
                    claimedMetrics.gasOverspendPct,
                    0.0001,
                ],
                ['costPerTaskUsd', derivedMetrics.costPerTaskUsd, claimedMetrics.costPerTaskUsd, 0.0001],
                [
                    'medianTaskSeconds',
                    derivedMetrics.medianTaskSeconds,
                    claimedMetrics.medianTaskSeconds,
                    0.001,
                ],
            ];
            for (const [metric, derived, claimed, tolerance] of metricComparisons) {
                if (derived === null || Math.abs(derived - claimed) > tolerance) {
                    issues.push({
                        code: 'score-mismatch',
                        path: `manifest.results.metrics.${metric}`,
                        message: `manifest ${claimed}, evidence ${String(derived)}`,
                    });
                }
            }
        }
    }
    return {
        ok: issues.length === 0,
        reasonCodes: reasonCodes(issues),
        bundle,
        issues,
        recomputed: {
            traceRoot: recomputedTraceRoot,
            verifierEvidenceRoot: recomputedVerifierRoot,
            canaryClean: recomputedCanaryClean,
            evidenceBundleDigest: digest,
            manifestDigest: exactManifestDigest,
            digest,
            results: recomputedResults,
        },
    };
}
/** Canonical signed bytes; the signature field is always excluded. */
export function attestationPayload(attestation) {
    const { signature: _signature, ...unsigned } = attestation;
    return canonicalJson(unsigned);
}
/** Verify only the detached Ed25519 signature; claim/evidence checks are separate. */
export function verifyAttestationSignature(input, publicKey) {
    if (!isObject(input) ||
        input.schema !== VERIFICATION_ATTESTATION_SCHEMA ||
        typeof input.signature !== 'string') {
        return false;
    }
    try {
        const attestation = input;
        return nodeVerify(null, Buffer.from(attestationPayload(attestation), 'utf8'), publicKey, Buffer.from(attestation.signature, 'base64url'));
    }
    catch {
        return false;
    }
}
function attestationStructuralIssues(input) {
    const issues = [];
    const add = (path, message) => issues.push({ code: 'attestation-schema', path, message });
    if (!isObject(input) || input.schema !== VERIFICATION_ATTESTATION_SCHEMA) {
        add('schema', `expected ${VERIFICATION_ATTESTATION_SCHEMA}`);
        return issues;
    }
    if (!isObject(input.subject) ||
        !isObject(input.environment) ||
        !isObject(input.evidence) ||
        !isObject(input.decision) ||
        !isObject(input.signer)) {
        add('(root)', 'missing attestation block');
        return issues;
    }
    const attestation = input;
    if (!RUN_ID_RE.test(attestation.subject.runId))
        add('subject.runId', 'invalid run id');
    for (const [path, value] of [
        ['subject.manifestDigest', attestation.subject.manifestDigest],
        ['subject.traceRoot', attestation.subject.traceRoot],
        ['subject.evidenceBundleDigest', attestation.subject.evidenceBundleDigest],
        ['environment.harnessBuild', attestation.environment.harnessBuild],
        ['environment.envPinsDigest', attestation.environment.envPinsDigest],
        ['evidence.verifierEvidenceRoot', attestation.evidence.verifierEvidenceRoot],
    ]) {
        if (!SHA256_RE.test(value))
            add(path, 'expected sha256:<64 hex>');
    }
    if (typeof attestation.environment.suiteVersion !== 'string' ||
        typeof attestation.environment.harnessVersion !== 'string')
        add('environment', 'invalid suite/harness version');
    if (!Number.isInteger(attestation.evidence.taskCount) ||
        attestation.evidence.taskCount <= 0 ||
        !Number.isInteger(attestation.evidence.trialCount) ||
        attestation.evidence.trialCount <= 0 ||
        typeof attestation.evidence.canaryClean !== 'boolean')
        add('evidence', 'invalid counts or canary result');
    if (!['verified', 'rejected'].includes(attestation.decision.verdict) ||
        !ISO_DATE_TIME_RE.test(attestation.decision.issuedAt) ||
        !isObject(attestation.decision.verifier) ||
        typeof attestation.decision.verifier.id !== 'string' ||
        typeof attestation.decision.verifier.version !== 'string' ||
        !Array.isArray(attestation.decision.reasonCodes) ||
        attestation.decision.reasonCodes.some((code) => typeof code !== 'string'))
        add('decision', 'invalid verification decision');
    if (typeof attestation.signer.keyId !== 'string' ||
        attestation.signer.keyId.length === 0 ||
        attestation.signer.algorithm !== 'Ed25519')
        add('signer', 'invalid signer');
    if (typeof attestation.signature !== 'string' ||
        !/^[A-Za-z0-9_-]+$/.test(attestation.signature))
        add('signature', 'expected base64url signature');
    return issues;
}
export async function createVerificationAttestation(input, privateKey) {
    const report = await verifyEvidenceBundle(input.evidence, input.manifest);
    if (!report.ok) {
        throw new Error(`cannot attest invalid evidence: ${report.issues
            .slice(0, 3)
            .map((issue) => `${issue.path}: ${issue.message}`)
            .join('; ')}`);
    }
    if (input.evidence.suite.mode !== 'full') {
        throw new Error('verified-run attestations require full-suite evidence');
    }
    if (input.evidence.integrity.taskCount !== input.manifest.suite.totalTasks ||
        input.evidence.integrity.trialCount !==
            input.manifest.suite.totalTasks * input.manifest.suite.trialsPerTask) {
        throw new Error('verified-run attestations require a complete task/trial archive');
    }
    if (input.decision.verdict === 'verified' && !input.evidence.integrity.canaryClean) {
        throw new Error('a contaminated run cannot receive a verified attestation');
    }
    const unsigned = {
        schema: VERIFICATION_ATTESTATION_SCHEMA,
        subject: {
            runId: input.manifest.integrity.runId,
            manifestDigest: await manifestDigest(input.manifest),
            traceRoot: input.manifest.integrity.traceRoot,
            evidenceBundleDigest: await evidenceBundleDigest(input.evidence),
        },
        environment: {
            suiteVersion: input.manifest.suite.version,
            harnessVersion: input.manifest.run.harnessVersion,
            harnessBuild: input.manifest.run.harnessBuild,
            envPinsDigest: input.manifest.run.envPinsDigest,
        },
        evidence: {
            verifierEvidenceRoot: input.evidence.integrity.verifierEvidenceRoot,
            taskCount: input.evidence.integrity.taskCount,
            trialCount: input.evidence.integrity.trialCount,
            canaryClean: input.evidence.integrity.canaryClean,
        },
        decision: input.decision,
        signer: { keyId: input.signer.keyId, algorithm: 'Ed25519' },
    };
    const signature = nodeSign(null, Buffer.from(attestationPayload(unsigned), 'utf8'), privateKey).toString('base64url');
    return { ...unsigned, signature };
}
/** Verify signature, exact manifest binding, and all underlying evidence. */
export async function verifyVerificationAttestation(input, publicKey, manifest, evidence) {
    const issues = attestationStructuralIssues(input);
    if (!isObject(input) || input.schema !== VERIFICATION_ATTESTATION_SCHEMA) {
        return {
            valid: false,
            verified: false,
            signatureValid: false,
            issues: [
                {
                    code: 'attestation-schema',
                    path: 'schema',
                    message: `expected ${VERIFICATION_ATTESTATION_SCHEMA}`,
                },
            ],
        };
    }
    const attestation = input;
    const signatureValid = verifyAttestationSignature(attestation, publicKey);
    if (!signatureValid) {
        issues.push({
            code: 'attestation-signature',
            path: 'signature',
            message: 'Ed25519 signature is invalid',
        });
    }
    const evidenceReport = await verifyEvidenceBundle(evidence, manifest);
    issues.push(...evidenceReport.issues);
    const expectedManifestDigest = await manifestDigest(manifest);
    const expectedEvidenceDigest = await evidenceBundleDigest(evidence);
    const comparisons = [
        ['subject.runId', attestation.subject?.runId, manifest.integrity.runId],
        ['subject.manifestDigest', attestation.subject?.manifestDigest, expectedManifestDigest],
        ['subject.traceRoot', attestation.subject?.traceRoot, manifest.integrity.traceRoot],
        ['subject.evidenceBundleDigest', attestation.subject?.evidenceBundleDigest, expectedEvidenceDigest],
        ['environment.suiteVersion', attestation.environment?.suiteVersion, manifest.suite.version],
        ['environment.harnessVersion', attestation.environment?.harnessVersion, manifest.run.harnessVersion],
        ['environment.harnessBuild', attestation.environment?.harnessBuild, manifest.run.harnessBuild],
        ['environment.envPinsDigest', attestation.environment?.envPinsDigest, manifest.run.envPinsDigest],
        ['evidence.verifierEvidenceRoot', attestation.evidence?.verifierEvidenceRoot, evidence.integrity.verifierEvidenceRoot],
        ['evidence.taskCount', attestation.evidence?.taskCount, evidence.integrity.taskCount],
        ['evidence.trialCount', attestation.evidence?.trialCount, evidence.integrity.trialCount],
        ['evidence.canaryClean', attestation.evidence?.canaryClean, evidence.integrity.canaryClean],
    ];
    for (const [path, actual, expected] of comparisons) {
        if (actual !== expected) {
            issues.push({
                code: 'attestation-claim',
                path,
                message: `attested ${String(actual)}, recomputed ${String(expected)}`,
            });
        }
    }
    if (attestation.signer?.algorithm !== 'Ed25519') {
        issues.push({
            code: 'attestation-algorithm',
            path: 'signer.algorithm',
            message: 'only Ed25519 is supported',
        });
    }
    if (attestation.decision?.verdict === 'verified' &&
        (!evidence.integrity.canaryClean ||
            !Array.isArray(attestation.decision.reasonCodes) ||
            attestation.decision.reasonCodes.length > 0)) {
        issues.push({
            code: 'attestation-policy',
            path: 'decision',
            message: 'verified decisions require clean evidence and no rejection reason codes',
        });
    }
    const valid = issues.length === 0;
    return {
        valid,
        verified: valid && attestation.decision?.verdict === 'verified',
        signatureValid,
        issues,
    };
}
