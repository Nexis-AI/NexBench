# Roadmap

This is where NEXBENCH is and where it's going. It's written to be honest about
what's real today versus what's still being built — a benchmark whose whole job
is trustworthy measurement shouldn't overstate its own status.

Status legend: ✅ shipped · 🚧 in progress · 🔭 planned.

## Where it stands today (v2.1.x)

The **trust machinery is complete and verifiable**; the **task suite is a running
preview** of the full benchmark.

- ✅ **Deterministic scoring core** — canonical-JSON + SHA-256 run ids, the
  trial-grid anti-fabrication rule, task-count-weighted scoring, 95% CIs,
  `pass⁵`, and SVR. Byte-identical between the CLI and the leaderboard site.
- ✅ **Tamper-evident intake** — the twelve-check validator, evidence bundles
  (`nexbench.evidence/1.0`), Merkle trace + verifier-evidence roots, and reproduced
  scored-runtime build digests (`npm run release:verify`).
- ✅ **Runnable public-dev suite** — 6 of the 24 public tasks execute fully offline
  in a deterministic local world with programmatic verifiers; the other 18 are
  published as `metadata-only` specs for adapter development.
- ✅ **Developer on-ramps** — the `nexbench` CLI (`init`/`run`/`report`/`validate`/
  `verify`/`mint`/`pins`/`submit`), a real-model scaffold (`init --template anthropic`),
  a [Python SDK](../python), and a [GitHub Action](./ci.md) that gates pull requests.
- ✅ **Submission pipeline** — evidence upload, durable intake, and an Ed25519
  verification-attestation path (see [submission.md](./submission.md)).

**What that means for the numbers today:** the leaderboard ships with reference
and *seed* entries (seed rows carry a dashed badge). They are illustrative until
the full suite runs against the reference environment — see below. The trust
apparatus that will police real submissions is already live.

## Near-term

- 🚧 **The reference environment pack.** Pinned, deterministic fork snapshots of
  the eight chains plus the frozen research corpus and honeypot net — the
  execution substrate for the full 214-task suite. This is the flagship effort;
  it's what turns "a credible benchmark harness" into "a credible benchmark."
- 🔭 **Promote the 18 `metadata-only` public specs to runnable.** The
  corpus/analysis/classification tasks land first (they don't need live forks);
  the on-chain tasks follow with the fork pack. Milestone: the entire public-24 is
  executable offline.
- 🔭 **First real reference run.** Replace the seed/reference placeholder scores
  with a full 214-task × 5-trial run of the reference agents, minted and published
  as genuine manifests.
- 🔭 **Operational verified tier.** Publish the attestation signing key and its
  rotation policy so `verified`-tier promotion is end-to-end auditable.
- 🔭 **Registry publish.** Ship `nexbench` to npm and PyPI on every release via
  tokenless OIDC Trusted Publishing (workflows are in place; awaiting one-time
  publisher registration).

## Later

- 🔭 **Quarterly private-split rotation** with re-issued canaries, keeping scores
  comparable across rotations under the pinned `nexbench.run/2.1` wire schema.
- 🔭 **More scaffolds and integrations** — additional model-provider templates and
  framework adapters, driven by demand.
- 🔭 **Suite growth** — new task categories and chains as the space moves, behind a
  suite-version bump so historical scores stay comparable.

## How to help

- **Run your agent and tell us where it's rough.** `nexbench init`, then open an
  issue — friction reports are the highest-signal contribution right now.
- **Propose a task or verifier.** Use the [task-proposal issue template](../.github/ISSUE_TEMPLATE/task_proposal.md);
  a good verifier asserts on state or a gold answer, never an LLM judge.
- **Contribute a runnable task.** [CONTRIBUTING.md](../CONTRIBUTING.md) walks through
  adding a `TaskModule`, its checker, and the scripted-baseline solution that proves
  it's solvable.

Dates are intentionally omitted — this reflects direction and ordering, not a
delivery schedule. The one-way doors (e.g. task-count changes force a suite-version
bump, because counts are the scoring weights) are decided before the work starts,
not after.
