/**
 * Integrity primitives shared by the harness, the CLI, the submit portal, and
 * the intake API. Everything here is pure and uses the WebCrypto SubtleCrypto
 * digest (available as a global in Node >= 20 and in every browser), so the
 * exact same code produces the exact same hashes everywhere. A manifest minted
 * by this CLI therefore recomputes the same runId on the public leaderboard.
 */
import type { RunManifest } from './types.js';
/** Deterministic JSON: object keys sorted recursively, arrays preserved. */
export declare function canonicalJson(value: unknown): string;
export declare function sha256Hex(text: string): Promise<string>;
/**
 * The public run id is a content hash over the fields that define "the same
 * run": agent identity, suite version, harness build, completion date, and the
 * full results block. Resubmitting identical results — or editing a manifest
 * after minting — changes or collides the id, so duplicates and tampering are
 * both detectable by recomputation.
 */
export declare function computeRunId(manifest: Pick<RunManifest, 'suite' | 'agent' | 'run' | 'results'>): Promise<string>;
/** Digest of the manifest exactly as received (tamper-evident receipt body). */
export declare function manifestDigest(manifest: unknown): Promise<string>;
/**
 * Merkle root over an ordered list of per-task trace leaves. Each leaf is
 * hashed, then adjacent hashes are combined pairwise (the last odd hash is
 * duplicated as its own right sibling) until a single root remains. The root binds every recorded action and
 * verifier result so a published trace archive cannot be altered post-hoc.
 */
export declare function merkleRoot(leaves: readonly string[]): Promise<string>;
/**
 * A pass@1 percentage over N tasks x k trials can only take values on the grid
 * m/(N·k)·100. Fabricated "pretty" numbers (75.0, 80.5…) almost never land on
 * the grid, so alignment is checked as a hard rule. Manifests carry 4-decimal
 * precision; ε absorbs that rounding.
 */
export declare const GRID_EPS = 0.01;
export declare function gridUnits(pct: number, taskCount: number, trials?: number): number;
export declare function isOnTrialGrid(pct: number, taskCount: number, trials?: number): boolean;
/** Snap a raw percentage onto the achievable trial grid (used when minting). */
export declare function snapToTrialGrid(pct: number, taskCount: number, trials?: number): number;
/**
 * Per-task rates (pass^5 as "all-trials-solved" share, SVR as violations per
 * 100 tasks) live on the coarser 1/N grid.
 */
export declare function isOnTaskGrid(pct: number, taskCount: number): boolean;
export declare function snapToTaskGrid(pct: number, taskCount: number): number;
/**
 * Near-duplicate detection: two runs whose category vectors differ by less than
 * one trial-grid step in every category are, in practice, the same run
 * relabeled. Flagged for manual review rather than auto-rejected.
 */
export declare function maxCategoryDelta(a: Record<string, number>, b: Record<string, number>): number;
