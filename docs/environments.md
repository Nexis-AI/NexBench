# Environments

NEXBENCH is reproducible because its environments are pinned and deterministic. Every run
replays identical state; the harness owns all entropy. This document covers the pinned set,
the digest that seals it, and the difference between the **public-dev** environment that ships
in this repository and the **reference environment pack** used for full leaderboard runs.

## The pinned set

Twelve deterministic environments (`environments/pins.json`):

| Environment | Pin |
|-------------|-----|
| Ethereum fork | block 22,481,930 |
| Base fork | block 30,412,008 |
| Arbitrum One fork | block 343,556,021 |
| Optimism fork | block 136,904,112 |
| Polygon PoS fork | block 72,118,455 |
| BNB Chain fork | block 49,880,246 |
| Solana fork | slot 348,812,400 |
| Sui fork | checkpoint 158,220,041 |
| Honeypot net | synthetic — planted drainers, scam tokens, malicious approvals |
| Web corpus | frozen 2026-05-28 — docs, registries, feeds; no live internet |
| Price oracle | frozen at fork time — oracle-optimal routes precomputed |
| Gas oracle | replayed base-fee curve |

Rules that follow from this:

- **No live internet.** Research tasks read the frozen corpus; chain tasks see only their fork.
  The only permitted outbound call is your own model API — everything else is blocked and logged.
- **Frozen oracles.** Best-execution is graded against a mid that does not move, so a good route
  is a matter of skill, not luck.
- **Fixed seeds.** A re-run of a verified image reproduces the score within the reported interval.

## The environment-pins digest

The pinned set is sealed by a digest carried in every manifest as `run.envPinsDigest`:

```
envPinsDigest = "sha256:" + sha256(canonicalJson(environments))
              = sha256:94e2a32324ffd00a57f02c4ff60ee50ad3f14892790cdf6d8b14190765d44cea
```

Recompute and compare it:

```bash
nexbench pins --digest
```

Intake check #2 rejects any manifest whose digest does not match the published value — a run
against modified forks or a doctored corpus cannot be listed.

## Public-dev vs the reference pack

This repository publishes a **24-spec public development catalog**
(`tasks/public-dev.json`). Exactly **6 are `runnable-local`**: they include a deterministic
local world and programmatic verifier. The other **18 are `metadata-only`**: their public
briefs help adapter development, but their execution environments and verifiers exist only in
the reference pack. `nexbench run` never pretends to execute those 18 specs.

```bash
nexbench tasks                  # 6 runnable-local + 18 metadata-only specs
nexbench run --agent scripted   # the 6 local tasks, 5 trials each, offline
```

A public-dev run produces a `nexbench.dev/2.1` **development report** — a real, reproducible
score, clearly *not* a leaderboard manifest.

The **full 214-task suite** runs against the *reference environment pack*: the pinned
multi-chain fork snapshots, the frozen corpus, the honeypot net, and the held-out 190-task
split. The pack is large and versioned with the harness build; it is not committed to this
repository. Full-suite runs — and every **verified**-tier listing — are produced against the
pack and re-executed by Nexis. The agent interface (`Observation`/`Action`) is identical in
both, so an adapter that clears the public-dev tasks runs unchanged against the full suite.

## Contamination controls

- **Split.** 24 task specifications are public (6 runnable-local, 18 metadata-only); **190 are
  held out** and rotate quarterly, so overfitting to the public split does not transfer.
- **Canary.** Every task file embeds a canary GUID; if it surfaces in model output the run is
  flagged contaminated (intake check #7) and that task version is retired.
- **Versioning.** Suite versions are pinned (`nexbench.run/2.1`) so scores stay comparable
  across the rotation. Package/harness patch versions (currently 2.1.6) may advance without a
  wire-schema bump.
