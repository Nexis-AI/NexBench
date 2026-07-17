# Tutorial: run NEXBENCH in five minutes

This walks through installing the harness and running the bundled offline suite. You need
**Node ≥ 20**. No API keys, no chain access — the public-dev environment is fully local.

## 1. Install

```bash
npm install -g nexbench      # or run ad-hoc with: npx nexbench <command>
```

That's it — the package is self-contained (zero runtime dependencies) and ships the offline
suite. To work from source instead (to add tasks or hack the harness), `git clone` the repo,
`npm install`, and `npm link`.

## 2. See the task suite

```bash
nexbench tasks
```

You'll see 24 public specifications grouped by category: six are explicitly
`runnable-local`; the other 18 are `metadata-only` and require the reference environment.

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
cat runs/*/trace.json          # backwards-compatible raw task records
cat runs/*/evidence.json       # nexbench.evidence/1.0 bundle
```

The `evidence.json` bundle binds every action, action result, checker outcome, and per-trial
verifier digest to the `traceRoot`; it also carries a separately recomputable verifier root and
canary result. Public-dev evidence has null `runId`/`manifestDigest` by design and cannot be
promoted to a leaderboard manifest.

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
