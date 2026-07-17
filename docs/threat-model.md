# NEXBENCH Threat Model & Anti-Gaming Design

Status: design document. Scope: the integrity of the public NEXBENCH leaderboard
and the intake path that feeds it. It enumerates the ways a submitter can try to
obtain a placement they did not earn, and the specific mechanism — in the
harness, the run manifest, or the twelve intake checks — that resists each one.
Availability, denial of service, and hosting security are out of scope.

## 1. Trust model

NEXBENCH is an open benchmark for autonomous Web3 agents. Its leaderboard
carries reputational value and, at times, prize and marketing value. Anyone may
submit a run, the harness is published, and the scoring is open. The adversary
is therefore a competent, motivated submitter who has read this document and the
source, wants a rank they did not earn, and is willing to fabricate, edit,
copy, or overfit to get it.

We assume the adversary can: author arbitrary JSON; read and run the published
harness; observe every listed run and its published traces; and inspect the
validator, which is the same code on the CLI, the browser submit portal, and the
enforcing intake API. We do **not** assume the adversary can forge SHA-256
pre-images or obtain the private task split. Everything the leaderboard trusts
therefore reduces to either a content hash the submitter cannot forge or a fact
that Nexis can independently re-check.

## 2. The artifact: nothing to forge in the aggregate

Every leaderboard row is exactly one validated run manifest in wire schema
`nexbench.run/2.1`. A manifest stores only two kinds of raw quantity: per-category
`pass@1` (%) over the eight published categories, and five run-level metrics
(`pass^5`, `SVR/100`, `gasOverspendPct`, `costPerTaskUsd`, `medianTaskSeconds`).

Everything a viewer actually competes on — the overall score, its 95% confidence
interval, ranks, and statistical ties — is **derived** from those stored values
at render time (`overallScore`, `ciHalfWidth`, `rankEntries`). The aggregate is a
task-count-weighted mean of the category rates; it is never stored, so there is
no aggregate number to inflate, and no two surfaces can disagree about a row. An
attacker cannot "edit the overall score"; they can only edit inputs, and every
input is bound by a check below.

## 3. Integrity primitives

All primitives are pure and use canonical JSON (recursively key-sorted) plus
SHA-256 over the WebCrypto digest, so the identical bytes hash identically in the
browser and in Node — a manifest minted by the CLI recomputes the same identifiers on the site.

- **Public run id** `nbr1_<16 hex>` is the first 16 hex of `sha256` over the
  canonical JSON of `{suite, agent{id,model,scaffold}, run{completedAt,
  harnessBuild, envPinsDigest}, results}`. It is recomputed on intake; any
  post-mint edit to a covered field changes it.
- **Manifest digest** is `sha256:` over the entire canonical manifest — a
  tamper-evident receipt body for the submission as received.
- **Trace root** (`traceRoot`) is a Merkle root over ordered, full task records in a
  `nexbench.evidence/1.0` bundle, binding every action, result, outcome, and verifier record.
- **Verifier root** (`verifierEvidenceRoot`) independently binds every typed per-trial verifier
  identity, build, verdict, and evidence digest in task/trial order.
- **Signed decision.** A detached Ed25519 attestation binds the exact manifest digest, evidence
  bundle digest, both roots, environment, counts, canary result, and verification decision.
- **Trial grid.** A `pass@1` over `N` tasks × `k=5` trials can only equal
  `m/(N·k)·100` for integer `m`; per-task rates (`pass^5`, `SVR`) live on the
  coarser `1/N` grid. Fabricated round numbers rarely satisfy this constraint.
- **Environment pins.** `envPinsDigest` is `sha256` over the pinned environment
  set; `harnessBuild` is the reproducible `sha256` of the compiled scored runtime. Both are
  pinned into the manifest and covered by the run id.
- **Canary.** A canary GUID is embedded in every task file and scanned in model
  output; an echo of it flags contamination.

## 4. The twelve intake checks

The validator runs one ordered stack of twelve checks over the parsed manifest.
Error-severity failures block intake; warn-severity flags pass intake but hold
the row for manual review before it is listed.

| # | Check | Severity | What it binds |
|---|-------|----------|---------------|
| 1 | schema | error | Parses as `nexbench.run/2.1`; every block present and typed. |
| 2 | suite-pin | error | `suite` name/version, `totalTasks=214`, `trialsPerTask=5`, and `envPinsDigest` match the published release. |
| 3 | bounds | error | Rates in `[0,100]`; agent runs respect the 900 s / $10 per-task budgets. |
| 4 | trial-grid | error | Every rate sits on the achievable `m/(N·k)` grid. |
| 5 | consistency | error | `pass^5 ≤` weighted `pass@1`; category set is exactly the eight published categories. |
| 6 | run-id | error | The `runId` content hash recomputes; any post-mint edit breaks it. |
| 7 | canary | error | Clean canary attestation required; contaminated runs rejected. |
| 8 | duplicate | error | `runId` **and** `traceRoot` checked against every listed run. |
| 9 | near-duplicate | warn | Score vector within one trial-grid step of an existing entry in every category → held for review. |
| 10 | harness-build | warn | Compiled scored-runtime digest must match a published build; unknown builds capped at self-reported. |
| 11 | identity | error | A contactable submitter (email or HTTPS URL) is required; one entry per agent+model+scaffold. |
| 12 | unknown-keys | warn | Fields outside the schema flagged (a vector for spoofed badges / lookalike metrics). |

## 5. Adversaries, attacks, and the defense that stops each

