import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateManifest, parseManifest } from '../src/core/validate.js';
import { categories } from '../src/core/suite.js';
import { referenceManifests } from './_util.js';
function knownFrom(manifests, exclude) {
    return manifests
        .filter((m) => m.integrity.runId !== exclude)
        .map((m) => ({
        runId: m.integrity.runId,
        traceRoot: m.integrity.traceRoot,
        agentId: m.agent.id,
        submitter: m.submitter.name,
        scores: Object.fromEntries(categories.map((c) => [c.id, m.results.categories[c.id].passAt1])),
    }));
}
test('every reference manifest passes all twelve checks', async () => {
    const all = referenceManifests().map((r) => r.manifest);
    for (const m of all) {
        const report = await validateManifest(m, knownFrom(all, m.integrity.runId));
        assert.equal(report.ok, true, `${m.agent.id}: ${report.checks.filter((c) => c.status === 'fail').map((c) => c.title).join(', ')}`);
        assert.equal(report.flagged, false, `${m.agent.id} should not be flagged`);
    }
});
test('a single tampered score fails run-id AND trial-grid', async () => {
    const base = referenceManifests()[0].manifest;
    const tampered = structuredClone(base);
    tampered.results.categories.execution.passAt1 = 99.0; // pretty + wrong hash
    const report = await validateManifest(tampered, []);
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c.status]));
    assert.equal(byId['run-id'], 'fail');
    assert.equal(byId['trial-grid'], 'fail');
    assert.equal(report.ok, false);
});
test('resubmitting a listed run collides on runId', async () => {
    const all = referenceManifests().map((r) => r.manifest);
    const m = all[0];
    const report = await validateManifest(m, knownFrom(all)); // includes m itself
    const dup = report.checks.find((c) => c.id === 'duplicate');
    assert.equal(dup?.status, 'fail');
});
test('replaying another run\'s trace archive collides on traceRoot', async () => {
    const all = referenceManifests().map((r) => r.manifest);
    const victim = all[1];
    const clone = structuredClone(all[0]);
    // Give the clone a fresh, non-colliding runId (change a run-id-basis field)
    // so the duplicate check falls through to the trace-root comparison.
    clone.run.completedAt = '2000-01-01';
    clone.integrity.traceRoot = victim.integrity.traceRoot;
    const { computeRunId } = await import('../src/core/integrity.js');
    clone.integrity.runId = await computeRunId(clone);
    const report = await validateManifest(clone, knownFrom(all));
    const dup = report.checks.find((c) => c.id === 'duplicate');
    assert.equal(dup?.status, 'fail');
    assert.match(dup?.detail ?? '', /replayed traces/);
});
test('a bad contact fails identity', async () => {
    const m = structuredClone(referenceManifests()[0].manifest);
    m.submitter.contact = 'not-a-contact';
    const { computeRunId } = await import('../src/core/integrity.js');
    m.integrity.runId = await computeRunId(m);
    const report = await validateManifest(m, []);
    assert.equal(report.checks.find((c) => c.id === 'identity')?.status, 'fail');
});
test('an unexpected top-level field is flagged, not failed', async () => {
    const m = structuredClone(referenceManifests()[0].manifest);
    m.spoof = { badge: 'verified' };
    const report = await validateManifest(m, []);
    const chk = report.checks.find((c) => c.id === 'unknown-keys');
    assert.equal(chk?.status, 'flag');
    assert.equal(report.flagged, true);
    assert.equal(report.ok, true); // warn severity does not block intake
});
test('parseManifest rejects a malformed manifest with a path/message', () => {
    const res = parseManifest({ schema: 'nexbench.run/2.1', suite: {} });
    assert.equal(res.ok, false);
    if (!res.ok)
        assert.ok(res.issues.some((i) => i.path.startsWith('suite')));
});
