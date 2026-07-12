/** `nexbench run` — execute the runnable public-dev suite with an agent. */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { categoryById } from '../../core/suite.js';
import { RUNNABLE_TASKS } from '../../env/local/tasks.js';
import type { Action, AgentLike, Observation } from '../../env/types.js';
import { runSuite, type DevReport } from '../../harness/run.js';
import { exampleAgent } from '../../agents/example-agent.js';
import { scriptedBaseline } from '../../agents/scripted-baseline.js';
import { type Args, bar, c, fail, pad, padStart } from '../util.js';

async function resolveAgent(spec: string): Promise<{ agent: AgentLike; label: string }> {
  if (spec === 'scripted' || spec === 'baseline') return { agent: scriptedBaseline, label: 'scripted-baseline' };
  if (spec === 'example') return { agent: exampleAgent, label: 'example-agent' };
  if (/^https?:\/\//.test(spec)) return { agent: endpointAgent(spec), label: `endpoint:${spec}` };
  // Otherwise treat as a path to a JS module exporting a default StepFn/Agent.
  const mod = (await import(spec)) as { default?: AgentLike };
  if (!mod.default) fail(`agent module ${spec} has no default export`);
  return { agent: mod.default as AgentLike, label: spec };
}

/** Wrap an HTTP `/step` endpoint as an agent (language-agnostic adapters). */
function endpointAgent(url: string): AgentLike {
  return async (obs: Observation): Promise<Action> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(obs),
    });
    if (!res.ok) throw new Error(`endpoint ${url} returned ${res.status}`);
    return (await res.json()) as Action;
  };
}

export async function runCmd(args: Args): Promise<void> {
  const spec = String(args.flags.agent ?? 'example');
  const trials = args.flags.trials ? Number(args.flags.trials) : undefined;
  const { agent, label } = await resolveAgent(spec);

  process.stderr.write(c.dim(`running ${RUNNABLE_TASKS.length} runnable public-dev tasks with "${label}"…\n`));
  const { report, records } = await runSuite(agent, RUNNABLE_TASKS, {
    trials,
    agent: { id: label.replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 63) || 'dev-agent', name: label, scaffold: 'nexbench-local', model: spec },
    onProgress: (m) => process.stderr.write(c.gray(`  ${m}\n`)),
  });

  if (args.flags.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printScorecard(report);
  }

  // Persist the run: dev report + per-task trace records.
  const stamp = report.run.completedAt.replace(/-/g, '') + '-' + label.replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 24);
  const outDir = String(args.flags.out ?? join('runs', stamp));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'dev-report.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(outDir, 'trace.json'), JSON.stringify(records, null, 2));
  process.stderr.write(c.dim(`\nwrote ${join(outDir, 'dev-report.json')} and trace.json\n`));
}

function printScorecard(report: DevReport): void {
  const { results } = report;
  process.stdout.write(`\n${c.bold('NEXBENCH')} ${c.dim('public-dev')} · agent ${c.cyan(report.agent.name)}\n`);
  process.stdout.write(c.gray(`schema ${report.schema} · ${results.tasks.length} tasks · ${report.suite.trialsPerTask} trials each\n\n`));

  process.stdout.write(c.bold(`${pad('TASK', 12)}${pad('CATEGORY', 12)}${pad('pass@1', 9)}  RESULT\n`));
  for (const t of results.tasks) {
    const passStr = `${t.passAt1.toFixed(1)}%`;
    const mark = t.passAll ? c.green('all-pass') : t.passAt1 > 0 ? c.yellow('partial') : c.red('fail');
    process.stdout.write(`${pad(t.id, 12)}${pad(categoryById(t.category).code, 12)}${pad(passStr, 9)}  ${mark}  ${c.gray(t.detail.slice(0, 60))}\n`);
  }

  process.stdout.write(`\n${c.bold('CATEGORY pass@1')}\n`);
  for (const [cat, v] of Object.entries(results.categories)) {
    if (!v) continue;
    process.stdout.write(`${pad(categoryById(cat as never).label, 26)} ${c.cyan(bar(v.passAt1))} ${padStart(v.passAt1.toFixed(1) + '%', 7)}\n`);
  }

  const m = results.metrics;
  process.stdout.write(`\n${c.bold('METRICS')}\n`);
  process.stdout.write(`  pass^${report.suite.trialsPerTask} (all-trials)   ${padStart(m.passHat5.toFixed(1) + '%', 8)}   ${c.gray('reliability')}\n`);
  process.stdout.write(`  SVR / 100 tasks       ${padStart(m.svrPer100.toFixed(2), 8)}   ${c.gray('safety violations')}\n`);
  process.stdout.write(`  cost / task           ${padStart('$' + m.costPerTaskUsd.toFixed(3), 8)}\n`);
  process.stdout.write(`  median task seconds   ${padStart(m.medianTaskSeconds.toFixed(1), 8)}\n`);
  process.stdout.write(`\n  trace root  ${c.gray(report.integrity.traceRoot)}\n`);
  process.stdout.write(`  canary      ${report.integrity.canaryClean ? c.green('clean') : c.red('CONTAMINATED')}\n`);
  process.stdout.write(c.dim(`\n${report.note}\n`));
}
