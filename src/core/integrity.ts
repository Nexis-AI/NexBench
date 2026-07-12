/**
 * Integrity primitives shared by the harness, the CLI, the submit portal, and
 * the intake API. Everything here is pure and uses the WebCrypto SubtleCrypto
 * digest (available as a global in Node >= 20 and in every browser), so the
 * exact same code produces the exact same hashes everywhere. A manifest minted
 * by this CLI therefore recomputes the same runId on the public leaderboard.
 */

import { TRIALS_PER_TASK } from './suite.js';
import type { RunManifest } from './types.js';

/** Deterministic JSON: object keys sorted recursively, arrays preserved. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(',')}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The public run id is a content hash over the fields that define "the same
 * run": agent identity, suite version, harness build, completion date, and the
 * full results block. Resubmitting identical results — or editing a manifest
 * after minting — changes or collides the id, so duplicates and tampering are
 * both detectable by recomputation.
 */
export async function computeRunId(
  manifest: Pick<RunManifest, 'suite' | 'agent' | 'run' | 'results'>,
): Promise<string> {
  const basis = canonicalJson({
    suite: manifest.suite,
    agent: {
      id: manifest.agent.id,
      model: manifest.agent.model,
      scaffold: manifest.agent.scaffold,
    },
    run: {
      completedAt: manifest.run.completedAt,
      harnessBuild: manifest.run.harnessBuild,
      envPinsDigest: manifest.run.envPinsDigest,
    },
    results: manifest.results,
  });
  return `nbr1_${(await sha256Hex(basis)).slice(0, 16)}`;
}

/** Digest of the manifest exactly as received (tamper-evident receipt body). */
export async function manifestDigest(manifest: unknown): Promise<string> {
  return `sha256:${await sha256Hex(canonicalJson(manifest))}`;
}

/**
 * Merkle root over an ordered list of per-task trace leaves. Each leaf is
 * hashed, then adjacent hashes are combined pairwise (last odd leaf carried up)
 * until a single root remains. The root binds every recorded action and
 * verifier result so a published trace archive cannot be altered post-hoc.
 */
export async function merkleRoot(leaves: readonly string[]): Promise<string> {
  if (leaves.length === 0) return `sha256:${await sha256Hex('')}`;
  let level = await Promise.all(leaves.map((leaf) => sha256Hex(leaf)));
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1] ?? left; // carry the odd leaf up unchanged
      next.push(await sha256Hex(`${left}${right}`));
    }
    level = next;
  }
  return `sha256:${level[0]!}`;
}

/* ————————————————————————— trial-grid math ————————————————————————— */

/**
 * A pass@1 percentage over N tasks x k trials can only take values on the grid
 * m/(N·k)·100. Fabricated "pretty" numbers (75.0, 80.5…) almost never land on
 * the grid, so alignment is checked as a hard rule. Manifests carry 4-decimal
 * precision; ε absorbs that rounding.
 */
export const GRID_EPS = 0.01;

export function gridUnits(pct: number, taskCount: number, trials = TRIALS_PER_TASK): number {
  return (pct / 100) * taskCount * trials;
}

export function isOnTrialGrid(pct: number, taskCount: number, trials = TRIALS_PER_TASK): boolean {
  const units = gridUnits(pct, taskCount, trials);
  return Math.abs(units - Math.round(units)) <= GRID_EPS * trials;
}

/** Snap a raw percentage onto the achievable trial grid (used when minting). */
export function snapToTrialGrid(pct: number, taskCount: number, trials = TRIALS_PER_TASK): number {
  const units = Math.round((pct / 100) * taskCount * trials);
  return Number(((units / (taskCount * trials)) * 100).toFixed(4));
}

/**
 * Per-task rates (pass^5 as "all-trials-solved" share, SVR as violations per
 * 100 tasks) live on the coarser 1/N grid.
 */
export function isOnTaskGrid(pct: number, taskCount: number): boolean {
  const units = (pct / 100) * taskCount;
  return Math.abs(units - Math.round(units)) <= GRID_EPS;
}

export function snapToTaskGrid(pct: number, taskCount: number): number {
  const units = Math.round((pct / 100) * taskCount);
  return Number(((units / taskCount) * 100).toFixed(4));
}

/* ————————————————————————— similarity ————————————————————————— */

/**
 * Near-duplicate detection: two runs whose category vectors differ by less than
 * one trial-grid step in every category are, in practice, the same run
 * relabeled. Flagged for manual review rather than auto-rejected.
 */
export function maxCategoryDelta(a: Record<string, number>, b: Record<string, number>): number {
  const keys = Object.keys(a);
  return Math.max(...keys.map((k) => Math.abs((a[k] ?? 0) - (b[k] ?? Number.POSITIVE_INFINITY))));
}
