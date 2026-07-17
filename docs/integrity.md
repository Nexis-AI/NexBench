# Integrity

NEXBENCH results are tamper-evident by construction. This document explains the primitives —
canonical JSON, the run id, the trial grid, Merkle trace roots — and the twelve intake checks
built on them. All of it lives in [`src/core/integrity.ts`](../src/core/integrity.ts) and
[`src/core/validate.ts`](../src/core/validate.ts), is pure, and uses the same WebCrypto
SHA-256 in Node and the browser — so the CLI, the submit portal, and the intake API compute
identical hashes.

## Canonical JSON

Hashing is only meaningful if two encoders agree byte-for-byte. `canonicalJson` sorts object
keys recursively, preserves array order, and drops `undefined`:

```
canonicalJson({ b: 1, a: { d: 4, c: [3,1,2] } })
  === '{"a":{"c":[3,1,2],"d":4},"b":1}'
```

Every hash below is `sha256(canonicalJson(x))`.

## The run id

The public run id is the identity of a run. It is a content hash — not a random token:

```
runId = "nbr1_" + sha256(canonicalJson({
  suite,
  agent:   { id, model, scaffold },
  run:     { completedAt, harnessBuild, envPinsDigest },
  results,
})).slice(0, 16)
```

Consequences:

- **Editing a covered field breaks it.** Bump a score, change the completion date, or swap the
  harness build and the stored `nbr1_…` no longer recomputes. Intake recomputes it (check #6).
- **The same run has the same id.** Resubmitting identical results collides against the listed
  run (check #8) — you cannot pad the board with copies.
- **You cannot hand-author one.** The only way to obtain a valid run id is to hash a real
  results block; [`nexbench mint`](./cli.md#nexbench-mint) does exactly this.

`nexbench verify <manifest>` prints the stored id next to the recomputed one.

## The trial grid

A `pass@1` percentage over `N` tasks × `k = 5` trials counts how many of `N·k` trials passed,
so it can only take values on the grid `m / (N·k) · 100` for integer `m`. Per-task rates
(`pass⁵`, `SVR`) live on the coarser `1/N` grid.

Hand-typed "nice" numbers rarely land on the grid. For a 28-task category the step is
`100/140 ≈ 0.714%`, so `73.0` is off-grid while `72.857…` (`102/140`) is on it. The check is a
hard rule (check #4). The [`grid-detection` experiment](../experiments/grid-detection.ts)
measures the effect:

```
npm run experiment:grid
```

Because a fabricated manifest must clear the grid in **all eight differently-sized categories
at once**, a fabricator typing round numbers is caught with ≈100% probability — even though
the smallest category (GOV, `N=20`, `1.0%` step) is individually weak against integer guesses.
The trial grid is one layer; the run-id hash still has to recompute over the fabricated block,
and it won't.

## Evidence and Merkle roots

Package/harness 2.1.5 emits `nexbench.evidence/1.0`. Each task leaf is canonical JSON over
`{schema:"nexbench.task-trace/2.1", id, category, title, difficulty, trials, passAt1,
passAll}`. `trials` contains the full action **and result** sequence, checker outcome, and typed
verifier evidence. Leaves remain in task order.

Merkle construction hashes each UTF-8 leaf with SHA-256, then hashes the concatenated lowercase
hex of adjacent child hashes. When a level has an odd final child, that child is duplicated as
its own right sibling. The final digest is prefixed `sha256:` and becomes the manifest's
`traceRoot`.

Every trial also carries `nexbench.verifier-evidence/1.0`. Its `evidenceDigest` is SHA-256 over
canonical `{taskId, trial, seed, outcome, steps}`. Canonical verifier records are Merkle-rooted
in task/trial order into `verifierEvidenceRoot`. The evidence verifier recomputes both roots,
all trial digests, all counts, and the canary scan before it compares the bundle with the exact
manifest. It also re-derives task/category pass rates and operational metrics from the trials;
Merkle consistency alone cannot legitimize an unrelated headline score. See
[verification.md](./verification.md) for the complete contract.

## The twelve intake checks

Run them yourself: `nexbench validate <manifest.json>`.

| # | Check | Severity | Rejects |
|---|-------|----------|---------|
| 1 | Schema shape | error | Malformed or mistyped manifests |
| 2 | Suite & environment pins | error | Wrong suite/version/task-count, or a modified `envPinsDigest` (easier forks/corpora) |
| 3 | Metric bounds & budgets | error | Rates outside `[0,100]`; agent runs over the 900 s / $10 per-task budgets |
| 4 | Trial-grid alignment | error | Scores not on the achievable `m/(N·k)` grid |
| 5 | Internal consistency | error | `pass⁵` exceeding weighted `pass@1`; a wrong category set |
| 6 | Run-id recomputation | error | Any post-mint edit to a covered field |
| 7 | Canary attestation | error | Contaminated runs (the canary GUID surfaced in output) |
| 8 | Duplicate run / trace | error | Resubmitted runs (runId) and replayed traces (traceRoot) |
| 9 | Near-duplicate scores | warn | A score vector within one grid step of an existing entry (held for review) |
| 10 | Published harness build | warn | Unknown compiled scored-runtime digests → capped at self-reported |
| 11 | Submitter identity | error | Missing a contactable email/HTTPS URL |
| 12 | Unexpected fields | warn | Fields outside the schema (spoofed badges/metrics) |

**Error**-severity failures block intake. **Warn**-severity flags pass but hold the entry for
manual review. A run with no errors and no flags is eligible for the leaderboard immediately;
verified-tier listing additionally requires Nexis to re-execute the agent.

For the adversary-by-adversary mapping — fabrication, manifest edits, resubmission, trace
theft, relabeling, easier forks, budget abuse, contamination, badge spoofing — see the
[threat model](./threat-model.md).
