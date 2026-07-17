/** `nexbench mint --from <draft.json>` — assemble a hash-valid manifest. */
import { writeFileSync } from 'node:fs';
import { assembleManifest } from '../../core/manifest.js';
import { c, fail, loadJson } from '../util.js';
export async function mintCmd(args) {
    const from = args.flags.from ? String(args.flags.from) : args._[0];
    if (!from)
        fail('usage: nexbench mint --from <draft.json> [--out <manifest.json>]');
    let draft;
    try {
        draft = loadJson(from);
    }
    catch (err) {
        fail(`could not read ${from}: ${err.message}`);
    }
    const manifest = await assembleManifest(draft);
    const out = JSON.stringify(manifest, null, 2);
    if (args.flags.out) {
        writeFileSync(String(args.flags.out), out + '\n');
        process.stdout.write(`${c.green('minted')} ${manifest.integrity.runId} → ${String(args.flags.out)}\n`);
    }
    else {
        process.stdout.write(`${out}\n`);
    }
}
