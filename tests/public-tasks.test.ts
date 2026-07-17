import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

import {
  PUBLIC_METADATA_ONLY_TASKS,
  PUBLIC_RUNNABLE_TASKS,
  PUBLIC_SPLIT,
} from '../src/core/suite.js';
import type { PublicTaskSpec } from '../src/core/types.js';
import { RUNNABLE_TASKS } from '../src/env/local/tasks.js';
import { loadJson, root } from './_util.js';

test('the public catalog is exactly 6 runnable-local plus 18 metadata-only specs', () => {
  const specs = loadJson<PublicTaskSpec[]>(join(root(), 'tasks', 'public-dev.json'));
  const runnable = specs.filter((task) => task.availability === 'runnable-local');
  const metadata = specs.filter((task) => task.availability === 'metadata-only');

  assert.equal(specs.length, PUBLIC_SPLIT);
  assert.equal(runnable.length, PUBLIC_RUNNABLE_TASKS);
  assert.equal(metadata.length, PUBLIC_METADATA_ONLY_TASKS);
  assert.deepEqual(
    new Set(runnable.map((task) => task.id)),
    new Set(RUNNABLE_TASKS.map((task) => task.id)),
  );
  for (const task of specs) {
    assert.equal(task.runnable, task.availability === 'runnable-local', task.id);
  }
});

test('init scaffold states its partial coverage without task-specific TODO markers', () => {
  const work = mkdtempSync(join(tmpdir(), 'nexbench-init-'));
  try {
    const cli = join(root(), 'dist', 'src', 'cli', 'index.js');
    const result = spawnSync(process.execPath, [cli, 'init', 'starter'], {
      cwd: work,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const adapter = readFileSync(join(work, 'starter', 'adapter.mjs'), 'utf8');
    const readme = readFileSync(join(work, 'starter', 'README.md'), 'utf8');
    assert.doesNotMatch(adapter, /TODO.*NB-/);
    assert.match(readme, /6 `runnable-local` tasks and 18 `metadata-only`/);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

