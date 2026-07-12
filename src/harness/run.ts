/**
 * The run loop. The harness — not the agent — owns the clock, the step budget,
 * and the trial seeds. For each task it runs k independent trials, grades each
 * with the task's programmatic checker, and aggregates onto the same trial grid
 * the leaderboard uses. The output is a `nexbench.dev/2.1` development report:
 * a real, reproducible score over the runnable public split, explicitly NOT a
 * leaderboard manifest (that requires the full reference environment).
 */

import { BENCH_DEV_SCHEMA, BENCH_NAME, BENCH_VERSION, HARNESS_VERSION, TASK_COST_CAP_USD, TASK_TIMEOUT_S, TRIALS_PER_TASK } from '../core/suite.js';
import type { AgentClass, CategoryId, Difficulty } from '../core/types.js';
import { asAgent, type ActionResult, type AgentLike, type Observation, type TaskModule, type TrialOutcome } from '../env/types.js';
import { canaryClean, traceRoot, type StepRecord, type TaskRecord, type TrialRecord } from './trace.js';

export type DevTaskResult = {
  id: string;
  category: CategoryId;
  title: string;
  difficulty: Difficulty;
  passAt1: number;
  passAll: boolean;
  detail: string;
};

export type DevReport = {
  schema: string;
  suite: { name: string; version: string; trialsPerTask: number; mode: 'public-dev' };
  agent: { id: string; name: string; scaffold: string; model: string; class: AgentClass; openSource: boolean };
  run: { completedAt: string; harnessVersion: string; tasksRun: number };
  results: {
    categories: Partial<Record<CategoryId, { passAt1: number; tasks: number }>>;
    tasks: DevTaskResult[];
    metrics: {
      passHat5: number;
      svrPer100: number;
      gasOverspendPct: number;
      costPerTaskUsd: number;
      medianTaskSeconds: number;
    };
  };
  integrity: { traceRoot: string; canaryClean: boolean };
  note: string;
};

export type RunOptions = {
  trials?: number;
  completedAt?: string;
  agent?: Partial<DevReport['agent']>;
  onProgress?: (msg: string) => void;
};

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Run k trials of each task and produce trace records + a dev report. */
export async function runSuite(
  agentLike: AgentLike,
  tasks: readonly TaskModule[],
  opts: RunOptions = {},
): Promise<{ report: DevReport; records: TaskRecord[] }> {
  const agent = asAgent(agentLike);
  const k = opts.trials ?? TRIALS_PER_TASK;
  const records: TaskRecord[] = [];

  for (const task of tasks) {
    opts.onProgress?.(`run ${task.id} (${task.category})`);
    const trials: TrialRecord[] = [];
    for (let trial = 0; trial < k; trial++) {
      trials.push(await runTrial(agent, task, trial));
    }
    const passes = trials.filter((t) => t.outcome.passed).length;
    records.push({
      id: task.id,
      category: task.category,
      title: task.title,
      difficulty: task.difficulty,
      trials,
      passAt1: (passes / k) * 100,
      passAll: passes === k,
    });
  }

  const report = await buildDevReport(records, k, opts);
  return { report, records };
}

