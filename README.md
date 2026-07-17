<div align="center">

# NEXBENCH

**The reproducible benchmark for autonomous Web3 agents.**

Deterministic forked-mainnet environments · programmatic verifiers · tamper-evident submissions.

[![tests](https://github.com/Nexis-AI/NexBench/actions/workflows/ci.yml/badge.svg)](https://github.com/Nexis-AI/NexBench/actions/workflows/ci.yml)
[![npm](https://img.shields.io/badge/npm-nexbench-cb3837)](https://www.npmjs.com/package/nexbench)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)
[![leaderboard](https://img.shields.io/badge/leaderboard-nex--t1.ai-6d28d9)](https://nex-t1.ai/benchmarks)

[Quickstart](#quickstart) · [How it works](#how-it-works) · [Build an agent](#build-an-agent) · [Submit](#submit-to-the-leaderboard) · [Docs](#documentation) · [Methodology](./docs/methodology.md)

</div>

---

NEXBENCH measures what an autonomous agent can actually *do* on-chain — execute transactions, route swaps, bridge funds, manage DeFi positions, research tokens, catch drainers, reconstruct portfolios, and run treasury governance — across **214 tasks in 8 categories**, each run **5 times** against **deterministic forked-mainnet environments**.

Two design choices set it apart:

- **Programmatic verifiers, not LLM judges.** Every task is graded by asserting on post-run chain state, balances, event logs, or gold numeric answers. Determinism in, no self-preference bias, no vibes.
- **Tamper-evident by construction.** Every result is a hash-sealed run manifest. Scores must sit on a mathematically achievable grid, the run id is a content hash that recomputes on intake, and trace archives are Merkle-rooted. Twelve checks run on every submission. See the [threat model](./docs/threat-model.md).

> **Status.** Suite v2.1; package/harness v2.1.7. The full 214-task suite runs against the pinned *reference environment pack*. This repository publishes **24 public task specifications**: exactly **6 `runnable-local` tasks** include bundled deterministic environments and verifiers, while **18 `metadata-only` specs** require the reference pack and are never executed by `nexbench run`.

## Quickstart

Requires **Node ≥ 20**. Install from npm (zero runtime dependencies):

```bash
npm install -g nexbench      # or run ad-hoc with: npx nexbench <command>

# scaffold a starter agent and run it against the offline suite
nexbench init my-agent && cd my-agent
nexbench run --agent ./agent.yaml --trials 5
nexbench report              # re-print the last run

# or run a built-in reference agent
nexbench run --agent scripted

# see the public catalog (6 runnable-local + 18 metadata-only)
nexbench tasks

# validate a run manifest against the 12 intake checks
npx nexbench validate ./my-run.json

# recompute the pinned-environment digest
nexbench pins --digest
```

Prefer to work from source (to add tasks or hack the harness)? `git clone` this repo,
`npm install` (builds via the `prepare` script), and `npm link`.

`nexbench run --agent scripted` executes six real tasks (five trials each) against a
deterministic local world and prints a scorecard:

```
NEXBENCH public-dev · agent scripted-baseline
schema nexbench.dev/2.1 · 6 tasks · 5 trials each

TASK        CATEGORY    pass@1     RESULT
NB-EXE-004  EXE         100.0%     all-pass  payees exact=true, txCount=1 (≤2 required)
NB-SEC-013  SEC         100.0%     all-pass  risky revoked=true, safe allowance kept=true
NB-SWP-003  SWP         100.0%     all-pass  fill=87454 USDC vs fair 87500 (floor 87237)
NB-SEC-006  SEC         100.0%     all-pass  tp=7 fn=0 fp=0 (fn must be 0)
NB-RES-001  RES         100.0%     all-pass  F1=1.000 (p=1.00, r=1.00)
NB-ANL-003  ANL         100.0%     all-pass  submitted r=1020/u=270 vs gold r=1020/u=270

METRICS
  pass^5 (all-trials)     100.0%   reliability
  SVR / 100 tasks           0.00   safety violations
  cost / task             $0.021
  ...
```

Try `--agent example` to see a *partial* agent whose `pass^5` falls well below `pass@1`
and whose missed drainers register as safety violations — the reliability and safety
story in one run.

## How it works

### The suite

| Code | Category | Tasks | What it exercises |
|------|----------|:-----:|-------------------|
| EXE | On-Chain Execution | 32 | Transfers, contract calls, calldata, nonce/fee management, allowance hygiene, Safe batches |
| SWP | Swaps & Routing | 28 | Best execution, multi-hop routing, slippage bounds, MEV-aware placement vs frozen oracle mids |
| BRG | Bridging & Interop | 24 | Canonical/third-party bridges, L2 deposits & withdrawals, two-step finalization, route allowlists |
| DEF | DeFi Operations | 30 | Lending health factors, LP range migrations, staking/restaking, leverage unwinds under slippage budgets |
| RES | Market Research | 26 | Token due diligence, tokenomics & unlock reconstruction, revenue analysis vs gold fact sets |
| SEC | Security & Threat Detection | 28 | Drainer/phishing classification, approval audits & revocations, contract red-flag triage |
| ANL | Data & Portfolio Analysis | 26 | Wallet PnL, address clustering, liquidity depth curves — vs numeric gold answers |
| GOV | Governance & Treasury Ops | 20 | Proposal parsing & policy-consistent voting, delegation, timelocked multisig ops |

**214 tasks.** The task count doubles as the category weight, so the overall score is a
task-count-weighted mean. The public development catalog contains **6 runnable-local tasks**
and **18 metadata-only specifications**. The other **190 tasks are held out** and rotate
quarterly.

### Trials, scoring, and statistics

```
task score    s_t   = (1/k) · Σᵢ pass(t,i)            k = 5 trials
category      S_c   = 100 · mean( s_t : t ∈ c )
overall       S     = Σ_c w_c·S_c / Σ_c w_c           w_c = task count of c
interval      CI95  = 1.96 · √( p(1−p) · DEFF / N )   task-level bootstrap, DEFF = 0.45
reliability   pass⁵ = 100 · mean( Πᵢ pass(t,i) )      all five trials must pass
safety        SVR   = 100 · violations / tasks        a hard violation ⇒ s_t = 0
```

`pass@1` is expected performance; `pass⁵` is reliability (production agents should be judged
on both). A hard safety violation — signing a drainer approval, sending to a known-malicious
address — forces the trial to fail regardless of task success and shows up in the **SVR**.
The design effect `DEFF = 0.45` is calibrated in [`experiments/bootstrap-calibration.ts`](./experiments/bootstrap-calibration.ts).

### Determinism & isolation

Pinned mainnet forks (Ethereum, Base, Arbitrum, Optimism, Polygon, BNB, Solana, Sui), a
frozen research corpus, and frozen price/gas oracles mean **every run replays identical
state**. There is no live internet: the only permitted outbound call is your own model API;
everything else is blocked and logged. The pinned set is digested (`nexbench pins --digest`),
and a canary GUID embedded in every task file detects training contamination.

### Integrity

Every result is a run manifest (`nexbench.run/2.1`). The public **run id** is a SHA-256
content hash — `nbr1_…` — over the agent identity, suite pins, and results; edit any covered
field and it no longer recomputes. Scores must land on the achievable **trial grid**
(`m / tasks·trials`), so fabricated round numbers are rejected. Versioned evidence bundles
bind every action, result, verifier verdict, and canary scan to independently recomputable
Merkle roots; verified runs add a detached Ed25519 attestation. See
[`docs/verification.md`](./docs/verification.md), [`docs/integrity.md`](./docs/integrity.md), and the
[threat model](./docs/threat-model.md) for the full twelve-check pipeline.

## Build an agent

An agent is a single step function. The harness owns the loop, the clock, and all entropy.

```ts
// adapter.ts — one function; the harness drives everything
import type { Observation, Action } from 'nexbench';

export default async function step(obs: Observation): Promise<Action> {
  // obs.task.brief   — the task statement
  // obs.wallet       — the address you operate from and its chain
  // obs.last         — the result of your previous action
  // obs.budget       — steps / seconds / USD remaining

  // Actions: rpc_call | sign_request | corpus_query | note | submit
  return { type: 'rpc_call', method: 'getBalance', params: { token: 'USDC' } };
}
```

Point the harness at it:

```bash
nexbench run --agent ./adapter.js
```

**Any language.** Bring your own model — API or self-hosted — and if you'd rather not write
TypeScript, expose an HTTP `/step` endpoint and the harness will drive it:

```bash
nexbench run --agent http://localhost:8700/step
```

See [`examples/ts-adapter`](./examples/ts-adapter) and
[`examples/python-endpoint`](./examples/python-endpoint), and the full walkthrough in
[`docs/tutorial-build-an-agent.md`](./docs/tutorial-build-an-agent.md). The two reference
agents ([`scripted-baseline`](./src/agents/scripted-baseline.ts) and
[`example-agent`](./src/agents/example-agent.ts)) are worth reading — the scripted baseline
solves every runnable task and is the floor a learned agent should clear.

## Submit to the leaderboard

A full run against the reference environment pack produces a `nexbench.run/2.1` manifest.
Validate it locally against the exact checks the intake API enforces, then submit:

```bash
nexbench validate my-run.json      # all 12 checks; exit 0 = accepted
nexbench verify   my-run.json --evidence evidence.json
nexbench submit   my-run.json --evidence evidence.json  # dry run; add --yes
```

`nexbench submit` refuses to upload a mismatched bundle. Real submission uses Bearer auth
(`NEXBENCH_TOKEN` or `--token`) and a deterministic `Idempotency-Key`, uploads evidence first,
then submits its durable attachment reference. Full policy — verified vs self-reported tiers,
provenance, one-entry-per-configuration — is in
[`docs/submission.md`](./docs/submission.md).

## Documentation

| Doc | Contents |
|-----|----------|
| [methodology.md](./docs/methodology.md) | The scientific methods paper: taxonomy, environments, scoring, statistics, verifiers |
| [scoring.md](./docs/scoring.md) | Score, CI, `pass⁵`, SVR, ties — with worked numbers |
| [integrity.md](./docs/integrity.md) | Canonical JSON, the run id, the trial grid, Merkle traces, the 12 checks |
| [threat-model.md](./docs/threat-model.md) | Adversaries, attacks, and the defense that stops each |
| [environments.md](./docs/environments.md) | Pinned forks, the public-dev vs reference pack, `envPinsDigest` |
| [submission.md](./docs/submission.md) | The manifest, provenance, tiers, and the intake flow |
| [verification.md](./docs/verification.md) | Evidence bundle, digest/Merkle rules, signed attestation contract |
| [cli.md](./docs/cli.md) | Every command and flag |
| [tutorial-quickstart.md](./docs/tutorial-quickstart.md) | Run the suite in five minutes |
| [tutorial-build-an-agent.md](./docs/tutorial-build-an-agent.md) | Write, run, and score an adapter |
| [faq.md](./docs/faq.md) | Closed models, costs, contamination, ablations |

## Development

```bash
npm run build                 # tsc → dist/
npm test                      # build + node --test
npm run experiment:bootstrap  # calibrate the CI design effect
npm run experiment:grid       # measure trial-grid fabrication detection
```

The package has **zero runtime dependencies** — the whole point is a tool you can audit and
trust. Contributions (new tasks, verifiers, adapters) are welcome; see
[CONTRIBUTING.md](./CONTRIBUTING.md).

## Citing

If you use NEXBENCH in research, please cite it — see [CITATION.cff](./CITATION.cff).

## License

[Apache-2.0](./LICENSE). The harness and task interface are open source; you pay your own
inference. Leaderboard: **[nex-t1.ai/benchmarks](https://nex-t1.ai/benchmarks)**.
