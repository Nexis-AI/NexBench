import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evidenceEndpointFor, uploadBytesDigest } from '../src/cli/commands/submit.js';
import { SUBMIT_ENDPOINT } from '../src/core/suite.js';
import { evidenceBundleDigest } from '../src/evidence.js';
test('evidence uploads use the sibling durable evidence endpoint', () => {
    assert.equal(SUBMIT_ENDPOINT, 'https://nex-t1.ai/api/v1/nexbench/submissions');
    assert.equal(evidenceEndpointFor(SUBMIT_ENDPOINT), 'https://nex-t1.ai/api/v1/nexbench/evidence');
    assert.equal(evidenceEndpointFor('https://bench.example.test/v1/submissions/'), 'https://bench.example.test/v1/evidence');
});
test('upload receipts hash exact pretty-printed bytes, not canonical evidence JSON', async () => {
    const evidence = { schema: 'nexbench.evidence/1.0', nested: { value: 1 } };
    const prettyBytes = Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`);
    const compactBytes = Buffer.from(JSON.stringify(evidence));
    assert.notEqual(uploadBytesDigest(prettyBytes), uploadBytesDigest(compactBytes));
    assert.notEqual(uploadBytesDigest(prettyBytes), await evidenceBundleDigest(evidence));
    assert.equal(uploadBytesDigest(prettyBytes), 'sha256:5fe6bffd9d7de785e48b8266bdc133910fcecfb47a6dfb8954e8bb8b7b2b9b06');
});
