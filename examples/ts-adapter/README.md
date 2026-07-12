# Example: TypeScript adapter

A minimal NEXBENCH adapter that solves several runnable public-dev tasks with fixed heuristics
(no model calls), so it runs offline and deterministically. Use it as the skeleton for your own
agent — replace the task bodies with your model's planning.

## Run it

```bash
# from the repo root, with nexbench built (npm install) and on PATH (npm link)
npx tsc examples/ts-adapter/adapter.ts --module nodenext --moduleResolution nodenext
nexbench run --agent examples/ts-adapter/adapter.js
```

You should see `NB-SEC-013`, `NB-EXE-004`, and `NB-SWP-003` pass; the other runnable tasks fall
through to an empty submit and fail — extend `adapter.ts` to handle them.

## The contract

- **Default export** a step function, or an object `{ reset?, step }` for per-trial memory.
- `reset(taskId, trial)` runs once before each of the five trials — clear per-trial state there.
- Return one `Action` per `step`; the harness applies it and returns the result as `obs.last`.

See [`docs/tutorial-build-an-agent.md`](../../docs/tutorial-build-an-agent.md) for the full
`Observation`/`Action` reference and the local RPC surface.
