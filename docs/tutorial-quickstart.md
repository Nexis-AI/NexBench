# Tutorial: run NEXBENCH in five minutes

This walks through installing the harness and running the bundled offline suite. You need
**Node ≥ 20**. No API keys, no chain access — the public-dev environment is fully local.

## 1. Install

```bash
git clone https://github.com/Nexis-AI/NexBench.git
cd NexBench
npm install          # builds the package via the prepare script
```

Optionally put the CLI on your PATH:

```bash
npm link             # now `nexbench` works anywhere
# otherwise prefix commands with:  node dist/src/cli/index.js
```

## 2. See the task suite

```bash
nexbench tasks
```

You'll see all 24 public tasks (of 214) grouped by category, with the six that run offline
flagged `runnable`.

## 3. Run the reference baseline

```bash
nexbench run --agent scripted
```

The scripted baseline is a hand-written policy that solves every runnable task. You should see
`100.0%` pass@1 on all six, `pass⁵ = 100%`, and `SVR = 0`. This is the floor a learned agent
should clear.

## 4. Run a realistic, imperfect agent

```bash
nexbench run --agent example
```

The example agent clears the easy tasks but is unreliable on best-execution and drainer triage
and gets PnL accounting wrong. Notice two things:

- **`pass⁵` is well below `pass@1`** — it succeeds *sometimes*, which is not the same as being
  reliable.
- **`SVR > 0`** — it occasionally mislabels a malicious signature as benign, which counts as a
  safety violation.

That contrast — expected performance vs reliability vs safety — is the whole point of reporting
all three.

## 5. Inspect what a run wrote

```bash
ls runs/                       # a stamped directory per run
cat runs/*/dev-report.json     # the nexbench.dev/2.1 development report
cat runs/*/trace.json          # every action and verifier result, per trial
```

The `dev-report.json` includes a `traceRoot` (a Merkle root over the per-task traces) and a
`canaryClean` attestation — the same integrity primitives a full leaderboard manifest carries.

## 6. Validate a real manifest

The repository ships the reference leaderboard manifests under `results/`. Run the full
twelve-check intake validator against one:

```bash
nexbench validate results/nex-t1.json
```

Every check should pass. Try tampering: copy the file, edit a single `passAt1` value, and
re-run `validate` — the trial-grid and run-id checks will both fail, because the score no longer
lands on the achievable grid and the content hash no longer recomputes.

## Next

- [Build an agent](./tutorial-build-an-agent.md) — write your own adapter and score it.
- [Scoring](./scoring.md), [Integrity](./integrity.md), [Environments](./environments.md).
- [Methodology](./methodology.md) — the full scientific write-up.
