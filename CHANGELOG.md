# Changelog

All notable changes to NEXBENCH. Package/harness patch releases move together. The benchmark
suite and manifest wire contract are versioned independently so a tooling patch can remain
compatible with `nexbench.run/2.1`.

## nexbench 2.1.6 — 2026-07-16

- Adds browser-safe `nexbench/core` and server-only `nexbench/evidence` subpath exports so the
  platform, public site, and verifier worker can consume one published science implementation
  without pulling Node signing primitives into client bundles.

## nexbench 2.1.5 — 2026-07-16

Evidence and release-integrity patch; the 2.1 suite and `nexbench.run/2.1` wire format are
unchanged.

- Classifies the public catalog honestly: **6 `runnable-local` tasks** ship with environments
  and verifiers; **18 `metadata-only` specs** require the reference environment pack.
- Emits `nexbench.evidence/1.0` bundles with full action/result traces, per-trial verifier
  digests, independently recomputable trace and verifier Merkle roots, complete canary scans,
  and full trial-to-manifest score reconciliation.
- Adds detached `nexbench.verification-attestation/1.0` Ed25519 primitives that bind the exact
  manifest, evidence bundle, environment, verifier root, and verification decision.
- `nexbench verify --evidence ...` validates evidence and optional signed attestations;
  `nexbench submit --evidence ...` uploads evidence before authenticated, idempotent intake.
- Aligns package and harness at `2.1.5`, records a reproducible compiled-runtime digest, and
  blocks releases when package, lockfile, harness, build digest, or tag metadata drift.
- Publishes npm releases through GitHub OIDC trusted publishing with provenance; no long-lived
  npm token is stored in the workflow.

## nexbench 2.1.4 — 2026-07-12

Tooling release (the 2.1 suite is unchanged; manifests remain compatible).

- `nexbench init <name>` scaffolds a runnable starter agent (agent.yaml + adapter).
- `nexbench run --agent <agent.yaml>` resolves an `agent.yaml` (`adapter:` module or
  `endpoint:` URL); `--agent` still accepts `scripted`/`example`, a JS module, or a URL.
- `nexbench report [dir]` re-prints the scorecard from a saved run.
- Published to the npm registry — install with `npm install -g nexbench`.

## v2.1 — 2026-06-02

- Suite grown to **214 tasks**; Solana and Sui forked environments added.
- Safety hard-fails with the **SVR** metric reported beside every score.
- **`pass⁵`** reliability metric; gas-oracle replay for fee realism.
- Public manifest schema (`nexbench.run/2.1`) and validated submission intake with duplicate and
  trial-grid checks.
- Private split rotated (Q2 → Q3 pool); canary GUIDs re-issued.
- Open-source harness, CLI, and public-dev environment released (this repository).

## v2.0 — 2026-02-17

- Programmatic verifiers replaced rubric judges across all categories.
- Deterministic mainnet forks replaced testnets; frozen research corpus.
- Eight-category taxonomy with task-count weighting.

## v1.0 — 2025-09-30

- Initial release: 92 tasks, testnet execution, judge-scored research.
