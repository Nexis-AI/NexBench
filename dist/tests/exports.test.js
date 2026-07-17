import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BENCH_VERSION, PACKAGE_VERSION } from 'nexbench/core';
import { EVIDENCE_BUNDLE_SCHEMA } from 'nexbench/evidence';
test('published subpaths separate browser-safe core from server evidence primitives', () => {
    assert.equal(PACKAGE_VERSION, '2.1.7');
    assert.equal(BENCH_VERSION, '2.1');
    assert.equal(EVIDENCE_BUNDLE_SCHEMA, 'nexbench.evidence/1.0');
});
