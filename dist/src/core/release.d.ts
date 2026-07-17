/**
 * Package and harness release identity.
 *
 * These versions move together for patch releases. They are deliberately
 * independent of BENCH_VERSION/BENCH_SCHEMA: package 2.1.7 continues to read
 * and write the stable `nexbench.run/2.1` wire contract.
 */
export declare const PACKAGE_VERSION = "2.1.7";
export declare const HARNESS_VERSION = "2.1.7";
/**
 * Digest algorithm used by `npm run release:verify`. The digest covers the
 * compiled scored runtime (`core`, `env`, `harness`, and reference agents),
 * excluding this registry file so the expected digest is not self-referential.
 */
export declare const HARNESS_BUILD_ALGORITHM = "nexbench-runtime-v1";
/**
 * Published scored-runtime builds. A digest is added only after it is
 * reproduced by the release verifier; it is not a placeholder image hash.
 */
export declare const KNOWN_HARNESS_BUILDS: Readonly<Record<string, string>>;
export declare const HARNESS_BUILD: string;
