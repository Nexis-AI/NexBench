/** `nexbench mint --from <draft.json>` — assemble a hash-valid manifest. */

import { writeFileSync } from 'node:fs';

import { assembleManifest, type ManifestDraft } from '../../core/manifest.js';
import { type Args, c, fail, loadJson } from '../util.js';

export async function mintCmd(args: Args): Promise<void> {
  const from = args.flags.from ? String(args.flags.from) : args._[0];
  if (!from) fail('usage: nexbench mint --from <draft.json> [--out <manifest.json>]');

  let draft: ManifestDraft;
  try {
    draft = loadJson<ManifestDraft>(from);
  } catch (err) {
    fail(`could not read ${from}: ${(err as Error).message}`);
  }

  const manifest = await assembleManifest(draft);
  const out = JSON.stringify(manifest, null, 2);

  if (args.flags.out) {
    writeFileSync(String(args.flags.out), out + '\n');
    process.stdout.write(`${c.green('minted')} ${manifest.integrity.runId} → ${String(args.flags.out)}\n`);
  } else {
    process.stdout.write(`${out}\n`);
  }
}
