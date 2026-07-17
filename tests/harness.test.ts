import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CANARY } from '../src/core/suite.js';
import { RUNNABLE_TASKS } from '../src/env/local/tasks.js';
import type { Action, Observation } from '../src/env/types.js';
import { runSuite } from '../src/harness/run.js';
import { scriptedBaseline } from '../src/agents/scripted-baseline.js';
import { exampleAgent } from '../src/agents/example-agent.js';

test('the scripted baseline solves every runnable task (solvability floor)', async () => {
  const { report } = await runSuite(scriptedBaseline, RUNNABLE_TASKS, { completedAt: '2026-07-11' });
  for (const t of report.results.tasks) {
    assert.equal(t.passAt1, 100, `${t.id} must be solvable: ${t.detail}`);
  }
  assert.equal(report.results.metrics.passHat5, 100);
  assert.equal(report.results.metrics.svrPer100, 0);
  assert.equal(report.integrity.canaryClean, true);
});

test('runs are deterministic — same agent, byte-identical report', async () => {
  const a = await runSuite(scriptedBaseline, RUNNABLE_TASKS, { completedAt: '2026-07-11' });
  const b = await runSuite(scriptedBaseline, RUNNABLE_TASKS, { completedAt: '2026-07-11' });
  assert.equal(JSON.stringify(a.report), JSON.stringify(b.report));
  assert.equal(a.report.integrity.traceRoot, b.report.integrity.traceRoot);
});

test('the example agent is unreliable: pass^5 below mean pass@1', async () => {
  const { report } = await runSuite(exampleAgent, RUNNABLE_TASKS, { completedAt: '2026-07-11' });
  const meanPassAt1 =
    report.results.tasks.reduce((s, t) => s + t.passAt1, 0) / report.results.tasks.length;
  assert.ok(report.results.metrics.passHat5 < meanPassAt1, 'pass^5 should be strictly below pass@1');
  assert.ok(report.results.metrics.svrPer100 > 0, 'missed drainers should register as violations');
});

test('a canary-leaking agent is caught (contamination)', async () => {
  // An agent that echoes the task-file canary back in a note.
  const leaker = (obs: Observation): Action =>
    obs.step === 0 ? { type: 'note', text: `leak ${CANARY}` } : { type: 'submit' };
  const { report } = await runSuite(leaker, [RUNNABLE_TASKS[0]!], { completedAt: '2026-07-11' });
  assert.equal(report.integrity.canaryClean, false);
});

test('canary scanning covers RPC params and signing intents, not only notes', async () => {
  const leaker = (obs: Observation): Action =>
    obs.step === 0
      ? { type: 'rpc_call', method: 'getBalance', params: { echoed: CANARY } }
      : { type: 'submit' };
  const { report } = await runSuite(leaker, [RUNNABLE_TASKS[0]!], {
    completedAt: '2026-07-11',
  });
  assert.equal(report.integrity.canaryClean, false);
});

test('budget overrun fails the trial', async () => {
  // An agent that only ever notes never submits; it exhausts maxSteps and fails.
  const staller = (): Action => ({ type: 'note', text: 'thinking…' });
  const { report } = await runSuite(staller, [RUNNABLE_TASKS[0]!], { completedAt: '2026-07-11' });
  assert.equal(report.results.tasks[0]!.passAt1, 0);
});
