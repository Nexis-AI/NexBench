# Submitting a run

A leaderboard entry is one **run manifest** (`nexbench.run/2.1`) — the canonical, hash-sealed
artifact of a full 214-task run. This document covers the manifest shape, how to mint one,
provenance and verification tiers, and the intake flow.

## The manifest

```jsonc
{
  "schema": "nexbench.run/2.1",
  "suite": { "name": "NEXBENCH", "version": "2.1", "totalTasks": 214, "trialsPerTask": 5 },
  "agent": {
    "id": "my-agent", "name": "My Agent", "scaffold": "custom",
    "model": "gpt-5.5", "class": "agent", "openSource": true
  },
  "submitter": { "name": "You", "contact": "you@lab.xyz", "github": "you" },
  "run": {
    "completedAt": "2026-07-11", "harnessVersion": "2.1.3",
    "harnessBuild": "sha256:…", "envPinsDigest": "sha256:…"
  },
  "results": {
    "categories": { "execution": { "passAt1": 71.875 }, "swaps": { "passAt1": … }, … },
    "metrics": {
      "passHat5": 48.5981, "svrPer100": 3.7383,
      "gasOverspendPct": 3.8, "costPerTaskUsd": 1.18, "medianTaskSeconds": 141
    }
  },
  "integrity": { "runId": "nbr1_…", "traceRoot": "sha256:…", "canaryClean": true },
  "provenance": { "kind": "community", "tier": "self-reported" }
}
```

The JSON Schema is in [`schemas/nexbench.run-2.1.schema.json`](../schemas/nexbench.run-2.1.schema.json).
Only per-category `passAt1` and the five `metrics` are stored; the overall score, confidence
intervals, and ranks are derived by the leaderboard.

## Minting

You do not hand-write the `runId` — it is a content hash. A full run emits a **draft**;
`nexbench mint` snaps the rates onto the trial grid and computes the id:

```jsonc
// draft.json
{
  "agent": { "id": "my-agent", "name": "My Agent", "scaffold": "custom", "model": "gpt-5.5",
             "openSource": true },
  "submitter": { "name": "You", "contact": "you@lab.xyz", "github": "you" },
  "categories": { "execution": 71.9, "swaps": 66.0, "bridging": 58.3, "defi": 63.3,
                  "research": 61.5, "security": 70.0, "analysis": 62.0, "governance": 55.0 },
  "metrics": { "passHat5": 48.6, "svrPer100": 3.7, "gasOverspendPct": 3.8,
               "costPerTaskUsd": 1.18, "medianTaskSeconds": 141 },
  "integrity": { "traceRoot": "sha256:…", "canaryClean": true },
  "provenance": { "kind": "community", "tier": "self-reported" }
}
```

```bash
nexbench mint --from draft.json --out my-run.json
```

## Validate, then submit

Validate against the exact twelve checks the intake API enforces (see [integrity.md](./integrity.md)):

```bash
nexbench validate my-run.json      # exit 0 = accepted
nexbench submit   my-run.json      # dry run; add --yes to POST
```

`nexbench submit` will not send a manifest that fails validation. On the server side the same
checks re-run, an optional tamper-evident receipt is issued, and accepted community runs land
as a new file in the results repository via pull request.

## Provenance & tiers

**Provenance kind** describes where a row came from:

| Kind | Meaning |
|------|---------|
| `reference` | Run by Nexis under controlled conditions |
| `seed` | Illustrative entry (carries a dashed *seed* badge) |
| `community` | A third-party submission |

**Verification tier** describes how much we trust the numbers:

| Tier | Meaning |
|------|---------|
| `verified` | Nexis re-executed a runnable image or a held-stable endpoint and reproduced the score; traces are published |
| `self-reported` | The submitter ran it; the manifest passed the checks but was not re-executed by Nexis |

A run from an **unpublished harness build** is capped at `self-reported` (check #10): a patched
binary could ship easier verifiers. Verified-tier re-execution is coordinated through the
`submitter.contact`.

## Rules

- **One entry per agent + model + scaffold** configuration. Ablations are welcome as separate,
  clearly named entries.
- **General policies only.** Hardcoding task ids, gold answers, or checker logic disqualifies a
  run — and doesn't generalize, because checkers and the private split rotate quarterly.
- **Bring any model.** Closed, proprietary agents are fine: point the adapter at an HTTP endpoint
  and your weights and prompts never leave your infrastructure. The verified tier needs a runnable
  image or an endpoint held stable while we re-execute.