async function runTrial(
  agent: ReturnType<typeof asAgent>,
  task: TaskModule,
  trial: number,
): Promise<TrialRecord> {
  const { hashSeed } = await import('./rng.js');
  const seed = hashSeed(task.id, trial);
  const env = task.build(seed);
  agent.reset?.(task.id, trial);

  const steps: StepRecord[] = [];
  let last: ActionResult | undefined;
  let brokeBudget = false;

  for (let step = 0; step < task.maxSteps; step++) {
    const usage = env.usage();
    const obs: Observation = {
      task: { id: task.id, category: task.category, title: task.title, difficulty: task.difficulty, brief: task.brief },
      step,
      wallet: { address: env.walletAddress, chain: env.chain },
      last,
      budget: {
        stepsRemaining: task.maxSteps - step,
        secondsRemaining: TASK_TIMEOUT_S - usage.seconds,
        usdRemaining: TASK_COST_CAP_USD - usage.costUsd,
      },
    };

    let action;
    try {
      action = await Promise.resolve(agent.step(obs));
    } catch (err) {
      last = { ok: false, error: `agent error: ${(err as Error).message}` };
      steps.push({ step, action: { type: 'note', text: '<agent-error>' }, result: last });
      break;
    }

    const result = env.apply(action);
    steps.push({ step, action, result });
    last = result;

    const after = env.usage();
    if (after.costUsd > TASK_COST_CAP_USD || after.seconds > TASK_TIMEOUT_S) {
      brokeBudget = true;
      break;
    }
    if (env.isDone()) break;
  }

  const usage = env.usage();
  const graded = env.score();
  const outcome: TrialOutcome = {
    passed: graded.passed && !brokeBudget,
    violation: graded.violation,
    costUsd: usage.costUsd,
    seconds: usage.seconds,
    steps: steps.length,
    detail: brokeBudget ? `budget exceeded; ${graded.detail}` : graded.detail,
  };
  return { trial, seed, outcome, steps };
}

async function buildDevReport(
  records: readonly TaskRecord[],
  k: number,
  opts: RunOptions,
): Promise<DevReport> {
  const byCategory = new Map<CategoryId, number[]>();
  for (const r of records) {
    const arr = byCategory.get(r.category) ?? [];
    arr.push(r.passAt1);
    byCategory.set(r.category, arr);
  }
  const categories: DevReport['results']['categories'] = {};
  for (const [cat, scores] of byCategory) {
    categories[cat] = { passAt1: Number(mean(scores).toFixed(4)), tasks: scores.length };
  }

  const allTrials = records.flatMap((r) => r.trials);
  const violations = allTrials.filter((t) => t.outcome.violation).length;
  const passHat5 = (records.filter((r) => r.passAll).length / records.length) * 100;

  const metrics = {
    passHat5: Number(passHat5.toFixed(4)),
    svrPer100: Number(((violations / allTrials.length) * 100).toFixed(4)),
    gasOverspendPct: 0, // the local world has no gas oracle
    costPerTaskUsd: Number(mean(allTrials.map((t) => t.outcome.costUsd)).toFixed(4)),
    medianTaskSeconds: Number(median(allTrials.map((t) => t.outcome.seconds)).toFixed(3)),
  };

  const agent = {
    id: opts.agent?.id ?? 'dev-agent',
    name: opts.agent?.name ?? 'Dev Agent',
    scaffold: opts.agent?.scaffold ?? 'nexbench-local',
    model: opts.agent?.model ?? 'unknown',
    class: opts.agent?.class ?? ('agent' as AgentClass),
    openSource: opts.agent?.openSource ?? true,
  };

  return {
    schema: BENCH_DEV_SCHEMA,
    suite: { name: BENCH_NAME, version: BENCH_VERSION, trialsPerTask: k, mode: 'public-dev' },
    agent,
    run: {
      completedAt: opts.completedAt ?? new Date().toISOString().slice(0, 10),
      harnessVersion: HARNESS_VERSION,
      tasksRun: records.length,
    },
    results: {
      categories,
      tasks: records.map((r) => ({
        id: r.id,
        category: r.category,
        title: r.title,
        difficulty: r.difficulty,
        passAt1: Number(r.passAt1.toFixed(4)),
        passAll: r.passAll,
        detail: r.trials[0]?.outcome.detail ?? '',
      })),
      metrics,
    },
    integrity: { traceRoot: await traceRoot(records), canaryClean: canaryClean(records) },
    note: 'Development report over the runnable public split (nexbench.dev/2.1). NOT a leaderboard manifest — the full 214-task suite runs against the pinned reference environment. See docs/environments.md.',
  };
}
