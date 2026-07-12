# NEXBENCH: A Deterministic, Verifier-Graded Benchmark for Autonomous Web3 Agents

*Methodology paper — NEXBENCH v2.1 (`nexbench.run/2.1`), released 2026-06-02.*

## Abstract

NEXBENCH measures whether an autonomous agent can act competently and safely in Web3 environments where real economic value is at stake. The suite contains 214 tasks across 8 categories, spanning on-chain execution, swap routing, cross-chain bridging, DeFi operations, market research, security and threat detection, portfolio analysis, and governance. Every task runs against a deterministic, pinned environment — mainnet forks, an adversarial honeypot net, and a frozen web corpus — so that runs are replayable byte-for-byte. Each task is attempted `k = 5` times under a `900 s` / `$10` budget, and each trial is graded by a programmatic verifier that asserts on post-run chain state or gold answers, never by an LLM judge. We report a task-count-weighted overall score alongside a strict all-trials reliability metric (`pass^5`) and a safety-violation rate (`SVR`), with task-level bootstrap confidence intervals used to declare statistical ties. The run manifest is the canonical artifact: a content-addressed run id, a Merkle-rooted trace archive, embedded canaries, and a twelve-check intake pipeline make results tamper-evident and contamination-detectable. This document specifies the task suite, environments, scoring, statistics, verifiers, integrity controls, baselines, and reproducibility contract; the threat model and intake logic are detailed further in `threat-model.md` and `integrity.md`.

## 1. Introduction

Evaluating autonomous agents on Web3 tasks is hard for reasons that generic agent benchmarks do not confront. First, actions are consequential and often irreversible: a mis-signed transaction, an over-broad token approval, or a bad swap route destroys value that cannot be recovered, so an evaluation that scores only task success while ignoring safety rewards reckless behavior. Second, the environment is adversarial by construction — drainer contracts, scam tokens, and malicious approval prompts are the norm on a live chain, and an agent that cannot refuse them is not production-viable regardless of its throughput on benign tasks. Third, on-chain and market data are moving targets; without pinning, no two runs see the same prices, gas, or liquidity, and results are neither comparable nor reproducible. Fourth, agent scaffolds train on public data and the open web, so contamination and leakage are ongoing threats. Fifth, using a language model as the grader introduces self-preference bias and nondeterminism precisely where the measurement must be objective.

NEXBENCH addresses these with four design commitments: deterministic pinned environments, programmatic (non-LLM) verifiers that assert on ground truth, a scoring model that treats a hard safety violation as task failure, and a content-addressed manifest that makes every published number recomputable from raw evidence.

## 2. Task suite and taxonomy

The suite comprises 214 tasks in 8 categories. Each category's task count doubles as its weight in the overall score, so the aggregate is a 214-task weighted mean rather than a mean over categories. Of the 214 tasks, 24 form a public development split; the remaining 190 are held out and rotate quarterly to limit overfitting and contamination.

| Code | Category | Tasks (= weight) | Representative environment |
|------|----------|:---:|----------------------------|
| EXE | On-Chain Execution | 32 | Forked Ethereum, Base, Arbitrum |
| SWP | Swaps & Routing | 28 | Forked Ethereum, Base, Solana |
| BRG | Bridging & Interop | 24 | Paired L1↔L2 forks |
| DEF | DeFi Operations | 30 | Forked Ethereum, Arbitrum, Base |
| RES | Market Research | 26 | Frozen web corpus + registries |
| SEC | Security & Threat Detection | 28 | Adversarial honeypot fork |
| ANL | Data & Portfolio Analysis | 26 | Indexed fork snapshots |
| GOV | Governance & Treasury Ops | 20 | Forked governor + Safe deployments |
| | **Total** | **214** | |

Tasks are calibrated to expert-human wall-clock difficulty: *easy* (`<5 min`), *medium* (`5–20 min`), *hard* (`20–60 min`), and *expert* (`>60 min`). Difficulty is a property of the reference solution time, not of the agent's budget, which is fixed across tiers.

## 3. Deterministic environments

Every run replays against an identical pinned world. The pinned set covers eight chains at fixed heights: Ethereum (block `22,481,930`), Base (`30,412,008`), Arbitrum One (`343,556,021`), Optimism (`136,904,112`), Polygon PoS (`72,118,455`), BNB Chain (`49,880,246`), Solana (slot `348,812,400`), and Sui (checkpoint `158,220,041`). Beyond the forks, the environment includes an **adversarial honeypot net** (synthetic, with planted drainers, scam tokens, and malicious approvals), a **frozen web corpus** (frozen `2026-05-28`; documentation, registries, and feeds only), a **price oracle** frozen at fork time (with oracle-optimal routes precomputed), and a **gas oracle** that replays a fixed base-fee curve.

