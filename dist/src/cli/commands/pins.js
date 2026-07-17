/** `nexbench pins [--digest]` — show the pinned environment set / its digest. */
import { canonicalJson, sha256Hex } from '../../core/integrity.js';
import { ENV_PINS_DIGEST } from '../../core/suite.js';
import { c, dataPath, fail, loadJson, pad } from '../util.js';
export async function pinsCmd(args) {
    let pins;
    try {
        pins = loadJson(dataPath('environments', 'pins.json'));
    }
    catch {
        fail('could not read environments/pins.json');
    }
    const digest = `sha256:${await sha256Hex(canonicalJson(pins.environments))}`;
    if (args.flags.digest) {
        const match = digest === ENV_PINS_DIGEST;
        if (args.flags.json) {
            process.stdout.write(`${JSON.stringify({ digest, published: ENV_PINS_DIGEST, match }, null, 2)}\n`);
        }
        else {
            process.stdout.write(`computed  ${digest}\n`);
            process.stdout.write(`published ${ENV_PINS_DIGEST}\n`);
            process.stdout.write(match ? c.green('match ✓\n') : c.red('MISMATCH ✗ — the pinned set was modified\n'));
        }
        process.exit(match ? 0 : 1);
    }
    if (args.flags.json) {
        process.stdout.write(`${JSON.stringify(pins, null, 2)}\n`);
        return;
    }
    process.stdout.write(`\n${c.bold('NEXBENCH pinned environments')} · ${pins.name}@${pins.version}\n\n`);
    for (const e of pins.environments) {
        process.stdout.write(`  ${pad(e.name, 22)} ${c.cyan(pad(e.pin, 18))} ${c.gray(e.note ?? '')}\n`);
    }
    process.stdout.write(`\n  digest ${c.gray(ENV_PINS_DIGEST)}\n`);
    process.stdout.write(c.dim('  recompute with `nexbench pins --digest`\n'));
}
