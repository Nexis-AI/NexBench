import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { RunManifest } from '../src/core/types.js';

/** Package root, resolved from the compiled test location (dist/tests). */
export function root(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export function resultsDir(): string {
  return join(root(), 'results');
}

export function loadJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function referenceManifests(): { file: string; manifest: RunManifest }[] {
  const dir = resultsDir();
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: f, manifest: loadJson<RunManifest>(join(dir, f)) }));
}