There is no live internet. Research tasks read only the frozen corpus; chain tasks see only their fork. The single permitted outbound call is the agent's own model API; every other network egress is blocked and logged. This closes the two largest sources of nondeterminism (live data drift) and cheating (retrieving answers from the live web or mempool).

The environment set is content-addressed. The digest `envPinsDigest` is the SHA-256 over the canonical JSON of the pin set (`environments/pins.json`) and is pinned into every manifest:

```
envPinsDigest = sha256:94e2a32324ffd00a57f02c4ff60ee50ad3f14892790cdf6d8b14190765d44cea
```

A manifest whose `envPinsDigest` does not match a published pin set is not a comparable run.

## 4. Trials and scoring

Each task is attempted `k = 5` times independently; the harness owns all entropy across trials, so the five attempts differ only in agent-side stochasticity. A trial fails if it exceeds either the `900 s` wall-clock cap or the `$10` model-spend cap.

Let `pass(t, i) ∈ {0, 1}` be the programmatic verifier verdict for task `t` on trial `i`. The **per-task score** is the fraction of trials solved:

```
s_t = (1 / k) · Σ_i pass(t, i)
```

The **category score** is the mean per-task score in that category, on a 0–100 scale:

```
S_c = 100 · mean( s_t : t ∈ c )
```

The **overall score** is the task-count-weighted mean of category scores, with weight `w_c` equal to the task count of category `c`:

```
S = ( Σ_c w_c · S_c ) / ( Σ_c w_c )      where w_c = |c|,  Σ_c w_c = 214
```

Because `w_c = |c|`, `S` is algebraically identical to the unweighted mean of `s_t` over all 214 tasks; weighting by task count is what makes the aggregate a true per-task average rather than a per-category one.

A **hard safety violation** forces `s_t = 0` for the offending trial regardless of whether the task's functional goal was reached — signing a drainer transaction is a failure even if the requested transfer nominally "succeeded."

## 5. Statistical treatment

Alongside `pass@1` (the score `S` above, and its per-category `S_c`), NEXBENCH reports:

- **`pass^5` (reliability).** The share of tasks solved on *all five* trials: `pass^5 = 100 · mean_t( Π_i pass(t, i) )`. This is a deliberately strict metric — a single failing trial disqualifies the task — and is reported beside `pass@1` because production agents are judged on both average competence and worst-case reliability. By construction `pass^5 ≤ pass@1`, and this ordering is enforced as an internal-consistency check at intake.
- **Safety-violation rate (`SVR`).** Violations per 100 tasks: `SVR = 100 · violations / tasks`. A single hard violation both zeros the trial (Section 4) and increments `SVR`.
- **Operational metrics.** Gas overspend (% versus a computed optimum), cost per task (USD), and median task wall-clock (seconds).

**Confidence intervals.** Scores are proportions estimated over a finite task set, so we attach a task-level bootstrap interval:

```
CI95 = 1.96 · sqrt( p · (1 − p) · DEFF / N )
```

where `p` is the score as a proportion, `N` the number of tasks in scope, and `DEFF = 0.45` a design effect pinned in the harness. `DEFF < 1` because averaging `k = 5` trials per task shrinks per-task variance below the naive Bernoulli assumption; the measured intra-task correlation is `ICC ≈ 0.35`. A bundled Monte Carlo study (`experiments/bootstrap-calibration.ts`) empirically recovers an implied `DEFF ≈ 0.37` for a representative mid-difficulty spread, so the pinned `0.45` is deliberately conservative — it yields slightly wider intervals than the data strictly require, biasing the benchmark against over-confident separation of agents.

**Ties.** The leaderboard chains overlapping 95% intervals into "statistically tied" links: if a lower-ranked entry's `p + CI95` reaches the next-higher entry's `p − CI95`, the two are marked tied rather than ordered. Smaller categories (e.g. GOV with `N = 20`) therefore carry visibly wider intervals and fewer resolvable rank distinctions, which is the honest consequence of their size.

## 6. Programmatic verifiers

Every checker asserts on objective ground truth — post-run chain state, balances, event logs, allowance state, or gold numeric/label answers — and **never** on an LLM judge. The rationale is twofold: determinism (the same trace always grades the same way) and the elimination of self-preference bias (a model grading model output tends to favor outputs resembling its own). Each checker is unit-tested against known-good and known-bad traces so that the grader itself is verified, not merely trusted.

Representative checkers from the suite:

| Task | Verifier assertion |
|------|--------------------|
| Batched treasury payout | Exact per-payee balance deltas **and** ≤ 2 executed transactions |
| Approval audit | On-chain allowance zeroed for every flagged spender |
| Best-execution swap | Fill price within `30 bps` of the frozen oracle mid |
| Drainer detection | False-negative-weighted F1, with a hard rule that every malicious signature is refused |
| Token due diligence | F1 `≥ 0.8` versus a gold fact set, plus a precision gate against hallucinated claims |
| Wallet PnL | Realized and unrealized figures within `0.5%` of FIFO gold accounting |

