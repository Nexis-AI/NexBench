# Changelog

All notable changes to NEXBENCH. The suite version and the `nexbench` package version move
together; the manifest wire schema is `nexbench.run/<version>`.

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
