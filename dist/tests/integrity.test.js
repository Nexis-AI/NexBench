import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalJson, computeRunId, isOnTaskGrid, isOnTrialGrid, manifestDigest, merkleRoot, sha256Hex, snapToTrialGrid, } from '../src/core/integrity.js';
import { categories, ENV_PINS_DIGEST, TOTAL_TASKS } from '../src/core/suite.js';
import { referenceManifests } from './_util.js';
test('canonicalJson sorts object keys recursively and preserves array order', () => {
    const a = canonicalJson({ b: 1, a: { d: 4, c: [3, 1, 2] } });
    const b = canonicalJson({ a: { c: [3, 1, 2], d: 4 }, b: 1 });
    assert.equal(a, b);
    assert.equal(a, '{"a":{"c":[3,1,2],"d":4},"b":1}');
});
test('sha256Hex matches the known empty-string vector and is stable', async () => {
    assert.equal(await sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.equal(await sha256Hex('nexbench'), await sha256Hex('nexbench'));
    assert.notEqual(await sha256Hex('a'), await sha256Hex('b'));
});
test('computeRunId reproduces every published reference run id (site parity)', async () => {
    for (const { file, manifest } of referenceManifests()) {
        const recomputed = await computeRunId(manifest);
        assert.equal(recomputed, manifest.integrity.runId, `${file}: run id must recompute`);
    }
});
test('editing any results value breaks the run id', async () => {
    const { manifest } = referenceManifests()[0];
    const tampered = structuredClone(manifest);
    tampered.results.metrics.costPerTaskUsd += 0.01;
    const recomputed = await computeRunId(tampered);
    assert.notEqual(recomputed, manifest.integrity.runId);
});
test('published reference rates all sit on the trial grid', () => {
    for (const { file, manifest } of referenceManifests()) {
        for (const c of categories) {
            const p = manifest.results.categories[c.id].passAt1;
            assert.ok(isOnTrialGrid(p, c.tasks), `${file} ${c.code} ${p} must be on the grid`);
        }
        assert.ok(isOnTaskGrid(manifest.results.metrics.passHat5, TOTAL_TASKS), `${file} pass^5`);
        assert.ok(isOnTaskGrid(manifest.results.metrics.svrPer100, TOTAL_TASKS), `${file} SVR`);
    }
});
test('off-grid "pretty" numbers are rejected; snapping repairs them', () => {
    // 32-task category: grid step is 100/(32*5) = 0.625%. Values like 81 and 77
    // are not multiples of the step and must be rejected.
    assert.equal(isOnTrialGrid(81, 32), false);
    assert.equal(isOnTrialGrid(77, 32), false);
    assert.equal(isOnTrialGrid(61, 26), false); // 0.61·130 = 79.3, off the grid
    assert.equal(isOnTrialGrid(snapToTrialGrid(81, 32), 32), true);
    // ...but a genuinely achievable value (94/130) passes.
    assert.equal(isOnTrialGrid(72.3077, 26), true);
});
test('merkleRoot is deterministic and order-sensitive', async () => {
    const r1 = await merkleRoot(['a', 'b', 'c']);
    const r2 = await merkleRoot(['a', 'b', 'c']);
    const r3 = await merkleRoot(['c', 'b', 'a']);
    assert.equal(r1, r2);
    assert.notEqual(r1, r3);
    assert.equal(r1, 'sha256:0bdf27bf7ec894ca7cadfe491ec1a3ece840f117989e8c5e9bd7086467bf6c38');
});
test('manifestDigest is stable across key ordering', async () => {
    const d1 = await manifestDigest({ x: 1, y: 2 });
    const d2 = await manifestDigest({ y: 2, x: 1 });
    assert.equal(d1, d2);
});
test('the pinned environment set hashes to the published digest', async () => {
    const { loadJson } = await import('./_util.js');
    const { root } = await import('./_util.js');
    const { join } = await import('node:path');
    const pins = loadJson(join(root(), 'environments', 'pins.json'));
    const digest = `sha256:${await sha256Hex(canonicalJson(pins.environments))}`;
    assert.equal(digest, ENV_PINS_DIGEST);
});
