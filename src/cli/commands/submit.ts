/** `nexbench submit <manifest.json>` — validate locally, then POST to intake. */

import { SUBMIT_ENDPOINT } from '../../core/suite.js';
import { validateManifest } from '../../core/validate.js';
import { type Args, c, dataPath, fail, loadJson } from '../util.js';
import { loadKnownRuns } from './validate.js';

export async function submitCmd(args: Args): Promise<void> {
  const file = args._[0];
  if (!file) fail('usage: nexbench submit <manifest.json> [--endpoint <url>] [--yes]');

  let manifest: unknown;
  try {
    manifest = loadJson(file);
  } catch (err) {
    fail(`could not read ${file}: ${(err as Error).message}`);
  }

  // Validate against the same checks the intake API enforces, so a submission
  // never leaves the machine unless it would be accepted.
  const known = loadKnownRuns(String(args.flags.known ?? dataPath('results')));
  const report = await validateManifest(manifest, known);
  if (!report.ok) {
    process.stderr.write(c.red('local validation failed — not submitting. Run `nexbench validate` for details.\n'));
    for (const chk of report.checks.filter((x) => x.severity === 'error' && x.status === 'fail')) {
      process.stderr.write(`  ${c.red('✗')} ${chk.title}: ${chk.detail}\n`);
    }
    process.exit(1);
  }

  const endpoint = String(args.flags.endpoint ?? SUBMIT_ENDPOINT);
  process.stdout.write(`${c.green('✓')} local validation passed — run id ${c.cyan(report.runId ?? '')}\n`);
  if (report.flagged) process.stdout.write(c.yellow('  note: warn-level flags present — the entry will be held for manual review.\n'));

  if (!args.flags.yes) {
    process.stdout.write(`\n${c.bold('dry run.')} This would POST the manifest to:\n  ${endpoint}\n`);
    process.stdout.write(c.dim('Re-run with --yes to submit for real.\n'));
    return;
  }

  process.stdout.write(c.dim(`\nsubmitting to ${endpoint}…\n`));
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(manifest),
    });
  } catch (err) {
    fail(`network error: ${(err as Error).message}`);
  }
  const text = await res.text();
  if (!res.ok) fail(`intake returned ${res.status}: ${text.slice(0, 400)}`);
  process.stdout.write(`${c.green('submitted.')} ${text.slice(0, 600)}\n`);
}