| Attack | Mechanic | Primary defense | Backstop |
|--------|----------|-----------------|----------|
| Fabricate scores outright | Type "nice" numbers into a manifest | trial-grid (4): round numbers miss the `m/(N·k)` grid | run-id (6): the hash will not match |
| Edit a minted manifest to bump a score | Change a category rate after minting | run-id (6): recomputed id diverges from stored id | manifest digest: receipt body no longer matches |
| Resubmit an existing strong run under a new name | Relabel identity, keep results | duplicate (8): same `runId` collides | identity (11); near-duplicate (9) |
| Replay/steal another team's trace archive | Reuse a published `traceRoot` | duplicate (8): `traceRoot` collides with the listed run | run-id (6) still binds identity to results |
| Relabel a copy with tiny perturbations | Nudge each category by < one trial | near-duplicate (9): flag → manual review | manual reviewer rejects confirmed copies |
| Run against an easier fork / modified corpus | Fork the suite, run against it | suite-pin (2): `envPinsDigest` / task counts mismatch | trials/tasks pins reject the fork |
| Ship a patched verifier | Run a modified harness binary | harness-build (10): unknown build capped at self-reported | verified tier requires a re-runnable image |
| Exceed budgets to brute-force | Spend past 900 s / $10 per task | bounds (3): budget caps fail agent-class runs | — |
| Overfit / train on the public tasks | Memorize the 24 public specifications | public/private split (24 vs 190); no-task-specific-code rule | quarterly rotation; canary (7) |
| Claim a verified badge without verification | Assert a badge in extra fields | unknown-keys (12): extra fields flagged | verified promotion requires a registered-key Ed25519 attestation over complete evidence |
| Cherry-pick / inconsistent metrics | Report `pass^5` above `pass@1` | consistency (5): `pass^5 ≤ pass@1` | derived aggregates leave nothing to cherry-pick |
| Contaminated model (task leaked to training) | Model has seen a task | canary (7): GUID echo → contaminated | affected task versions retired |

In prose, the defenses compose in depth. Fabrication has to clear both a
mathematical constraint (the grid) and a cryptographic one (the run-id hash);
satisfying one without the other is what an honest run does automatically and a
dishonest one rarely can. Copying is caught three ways — the run-id hash for
exact resubmission, the trace-root hash for stolen traces, and the
near-duplicate score-vector flag for perturbed relabels. Environment fraud is
caught at the pin: because `envPinsDigest` and the task/trial counts are covered
by the run-id hash, a run against a modified fork cannot even mint an id the site
will accept as matching a published environment.

## 6. Provenance tiers and re-execution

Provenance carries a `tier`: `verified` or `self-reported`. For a **verified**
run, Nexis re-executes a runnable image or a held-stable endpoint under the
pinned, deterministic environment, publishes the evidence bundle, recomputes its trace,
verifier, canary, and manifest bindings, then issues a detached Ed25519 attestation. Because the
harness owns all entropy (pinned forks, frozen oracles, fixed seeds), a re-run of
a verified image reproduces the score within the reported confidence interval, or
the run is not verified. **Self-reported** runs are labeled as such and are never
silently promoted. An unknown harness build (check 10) cannot claim verified; it
is capped at self-reported precisely because a patched binary could ship an
easier fork or a weakened verifier. Re-execution is coordinated through the
contactable submitter that check 11 requires.

## 7. Determinism, isolation, and contamination controls

- **Determinism.** Pinned forks, frozen oracles, and fixed seeds mean the same
  image produces the same score; this is what makes re-execution a meaningful
  test rather than a coin flip.
- **Isolation.** The harness permits no live internet; only the agent's own model
  API may egress. Everything else is blocked and logged, closing the "phone a
  live oracle / fetch the answer" path.
- **No task-specific code.** Only general policies are allowed. Hardcoding task
  ids, gold answers, or checker logic disqualifies a run, and it does not
  generalize: the programmatic checkers and the private 190-task split rotate
  quarterly.
- **Contamination.** The catalog has 6 runnable-local and 18 metadata-only public specs, with
  190 private tasks. Canary GUIDs
  detect training leakage; pinned suite versions keep old scores comparable; and
  a task version is retired when a canary hit shows it has leaked.

## 8. Residual risks & honest limitations

These are real and stated plainly.

1. **The self-reported tier trusts the submitter's harness output.** Checks 2–12
   constrain a self-reported manifest to be internally consistent, well-formed,
   non-duplicative, and pinned to the right environment, but they cannot prove
   the agent actually did the work behind the numbers. The mitigation is
   labeling and capping (unknown builds cannot reach verified), not elimination.
   A determined actor with the published harness could, in principle, craft a
   self-consistent but dishonest self-reported run. The verified tier, trace
   publication, and community scrutiny exist because this residual is real.
2. **Shallow categories are individually weak against integer guessing.** A small
   category such as GOV (`N=20`) has a `1.0%` trial-grid step, so a hand-guessed
   rate lands on the grid more often than in a deep category. The joint check
   across all eight categories, plus the run-id hash over the full results block,
   still catches fabrication: an attacker must satisfy the grid in every category
   *and* produce a matching content hash simultaneously.
3. **Simulation is not live mainnet.** Deterministic forks are what make the
   benchmark reproducible and re-executable, but they do not capture live
   mempool dynamics, real MEV competition, or true network latency. A high score
   attests to competence against the pinned environment, not a guarantee of
   identical behavior on live chains.
4. **Rotation is a moving, not a static, defense.** Overfitting resistance leans
   on the private split and quarterly rotation of tasks and checkers. Between
   rotations, a leaked private task would be exploitable until the next canary
   hit and retirement.

The design goal is not to make cheating impossible — an open benchmark with a
published harness cannot promise that — but to make every cheap cheat fail a hard
check, force what remains into a narrow, self-reported, contactable, and
independently re-executable corner, and make honesty the path of least
resistance.
