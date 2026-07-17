/** Small zero-dependency helpers shared by the CLI commands. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
/** Parse `--key value`, `--key=value`, `--bool`, and positionals. */
export function parseArgs(argv) {
    const _ = [];
    const flags = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            const eq = a.indexOf('=');
            if (eq !== -1) {
                flags[a.slice(2, eq)] = a.slice(eq + 1);
            }
            else {
                const key = a.slice(2);
                const next = argv[i + 1];
                if (next !== undefined && !next.startsWith('--')) {
                    flags[key] = next;
                    i++;
                }
                else {
                    flags[key] = true;
                }
            }
        }
        else {
            _.push(a);
        }
    }
    return { _, flags };
}
/** Walk up from this module until a directory containing package.json. */
export function pkgRoot() {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 8; i++) {
        if (existsSync(join(dir, 'package.json')))
            return dir;
        const parent = dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return process.cwd();
}
export function dataPath(...parts) {
    return join(pkgRoot(), ...parts);
}
export function loadJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}
/* ————————————————————————— terminal formatting ————————————————————————— */
const useColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;
const wrap = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
export const c = {
    bold: wrap('1'),
    dim: wrap('2'),
    green: wrap('32'),
    red: wrap('31'),
    yellow: wrap('33'),
    cyan: wrap('36'),
    gray: wrap('90'),
};
export function bar(pct, width = 20) {
    const filled = Math.round((Math.min(Math.max(pct, 0), 100) / 100) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}
export function statusMark(status) {
    if (status === 'pass')
        return c.green('✓');
    if (status === 'fail')
        return c.red('✗');
    return c.yellow('⚑');
}
export function pad(s, n) {
    return s.length >= n ? s : s + ' '.repeat(n - s.length);
}
export function padStart(s, n) {
    return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}
export function fail(msg) {
    process.stderr.write(`${c.red('error')} ${msg}\n`);
    process.exit(1);
}
