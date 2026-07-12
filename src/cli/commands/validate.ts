/** `nexbench validate <manifest.json>` — run the 12 intake checks locally. */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { categories } from '../../core/suite.js';
import type { CategoryId, RunManifest } from '../../core/types.js';
import { validateManifest, type KnownRun } from '../../core/validate.js';
import { type Args, c, dataPath, fail, loadJson, pad, statusMark } from '../util.js';

/** Load the bundled reference manifests as the duplicate-detection corpus. */
export function loadKnownRuns(dir: string): KnownRun[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  const runs: KnownRun[] = [];
  for (const f of files) {
    try {
      const m = loadJson<RunManifest>(join(dir, f));
      runs.push({
        runId: m.integrity.runId,
        traceRoot: m.integrity.traceRoot,
        agentId: m.agent.id,
        submitter: m.submitter.name,
        scores: Object.fromEntries(
          categories.map((cat) => [cat.id, m.results.categories[cat.id]?.passAt1 ?? 0]),
        ) as Record<CategoryId, number>,
      });
    } catch {
      /* skip malformed fixtures */
    }
  }
  return runs;
}

export async function validateCmd(args: Args): Promise<void> {
  const file = args._[0];
  if (!file) fail('usage: nexbench validate <manifest.json> [--known <dir>] [--json]');

  let manifest: unknown;
  try {
    manifest = loadJson(file);
  } catch (err) {
    fail(`could not read ${file}: ${(err as Error).message}`);
  }

  const knownDir = String(args.flags.known ?? dataPath('results'));
  let known = loadKnownRuns(knownDir);
  // Exclude an identical listed copy so re-validating a reference manifest
  // reports on its own merits rather than tripping the duplicate check.
  if (manifest && typeof manifest === 'object') {
    const rid = (manifest as RunManifest).integrity?.runId;
    if (rid) known = known.filter((k) => k.runId !== rid);
  }

  const report = await validateManifest(manifest, known);

  if (args.flags.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(report.ok ? 0 : 1);
  }

  process.stdout.write(`\n${c.bold('NEXBENCH validation')} · ${file}\n`);
  process.stdout.write(c.gray(`digest ${report.digest}\n\n`));
  for (const chk of report.checks) {
    const sev = chk.severity === 'error' ? c.gray('[error]') : c.gray('[warn ]');
    process.stdout.write(`  ${statusMark(chk.status)} ${sev} ${pad(chk.title, 26)} ${c.gray(chk.detail)}\n`);
  }
  const verdict = report.ok
    ? report.flagged
      ? c.yellow('ACCEPTED · held for manual review (flags present)')
      : c.green('ACCEPTED · eligible for the leaderboard')
    : c.red('REJECTED · fix the failing error-severity checks');
  process.stdout.write(`\n  ${c.bold('verdict')}  ${verdict}\n`);
  if (report.runId) process.stdout.write(`  ${c.bold('run id')}   ${report.runId}\n`);
  process.stdout.write('\n');
  process.exit(report.ok ? 0 : 1);
}
