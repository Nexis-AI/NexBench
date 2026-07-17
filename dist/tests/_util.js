import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
/** Package root, resolved from the compiled test location (dist/tests). */
export function root() {
    return join(dirname(fileURLToPath(import.meta.url)), '..', '..');
}
export function resultsDir() {
    return join(root(), 'results');
}
export function loadJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}
export function referenceManifests() {
    const dir = resultsDir();
    return readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => ({ file: f, manifest: loadJson(join(dir, f)) }));
}
