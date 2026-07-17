import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assembleManifest } from '../src/core/manifest.js';
import { computeRunId } from '../src/core/integrity.js';
import { categories } from '../src/core/suite.js';
import { validateManifest } from '../src/core/validate.js';
function draft() {
    return {
        agent: { id: 'test-agent', name: 'Test Agent', scaffold: 'custom', model: 'gpt-5.5' },
        submitter: { name: 'Tester', contact: 'tester@lab.xyz' },
        categories: Object.fromEntries(categories.map((c) => [c.id, 70])),
        metrics: {
            passHat5: 40,
            svrPer100: 2,
            gasOverspendPct: 3.4,
            costPerTaskUsd: 1.1,
            medianTaskSeconds: 130,
        },
        integrity: {
            traceRoot: 'sha256:' + 'a'.repeat(64),
            canaryClean: true,
        },
    };
}
test('assembleManifest snaps rates onto the trial grid', async () => {
    const m = await assembleManifest(draft());
    // 70% is not on the 32*5 grid; it must be snapped to the nearest achievable value.
    const exe = m.results.categories.execution.passAt1;
    const units = (exe / 100) * 32 * 5;
    assert.ok(Math.abs(units - Math.round(units)) < 1e-6, `${exe} must land on the grid`);
});
test('assembled manifest has a self-consistent, recomputable run id', async () => {
    const m = await assembleManifest(draft());
    assert.match(m.integrity.runId, /^nbr1_[0-9a-f]{16}$/);
    assert.equal(await computeRunId(m), m.integrity.runId);
});
test('an assembled manifest passes validation', async () => {
    const m = await assembleManifest(draft());
    const report = await validateManifest(m, []);
    const failures = report.checks.filter((c) => c.severity === 'error' && c.status === 'fail');
    assert.equal(failures.length, 0, failures.map((f) => `${f.title}: ${f.detail}`).join('; '));
    assert.equal(report.ok, true);
});
