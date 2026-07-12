/**
 * Trace recording. Every action, result, and per-trial outcome is captured so a
 * run is fully auditable and its trace archive hashes to a single Merkle root
 * (bound into the manifest as `integrity.traceRoot`). Verified runs publish
 * these traces alongside the score.
 */

import { canonicalJson, merkleRoot } from '../core/integrity.js';
import { CANARY } from '../core/suite.js';
import type { CategoryId, Difficulty } from '../core/types.js';
import type { Action, ActionResult, TrialOutcome } from '../env/types.js';

export type StepRecord = { step: number; action: Action; result: ActionResult };

export type TrialRecord = {
  trial: number;
  seed: number;
  outcome: TrialOutcome;
  steps: StepRecord[];
};

export type TaskRecord = {
  id: string;
  category: CategoryId;
  title: string;
  difficulty: Difficulty;
  trials: TrialRecord[];
  /** pass@1 over the trials, as a percentage. */
  passAt1: number;
  /** All trials passed (feeds pass^5). */
  passAll: boolean;
};

/** One canonical leaf per task, binding every recorded step and outcome. */
export function taskLeaf(task: TaskRecord): string {
  return canonicalJson({
    id: task.id,
    trials: task.trials.map((t) => ({
      trial: t.trial,
      seed: t.seed,
      passed: t.outcome.passed,
      violation: t.outcome.violation,
      steps: t.steps.map((s) => ({ step: s.step, action: s.action, ok: s.result.ok })),
    })),
  });
}

/** Merkle root over the task leaves in task order. */
export function traceRoot(tasks: readonly TaskRecord[]): Promise<string> {
  return merkleRoot(tasks.map(taskLeaf));
}

/**
 * Scan every agent-authored string in the trace for the canary GUID. A run is
 * contaminated (canary NOT clean) if the agent ever echoes the task-file canary
 * back into its output — a signal the task leaked into training or the prompt.
 */
export function canaryClean(tasks: readonly TaskRecord[]): boolean {
  for (const task of tasks) {
    for (const trial of task.trials) {
      for (const s of trial.steps) {
        const a = s.action;
        const emitted =
          a.type === 'note'
            ? a.text
            : a.type === 'corpus_query'
              ? a.query
              : a.type === 'submit'
                ? JSON.stringify(a.answer ?? null)
                : '';
        if (emitted.includes(CANARY)) return false;
      }
    }
  }
  return true;
}
