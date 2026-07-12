# Contributing to NEXBENCH

Thanks for helping build a benchmark people can trust. Contributions fall into three buckets:
**harness/tooling**, **tasks & verifiers**, and **leaderboard submissions**. The first two are
code PRs to this repo; the third is a run manifest — see [docs/submission.md](./docs/submission.md).

## Ground rules

- **Zero runtime dependencies.** The package has none, on purpose — a benchmark whose job is
  tamper-evidence should not ask users to trust a tree of transitive packages. Use the Node
  standard library. Dev dependencies (`typescript`, `@types/node`) are fine.
- **Determinism.** No `Date.now()`/`Math.random()` in scored paths — the harness owns all
  entropy (see [`src/harness/rng.ts`](./src/harness/rng.ts)). A re-run must reproduce.
- **Programmatic verifiers only.** Checkers assert on state or gold answers; never an LLM judge.
- **Keep the core pure.** `src/core/*` is shared with the website and the intake API; changing a
  hash or a check changes the trust boundary. Add tests when you touch it.

## Setup

```bash
npm install        # builds via prepare
npm test           # build + node --test
npm run build      # tsc → dist/
```

## Adding a runnable task

1. Add the task spec to [`tasks/public-dev.json`](./tasks/public-dev.json) (set `runnable: true`).
2. Implement a `TaskModule` in [`src/env/local/tasks.ts`](./src/env/local/tasks.ts): build a
   fresh `LocalWorld` seeded per trial, embed the canary in the `brief`, and write a
   **programmatic checker** that returns `{ passed, violation, detail }`.
3. Register it in `RUNNABLE_TASKS`.
4. Prove it is solvable: extend [`src/agents/scripted-baseline.ts`](./src/agents/scripted-baseline.ts)
   so the baseline clears it, and confirm with `nexbench run --agent scripted` and the
   `harness.test.ts` solvability test.

A good task has a checker that is unambiguous, cheap, and unit-testable against a known-good and
a known-bad trace.

## Adding an intake check

Add it to `CHECK_DEFS` and the validator in [`src/core/validate.ts`](./src/core/validate.ts),
then cover it in `tests/validate.test.ts`. Because the same file backs the CLI, the submit
portal, and the intake API, a new rule lands everywhere at once — write it carefully.

## Tests

Every PR must keep `npm test` green. New behavior needs a test; new core logic needs both a
known-good and a known-bad case. CI runs on Node 20 and 22.

## Commit & PR

- Small, focused PRs with a clear description of *why*.
- Reference an issue where relevant.
- By contributing you agree your work is licensed under [Apache-2.0](./LICENSE).
