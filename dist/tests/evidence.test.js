import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { assembleManifest } from '../src/core/manifest.js';
import { computeRunId } from '../src/core/integrity.js';
import { categories, TOTAL_TASKS, TRIALS_PER_TASK } from '../src/core/suite.js';
import { buildEvidenceBundle, createVerificationAttestation, parseEvidenceBundle, verifyAttestationSignature, verifyEvidenceBundle, verifyVerificationAttestation, } from '../src/evidence.js';
import { scriptedBaseline } from '../src/agents/scripted-baseline.js';
import { RUNNABLE_TASKS } from '../src/env/local/tasks.js';
import { runSuite } from '../src/harness/run.js';
import { createVerifierEvidence, traceRoot, } from '../src/harness/trace.js';
test('public-dev evidence recomputes trace, verifier, and canary claims', async () => {
    const { report, records } = await runSuite(scriptedBaseline, RUNNABLE_TASKS, {
        completedAt: '2026-07-16',
    });
    const bundle = await buildEvidenceBundle({
        records,
        mode: 'public-dev',
        completedAt: report.run.completedAt,
        generatedAt: '2026-07-16T12:00:00.000Z',
    });
    const verification = await verifyEvidenceBundle(bundle);
    assert.equal(verification.ok, true, JSON.stringify(verification.issues));
    assert.deepEqual(verification.reasonCodes, []);
    assert.equal(parseEvidenceBundle(bundle).ok, true);
    assert.equal(parseEvidenceBundle({ schema: 'wrong' }).ok, false);
    assert.equal(parseEvidenceBundle({ ...structuredClone(bundle), tasks: [] }).ok, false);
    const emptyTrials = structuredClone(bundle);
    emptyTrials.tasks[0].trials = [];
    assert.equal(parseEvidenceBundle(emptyTrials).ok, false);
    assert.equal(bundle.subject.runId, null);
    assert.equal(bundle.subject.manifestDigest, null);
    assert.equal(bundle.subject.traceRoot, report.integrity.traceRoot);
    assert.equal(bundle.integrity.taskCount, 6);
    assert.equal(bundle.integrity.trialCount, 6 * TRIALS_PER_TASK);
    assert.equal(bundle.integrity.canaryClean, true);
    assert.equal(verification.recomputed.evidenceBundleDigest, verification.recomputed.digest);
});
test('tampering with a recorded action result breaks both trace and verifier evidence', async () => {
    const { report, records } = await runSuite(scriptedBaseline, RUNNABLE_TASKS.slice(0, 1), {
        completedAt: '2026-07-16',
    });
    const bundle = await buildEvidenceBundle({
        records,
        mode: 'public-dev',
        completedAt: report.run.completedAt,
        generatedAt: '2026-07-16T12:00:00.000Z',
    });
    const tampered = structuredClone(bundle);
    tampered.tasks[0].trials[0].steps[0].result.ok =
        !tampered.tasks[0].trials[0].steps[0].result.ok;
    const verification = await verifyEvidenceBundle(tampered);
    assert.equal(verification.ok, false);
    assert.ok(verification.issues.some((issue) => issue.code === 'trace-root'));
    assert.ok(verification.issues.some((issue) => issue.code === 'verifier-digest'));
});
async function completeFullRecords() {
    const records = [];
    for (let index = 0; index < TOTAL_TASKS; index++) {
        let category = categories[0];
        let upperBound = 0;
        for (const candidate of categories) {
            upperBound += candidate.tasks;
            if (index < upperBound) {
                category = candidate;
                break;
            }
        }
        const id = `NB-FULL-${String(index + 1).padStart(3, '0')}`;
        const trials = [];
        for (let trial = 0; trial < TRIALS_PER_TASK; trial++) {
            const base = {
                trial,
                seed: index * 100 + trial,
                outcome: {
                    passed: true,
                    violation: false,
                    costUsd: 0.1,
                    gasOverspendPct: 0,
                    seconds: 1,
                    steps: 1,
                    detail: 'programmatic verifier passed',
                },
                steps: [
                    {
                        step: 0,
                        action: { type: 'submit', answer: { task: id, trial } },
                        result: { ok: true },
                    },
                ],
            };
            trials.push({
                ...base,
                verifier: await createVerifierEvidence(id, base, {
                    id: `${id}/reference-checker`,
                }),
            });
        }
        records.push({
            id,
            category: category.id,
            title: `Full task ${index + 1}`,
            difficulty: 'medium',
            trials,
            passAt1: 100,
            passAll: true,
        });
    }
    return records;
}
test('a complete evidence bundle can be signed and independently verified', async () => {
    const records = await completeFullRecords();
    const root = await traceRoot(records);
    const draft = {
        agent: {
            id: 'attested-agent',
            name: 'Attested Agent',
            scaffold: 'test-harness',
            model: 'test-model',
        },
        submitter: { name: 'NEXBENCH Test', contact: 'test@nexis.ai' },
        categories: Object.fromEntries(categories.map((category) => [category.id, 100])),
        metrics: {
            passHat5: 100,
            svrPer100: 0,
            gasOverspendPct: 0,
            costPerTaskUsd: 0.1,
            medianTaskSeconds: 1,
        },
        integrity: { traceRoot: root, canaryClean: true },
        run: { completedAt: '2026-07-16' },
    };
    const manifest = await assembleManifest(draft);
    const bundle = await buildEvidenceBundle({
        records,
        mode: 'full',
        completedAt: manifest.run.completedAt,
        generatedAt: '2026-07-16T12:00:00.000Z',
        manifest,
    });
    const evidenceVerification = await verifyEvidenceBundle(bundle, manifest);
    assert.equal(evidenceVerification.ok, true);
    assert.equal(evidenceVerification.recomputed.results?.categories.execution?.passAt1, 100);
    assert.equal(evidenceVerification.recomputed.results?.metrics.passHat5, 100);
    assert.equal(evidenceVerification.recomputed.results?.metrics.gasOverspendPct, 0);
    const dishonestManifest = structuredClone(manifest);
    dishonestManifest.results.categories.execution.passAt1 = 99.375;
    dishonestManifest.integrity.runId = await computeRunId(dishonestManifest);
    const dishonestVerification = await verifyEvidenceBundle(bundle, dishonestManifest);
    assert.equal(dishonestVerification.ok, false);
    assert.ok(dishonestVerification.reasonCodes.includes('score-mismatch'));
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const attestation = await createVerificationAttestation({
        manifest,
        evidence: bundle,
        decision: {
            verdict: 'verified',
            issuedAt: '2026-07-16T12:30:00.000Z',
            verifier: { id: 'nexbench-reference-service', version: '1.0.0' },
            reasonCodes: [],
        },
        signer: { keyId: 'nexbench-test-key-1' },
    }, privateKey);
    const verification = await verifyVerificationAttestation(attestation, publicKey, manifest, bundle);
    assert.equal(verification.valid, true, JSON.stringify(verification.issues));
    assert.equal(verification.verified, true);
    assert.equal(verification.signatureValid, true);
    assert.equal(verifyAttestationSignature(attestation, publicKey), true);
    const tampered = structuredClone(attestation);
    tampered.evidence.taskCount -= 1;
    const rejected = await verifyVerificationAttestation(tampered, publicKey, manifest, bundle);
    assert.equal(rejected.valid, false);
    assert.equal(rejected.signatureValid, false);
    assert.equal(verifyAttestationSignature(tampered, publicKey), false);
    assert.ok(rejected.issues.some((issue) => issue.code === 'attestation-claim'));
});
