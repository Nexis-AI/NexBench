# Running NEXBENCH in CI

Ship the benchmark as a regression gate: every pull request runs your agent
against the offline public-dev suite, posts a scorecard, and can fail the build
if `pass@1` drops below a threshold.

The action lives in this repository, so no extra install is needed:

```yaml
# .github/workflows/nexbench.yml
name: nexbench
on: [pull_request]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Nexis-AI/NexBench@v2.1.7
        with:
          agent: ./agent.yaml
```

That runs the 6 runnable-local tasks × 5 trials and writes a scorecard to the
job summary. It needs no API key — the bundled world is offline and
deterministic.

## Gate the build

```yaml
      - uses: Nexis-AI/NexBench@v2.1.7
        with:
          agent: ./agent.yaml
          fail-under: '60'      # fail if mean pass@1 < 60%
```

Because the suite is deterministic, a drop is a real regression, not noise —
`fail-under` is safe to enforce.

## Comment the scorecard on the PR

```yaml
jobs:
  benchmark:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write     # required for the comment
    steps:
      - uses: actions/checkout@v4
      - uses: Nexis-AI/NexBench@v2.1.7
        with:
          agent: ./agent.yaml
          comment: 'true'
```

## Use the outputs

```yaml
      - uses: Nexis-AI/NexBench@v2.1.7
        id: bench
        with: { agent: ./agent.yaml }
      - run: echo "pass@1 ${{ steps.bench.outputs.pass-at-1 }}, SVR ${{ steps.bench.outputs.svr }}"
```

## Inputs

| Input | Default | Meaning |
|---|---|---|
| `agent` | `scripted` | `scripted`, `example`, an `agent.yaml`, a JS module path, or an HTTP `/step` URL |
| `trials` | `5` | Trials per task |
| `version` | `latest` | nexbench version to install |
| `node-version` | `22.x` | Node used to run the harness |
| `fail-under` | *(none)* | Fail the job if mean `pass@1` is below this percent |
| `comment` | `false` | Post the scorecard as a PR comment (needs `pull-requests: write`) |
| `github-token` | `${{ github.token }}` | Token used for the comment |

## Outputs

| Output | Meaning |
|---|---|
| `pass-at-1` | Mean pass@1 across tasks (percent) |
| `pass-hat-5` | Reliability — share of tasks passing every trial |
| `svr` | Safety violations per 100 tasks |
| `cost-per-task` | Mean model spend per task (USD) |
| `canary-clean` | `false` if the agent echoed the task canary |
| `trace-root` | Merkle root over the run trace |
| `report` | Path to the `dev-report.json` |

## Agents that call a model

An agent that hits a provider API needs its key as a secret, and PRs from forks
don't get secrets — run those on `pull_request_target` (with the usual caution)
or restrict the job:

```yaml
    if: github.event.pull_request.head.repo.full_name == github.repository
    steps:
      - uses: actions/checkout@v4
      - run: npm install
      - uses: Nexis-AI/NexBench@v2.1.7
        with: { agent: ./agent.yaml }
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Mind the cost: 6 tasks × 5 trials = 30 model-driven episodes per run.

## Note on scope

This runs the **public-dev** suite and produces a `nexbench.dev/2.1` development
report — a real, reproducible score, but not a leaderboard manifest. Leaderboard
submissions come from a full 214-task run against the reference environment; see
[submission.md](./submission.md).
