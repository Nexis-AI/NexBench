# CLI reference

`nexbench` is a zero-dependency command-line tool. After `npm install` (which builds the
package) run it via `npm link`, `npx nexbench`, or `node dist/src/cli/index.js`.

```
nexbench <command> [options]
```

Global: every command supports `--json` for machine-readable output where meaningful, and
respects `NO_COLOR`.

---

## `nexbench run`

Run the runnable public-dev suite with an agent and print a scorecard. Fully offline and
deterministic.

```
nexbench run [--agent <spec>] [--trials <N>] [--out <dir>] [--json]
```

| Option | Default | Meaning |
|--------|---------|---------|
| `--agent` | `example` | `scripted`, `example`, a path to a JS module with a default `StepFn`/`Agent` export, or an `http(s)://…/step` endpoint URL |
| `--trials` | `5` | Trials per task |
| `--out` | `runs/<stamp>` | Directory to write `dev-report.json` and `trace.json` |
| `--json` | off | Emit the `nexbench.dev/2.1` report as JSON to stdout |

The result is a **development report** (`nexbench.dev/2.1`) over the runnable subset — a
real, reproducible score, but explicitly *not* a leaderboard manifest (the full 214-task
suite needs the reference environment). Examples:

```bash
nexbench run --agent scripted           # reference baseline (solves everything)
nexbench run --agent ./adapter.js       # your adapter
nexbench run --agent http://localhost:8700/step --trials 3
```

## `nexbench tasks`

List the 24-task public-dev split (of 214), grouped by category, flagging which run offline.

```
nexbench tasks [--category <id|code>] [--json]
```

```bash
nexbench tasks                # all 24
nexbench tasks --category sec # or --category SEC
```

## `nexbench validate`

Run all twelve intake checks against a run manifest — the exact checks the leaderboard's
intake API enforces. Exit code `0` means accepted.

```
nexbench validate <manifest.json> [--known <dir>] [--json]
```

`--known` points at a directory of listed manifests for duplicate/near-duplicate detection
(default: the bundled `results/`). A copy of the manifest being validated is excluded from
that corpus so you can re-validate a listed run on its own merits.

```bash
nexbench validate results/nex-t1.json
nexbench validate my-run.json --json
```

## `nexbench verify`

Recompute a manifest's run id and manifest digest and check trial-grid alignment — a fast
integrity spot-check without the full intake corpus.

```
nexbench verify <manifest.json> [--json]
```

## `nexbench mint`

Assemble a complete, hash-valid manifest from a *draft* (the output shape of a full run).
Category rates are snapped onto the trial grid and the run id is computed over the finished
results block — you cannot hand-author a valid run id, so this is the only correct way to
produce one.

```
nexbench mint --from <draft.json> [--out <manifest.json>]
```

A draft supplies `agent`, `submitter`, `categories` (raw pass@1 per category), `metrics`,
and `integrity.traceRoot`/`canaryClean`; see [submission.md](./submission.md) for the shape.

## `nexbench pins`

Show the pinned environment set, or recompute and compare its digest.

```
nexbench pins [--digest] [--json]
```

```bash
nexbench pins            # the pinned forks, corpora, and oracles
nexbench pins --digest   # recompute sha256 over the set; compare to the published digest
```

`--digest` exits non-zero on a mismatch (the pinned set was modified).

## `nexbench submit`

Validate locally, then submit a manifest to the leaderboard intake. Refuses to send anything
that would be rejected.

```
nexbench submit <manifest.json> [--endpoint <url>] [--yes]
```

Without `--yes` it performs a **dry run** — it validates and prints the destination but sends
nothing. Add `--yes` to POST for real. `--endpoint` overrides the default intake URL.

## `nexbench help` / `nexbench version`

```bash
nexbench help            # command list
nexbench help run        # details for one command
nexbench version
```
