/** `nexbench verify <manifest.json>` — recompute the integrity fields. */

import { categories, TOTAL_TASKS, TRIALS_PER_TASK } from '../../core/suite.js';
import { computeRunId, isOnTaskGrid, isOnTrialGrid, manifestDigest } from '../../core/integrity.js';
import { parseManifest } from '../../core/validate.js';
import { type Args, c, fail, loadJson, statusMark } from '../util.js';

export async function verifyCmd(args: Args): Promise<void> {
  const file = args._[0];
  if (!file) fail('usage: nexbench verify <manifest.json> [--json]');

  let raw: unknown;
  try {
    raw = loadJson(file);
  } catch (err) {
    fail(`could not read ${file}: ${(err as Error).message}`);
  }

  const parsed = parseManifest(raw);
  if (!parsed.ok) {
    fail(`not a valid manifest: ${parsed.issues.slice(0, 3).map((i) => `${i.path}: ${i.message}`).join(' · ')}`);
  }
  const m = parsed.data;

  const recomputed = await computeRunId(m);
  const digest = await manifestDigest(m);
  const runIdOk = recomputed === m.integrity.runId;
  const gridOk =
    categories.every((cat) => isOnTrialGrid(m.results.categories[cat.id].passAt1, cat.tasks)) &&
    isOnTaskGrid(m.results.metrics.passHat5, TOTAL_TASKS) &&
    isOnTaskGrid(m.results.metrics.svrPer100, TOTAL_TASKS);

  if (args.flags.json) {
    process.stdout.write(`${JSON.stringify({ runId: m.integrity.runId, recomputed, runIdOk, gridOk, digest }, null, 2)}\n`);
    process.exit(runIdOk && gridOk ? 0 : 1);
  }

  process.stdout.write(`\n${c.bold('NEXBENCH verify')} · ${file}\n\n`);
  process.stdout.write(`  ${statusMark(runIdOk ? 'pass' : 'fail')} run id       stored ${m.integrity.runId}\n`);
  process.stdout.write(`               recomputed ${recomputed}\n`);
  process.stdout.write(`  ${statusMark(gridOk ? 'pass' : 'fail')} trial grid   every rate on the m/(tasks·${TRIALS_PER_TASK}) grid\n`);
  process.stdout.write(`  ${c.gray('·')} digest       ${c.gray(digest)}\n\n`);
  process.exit(runIdOk && gridOk ? 0 : 1);
}
