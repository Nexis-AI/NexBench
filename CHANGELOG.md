# Changelog

All notable changes to NEXBENCH. The suite version and the `nexbench` package version move
together; the manifest wire schema is `nexbench.run/<version>`.

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
