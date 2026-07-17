#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoots = ['agents', 'core', 'env', 'harness'];
const excluded = new Set(['dist/src/core/release.js']);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/**
 * Reproducible digest of the compiled scored runtime. Paths and bytes are both
 * bound; generated declarations and the self-referential release registry are
 * intentionally excluded.
 */
export function runtimeBuildDigest(repoRoot = root) {
  const dist = join(repoRoot, 'dist', 'src');
  if (!existsSync(dist)) throw new Error('dist/src is missing; run npm run build first');
  const files = runtimeRoots
    .flatMap((folder) => walk(join(dist, folder)))
    .filter((path) => path.endsWith('.js'))
    .map((path) => ({ path, relative: relative(repoRoot, path).replaceAll('\\', '/') }))
    .filter((file) => !excluded.has(file.relative))
    .sort((a, b) => a.relative.localeCompare(b.relative));
  if (files.length === 0) throw new Error('compiled scored runtime is empty');

  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file.relative, 'utf8');
    hash.update('\0');
    hash.update(readFileSync(file.path));
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.stdout.write(`${runtimeBuildDigest()}\n`);
}

