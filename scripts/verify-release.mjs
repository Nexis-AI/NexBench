#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runtimeBuildDigest } from './runtime-build-digest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const pkg = json('package.json');
const lock = json('package-lock.json');
const release = await import('../dist/src/core/release.js');
const failures = [];

if (pkg.version !== release.PACKAGE_VERSION)
  failures.push(`package.json ${pkg.version} != PACKAGE_VERSION ${release.PACKAGE_VERSION}`);
if (release.HARNESS_VERSION !== release.PACKAGE_VERSION)
  failures.push(
    `HARNESS_VERSION ${release.HARNESS_VERSION} != PACKAGE_VERSION ${release.PACKAGE_VERSION}`,
  );
if (lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version)
  failures.push(
    `package-lock root versions ${lock.version}/${lock.packages?.['']?.version} != ${pkg.version}`,
  );

const actualBuild = runtimeBuildDigest(root);
const expectedBuild = release.KNOWN_HARNESS_BUILDS[release.HARNESS_VERSION];
if (expectedBuild !== actualBuild)
  failures.push(`runtime build ${actualBuild} != published registry ${expectedBuild}`);

const releaseTag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined;
if (releaseTag && ![pkg.version, `v${pkg.version}`].includes(releaseTag))
  failures.push(`release tag ${releaseTag} must be ${pkg.version} or v${pkg.version}`);

if (failures.length) {
  for (const failure of failures) process.stderr.write(`release check failed: ${failure}\n`);
  process.exit(1);
}
process.stdout.write(
  `release metadata verified: package/harness ${pkg.version}, ${actualBuild}, wire nexbench.run/2.1\n`,
);

