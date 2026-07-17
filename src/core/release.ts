/**
 * Package and harness release identity.
 *
 * These versions move together for patch releases. They are deliberately
 * independent of BENCH_VERSION/BENCH_SCHEMA: package 2.1.5 continues to read
 * and write the stable `nexbench.run/2.1` wire contract.
 */

export const PACKAGE_VERSION = '2.1.5';
export const HARNESS_VERSION = PACKAGE_VERSION;

/**
 * Digest algorithm used by `npm run release:verify`. The digest covers the
 * compiled scored runtime (`core`, `env`, `harness`, and reference agents),
 * excluding this registry file so the expected digest is not self-referential.
 */
export const HARNESS_BUILD_ALGORITHM = 'nexbench-runtime-v1';

/**
 * Published scored-runtime builds. A digest is added only after it is
 * reproduced by the release verifier; it is not a placeholder image hash.
 */
export const KNOWN_HARNESS_BUILDS: Readonly<Record<string, string>> = {
  '2.1.5': 'sha256:77c41aa349838661a62822cff03ced4626b94353eb051f8fd39f2c32801dab70',
  '2.1.3': 'sha256:8c1e6a0d3f4b2a97c5e18d640b9f2a7d31c8e5f0a6b4d2c9871e3f5a0b6c4d28',
  '2.1.2': 'sha256:5d2f8b1c7a4e0d93b6f21c584a9e0d7f42b1c6e8f3a5d0b7962c4e1f8a3b5d07',
};

export const HARNESS_BUILD = KNOWN_HARNESS_BUILDS[HARNESS_VERSION]!;
