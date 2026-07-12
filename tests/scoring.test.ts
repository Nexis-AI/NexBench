import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ciHalfWidth, overallScore, rankEntries } from '../src/core/scoring.js';
import { categories, TOTAL_TASKS } from '../src/core/suite.js';
import type { BoardEntry, CategoryId } from '../src/core/types.js';

function flat(v: number): Record<CategoryId, number> {
  return Object.fromEntries(categories.map((c) => [c.id, v])) as Record<CategoryId, number>;
}

test('overall score is the task-count-weighted mean of category scores', () => {
  assert.equal(overallScore(flat(80)), 80);
  const mixed = { ...flat(0), execution: 100 } as Record<CategoryId, number>;
  // only the 32-task execution category is non-zero
  assert.ok(Math.abs(overallScore(mixed) - (100 * 32) / TOTAL_TASKS) < 1e-9);
});

test('CI half-width shrinks with more tasks', () => {
  const wide = ciHalfWidth(50, 20);
  const narrow = ciHalfWidth(50, 200);
  assert.ok(narrow < wide);
  assert.ok(wide > 0);
});

function entry(id: string, score: number, baseline?: 'human' | 'scripted'): BoardEntry {
  return {
    id,
    runId: `nbr1_${id.padEnd(16, '0')}`,
    name: id,
    scaffold: 's',
    model: 'm',
    runBy: 'r',
    openSource: true,
    verified: true,
    kind: 'community',
    date: '2026-07-01',
    scores: flat(score),
    passHat5: 0,
    svr: 0,
    gasOverspend: 0,
    costPerTask: 0,
    medianSeconds: 1,
    baseline,
  };
}

test('ranks skip baselines and assign 1-based order to agents', () => {
  const ranked = rankEntries([entry('a', 90), entry('human', 95, 'human'), entry('b', 70)]);
  const byId = Object.fromEntries(ranked.map((r) => [r.id, r]));
  assert.equal(byId.human!.rank, null);
  assert.equal(byId.a!.rank, 1);
  assert.equal(byId.b!.rank, 2);
});

test('overlapping confidence intervals mark a statistical tie', () => {
  // b (80.1) ranks 1; a (80.0) ranks 2 and, since their CIs overlap, is tied
  // with rank 1. The tie link is recorded on the lower-ranked entry.
  const ranked = rankEntries([entry('a', 80.0), entry('b', 80.1)]);
  const a = ranked.find((r) => r.id === 'a')!;
  const b = ranked.find((r) => r.id === 'b')!;
  assert.equal(b.rank, 1);
  assert.equal(a.rank, 2);
  assert.equal(a.tiedWithRank, 1);
});
