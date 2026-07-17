#!/usr/bin/env node
/**
 * Render a nexbench.dev report as Markdown, for CI summaries and PR comments.
 *
 *   node scripts/scorecard.mjs <dev-report.json> [--title "..."]
 *
 * Prints Markdown to stdout. When GITHUB_OUTPUT is set (i.e. inside a GitHub
 * Action), it also appends machine-readable outputs: pass-at-1, pass-hat-5,
 * svr, cost-per-task, tasks-run, canary-clean, trace-root.
 *
 * Everything here is derived from the report — this file never scores anything.
 */

import { appendFileSync, readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
  process.stderr.write('usage: scorecard.mjs <dev-report.json> [--title "..."]\n');
  process.exit(2);
}
const titleIdx = process.argv.indexOf('--title');
const title = titleIdx !== -1 ? process.argv[titleIdx + 1] : 'NEXBENCH';

let report;
try {
  report = JSON.parse(readFileSync(path, 'utf8'));
} catch (err) {
  process.stderr.write(`could not read a dev report at ${path}: ${err.message}\n`);
  process.exit(2);
}

const { suite, agent, run, results, integrity } = report;
const m = results.metrics;
const tasks = results.tasks ?? [];
const meanPassAt1 = tasks.length ? tasks.reduce((s, t) => s + t.passAt1, 0) / tasks.length : 0;

const pct = (n) => `${n.toFixed(1)}%`;
const mark = (t) => (t.passAll ? '✅' : t.passAt1 > 0 ? '🟡' : '❌');

const lines = [
  `### ${title} — \`${agent.name}\``,
  '',
  `\`${report.schema}\` · ${run.tasksRun} tasks × ${suite.trialsPerTask} trials · harness ${run.harnessVersion}`,
  '',
  '| metric | value | |',
  '|---|---:|---|',
  `| pass@1 (mean) | **${pct(meanPassAt1)}** | expected performance |`,
  `| pass^${suite.trialsPerTask} | **${pct(m.passHat5)}** | reliability — all trials pass |`,
  `| SVR / 100 tasks | **${m.svrPer100.toFixed(2)}** | safety violations |`,
  `| cost / task | $${m.costPerTaskUsd.toFixed(3)} | |`,
  `| median task | ${m.medianTaskSeconds.toFixed(1)}s | |`,
  '',
  '<details><summary>Per-task results</summary>',
  '',
  '| | task | category | pass@1 | detail |',
  '|---|---|---|---:|---|',
  ...tasks.map(
    (t) =>
      `| ${mark(t)} | \`${t.id}\` | ${t.category} | ${pct(t.passAt1)} | ${String(t.detail ?? '').slice(0, 80)} |`,
  ),
  '',
  '</details>',
  '',
  `<sub>canary ${integrity.canaryClean ? 'clean' : '**CONTAMINATED**'} · trace \`${integrity.traceRoot.slice(0, 23)}…\` · ${report.note ? 'development report, not a leaderboard manifest' : ''}</sub>`,
];

process.stdout.write(lines.join('\n') + '\n');

if (process.env.GITHUB_OUTPUT) {
  const out = [
    `pass-at-1=${meanPassAt1.toFixed(4)}`,
    `pass-hat-5=${m.passHat5}`,
    `svr=${m.svrPer100}`,
    `cost-per-task=${m.costPerTaskUsd}`,
    `tasks-run=${run.tasksRun}`,
    `canary-clean=${integrity.canaryClean}`,
    `trace-root=${integrity.traceRoot}`,
  ].join('\n');
  appendFileSync(process.env.GITHUB_OUTPUT, out + '\n');
}
