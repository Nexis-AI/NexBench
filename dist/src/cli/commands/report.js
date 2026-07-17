/** `nexbench report [dir]` — re-print the scorecard from a saved run. */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { c, fail, loadJson } from '../util.js';
import { printScorecard } from './run.js';
/** Find the newest runs/<stamp>/dev-report.json, if any. */
function latestRunDir() {
    if (!existsSync('runs'))
        return null;
    const dirs = readdirSync('runs')
        .map((d) => join('runs', d))
        .filter((p) => {
        try {
            return statSync(p).isDirectory() && existsSync(join(p, 'dev-report.json'));
        }
        catch {
            return false;
        }
    })
        .sort();
    return dirs.at(-1) ?? null;
}
export function reportCmd(args) {
    const argDir = args._[0];
    const dir = argDir ?? latestRunDir();
    if (!dir)
        fail('no run found — run `nexbench run` first, or pass a run directory');
    const path = existsSync(join(dir, 'dev-report.json')) ? join(dir, 'dev-report.json') : dir;
    let report;
    try {
        report = loadJson(path);
    }
    catch {
        fail(`could not read a dev report at ${path}`);
    }
    if (args.flags.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        return;
    }
    process.stderr.write(c.dim(`report from ${path}\n`));
    printScorecard(report);
}