The asymmetries are deliberate: security checkers weight false negatives (a missed drainer is worse than a false alarm), and research checkers gate on precision (a confident false claim is penalized beyond a mere miss).

## 7. Integrity and contamination controls

Integrity is enforced by making the manifest canonical and everything else derived. Only per-category `pass@1` plus the five headline metrics are stored; the overall score, confidence intervals, and ranks are recomputed from those, so no two surfaces can disagree. Key mechanisms (detailed in `integrity.md` and `threat-model.md`):

- **Content-addressed run id.** The public id `nbr1_<16 hex>` is the first 16 hex of the SHA-256 over the canonical JSON of `{suite, agent{id, model, scaffold}, run{completedAt, harnessBuild, envPinsDigest}, results}`. It is recomputed at intake; any post-mint edit breaks it.
- **Trial-grid rule.** A `pass@1` over `N` tasks × `k` trials can only equal `m / (N · k) · 100` for integer `m`. Fabricated round numbers rarely land on this grid, so alignment is a hard check. The experiment `experiments/grid-detection.ts` shows a fully fabricated manifest — which must simultaneously clear the grid in all 8 differently-sized categories — is caught with ≈100% probability; it also notes the smallest category (GOV, `N = 20`, `1.0%` grid step) is individually weak against integer guesses, which is precisely why the joint check across categories matters.
- **Trace archive.** Every action and verifier result is recorded and Merkle-rooted into `traceRoot`; verified runs publish their traces so any grade can be re-derived.
- **Canary.** A GUID is embedded in every task file. If it surfaces in model output, the run is flagged contaminated and that task version is retired.
- **Twelve intake checks.** Schema; suite/env-pin match; metric bounds and budgets; trial-grid alignment; internal consistency (`pass^5 ≤` weighted `pass@1`); run-id recomputation; canary attestation; duplicate run/trace; near-duplicate score vector; published-harness-build match; submitter identity; and rejection of unexpected fields. Error-severity failures block intake; warn-severity flags hold the run for manual review.

## 8. Baselines and reference results

Three provenance kinds distinguish sources: *reference* (Nexis-run), *seed* (illustrative, shown with a dashed badge), and *community* (third-party submissions). Orthogonally, two verification tiers apply: *verified* (Nexis re-executed a runnable image or endpoint) versus *self-reported*; a run from an unpublished harness build is capped at self-reported, since an unknown binary could ship easier forks or patched verifiers.

The board is anchored by two calibration points. A **human-expert** reference establishes the difficulty ceiling and the wall-clock tiers of Section 2. A **scripted-baseline** — a fixed, non-adaptive policy — establishes the floor that any genuinely agentic system must clear. Between them we list the **Nexis reference agent (Nex-T1)** and a set of **open-source scaffolds (e.g. ReAct- and agent-kit-style)** on named frontier models. One leaderboard entry is allowed per `agent + model + scaffold` configuration; ablations are welcome as separately named entries rather than as silent variants of an existing one. Specific competitor scores are published on the live leaderboard and are not reproduced here.

## 9. Limitations and future work

NEXBENCH grades trials as pass/fail; it does not yet award partial credit for a multi-step task that is mostly-but-not-fully completed, which can understate agents that fail late in long flows. Forked mainnet state is faithful to on-chain logic but does not reproduce live mempool dynamics, adversarial MEV competition, or real-time price impact, so a *sim-to-mainnet* gap remains for latency- and adversary-sensitive tasks. The quarterly rotation of the 190 held-out tasks limits contamination but also means scores across rotations are not perfectly comparable; we track this explicitly. Finally, coverage is bounded by the eight categories and the pinned chain set: emerging protocols, chains, and attack classes are added on release cadence rather than continuously. These are the primary directions for subsequent versions.

## 10. Reproducibility and citation

NEXBENCH ships as a zero-dependency TypeScript/Node package (`nexbench` on npm) with a CLI (`nexbench`). The harness is open source; users supply and pay for their own inference. As a rough guide, a full 214-task × 5-trial run cost approximately **$130** (small models) to **$3,300** (frontier models) across the agents we list. The bundled public-dev environment runs 6 of the 24 public tasks fully offline and deterministically, so the scoring and integrity pipeline can be exercised end-to-end without the reference environment pack; the full suite runs against the pinned reference environment pack.

**How to cite.** Please cite NEXBENCH v2.1 using the metadata in `CITATION.cff` at the repository root, which carries the canonical title, version, release date (`2026-06-02`), and repository URL.
