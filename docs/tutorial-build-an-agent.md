# Tutorial: build an agent

An agent is a single **step function**. The harness owns the loop, the clock, the budget, and
all entropy; your job is to look at an observation and return the next action. This tutorial
builds an adapter that solves a couple of the runnable public-dev tasks, runs it, and scores it.

## The contract

```ts
import type { Observation, Action } from 'nexbench';

export default async function step(obs: Observation): Promise<Action> {
  return plan(obs);
}
```

- **Default export** a `step` function (or an object `{ reset?, step }` if you need per-trial
  memory — `reset(taskId, trial)` is called once before each trial so state doesn't leak across
  the five independent trials).
- Return one `Action` per call. The harness applies it and hands you the result on the next
  observation as `obs.last`.

### Observation

```ts
type Observation = {
  task:  { id: string; category: CategoryId; title: string; difficulty: Difficulty; brief: string };
  step:  number;                                  // 0-based step within the trial
  wallet:{ address: string; chain: string };      // the address you operate from
  last?: { ok: boolean; data?: Json; error?: string; costUsd?: number };  // your previous action's result
  budget:{ stepsRemaining: number; secondsRemaining: number; usdRemaining: number };
};
```

`obs.task.brief` is the task statement. Read it — it tells you exactly what to do and which
reads are available.

### Action

```ts
type Action =
  | { type: 'rpc_call'; method: string; params?: Json }   // read state
  | { type: 'sign_request'; intent: Intent }              // change state (signed)
  | { type: 'corpus_query'; query: string }               // read the frozen corpus
  | { type: 'note'; text: string }                        // scratchpad (recorded, not scored)
  | { type: 'submit'; answer?: Json };                    // finalize; `answer` for graded tasks
```

In the bundled local world, the reads (`rpc_call`) include `getBalance`, `getAllowance`,
`listApprovals`, `listPools`, `quote`, `oracleQuote`, `poolReserves`, `getSigRequests`,
`getTxHistory`, `getMeta`, and `getPayees`; the state-changing intents are `transfer`,
`approve`, `revoke`, `swap`, `safe_batch_transfer`, and `bridge_deposit`. Against the reference
fork environment these map onto real RPC and signing surfaces — the shape you code to is the same.

## A worked adapter

Save this as `my-adapter.ts` (or `.js`). It handles two tasks: the approval audit
(`NB-SEC-013`) and the batched payout (`NB-EXE-004`).

```ts
import type { Action, Observation } from 'nexbench';

let toRevoke: string[] = [];

export default function step(obs: Observation): Action {
  // NB-SEC-013 — read allowances, revoke the risky ones, then submit.
  if (obs.task.id === 'NB-SEC-013') {
    if (obs.step === 0) return { type: 'rpc_call', method: 'listApprovals', params: { token: 'USDC' } };
    if (obs.step === 1 && Array.isArray(obs.last?.data)) {
      toRevoke = (obs.last!.data as { spender: string; risky: boolean }[])
        .filter((r) => r.risky).map((r) => r.spender);
    }
    const next = toRevoke.shift();
    return next
      ? { type: 'sign_request', intent: { kind: 'revoke', token: 'USDC', spender: next } }
      : { type: 'submit' };
  }

  // NB-EXE-004 — pay everyone in one batch transfer.
  if (obs.task.id === 'NB-EXE-004') {
    if (obs.step === 0) return { type: 'rpc_call', method: 'getPayees' };
    if (obs.step === 1 && Array.isArray(obs.last?.data)) {
      const payees = obs.last!.data as { to: string; amount: string }[];
      return { type: 'sign_request', intent: { kind: 'safe_batch_transfer', token: 'USDC', payees } };
    }
    return { type: 'submit' };
  }

  return { type: 'submit' };
}
```

> Note the module-level `toRevoke`. Because a bare `step` function has no `reset`, that state
> would leak across trials. For anything stateful, prefer the object form:
> `export default { reset(taskId, trial) { toRevoke = []; }, step };` — or derive state from
> `obs.step` and `obs.last`. The two reference agents
> ([`scripted-baseline`](../src/agents/scripted-baseline.ts),
> [`example-agent`](../src/agents/example-agent.ts)) use the object form.

## Run it

Compile if it's TypeScript (`npx tsc my-adapter.ts --module nodenext`), then:

```bash
nexbench run --agent ./my-adapter.js
```

You'll get a scorecard. The tasks your adapter doesn't handle will fail (it just submits an
empty answer) — that's expected; extend it task by task, using the reference agents and each
task's `brief` and checker (`nexbench tasks`) as your guide.

## Any language

Don't want to write TypeScript? Expose an HTTP endpoint that accepts the observation as a JSON
POST body and returns an action as JSON:

```bash
nexbench run --agent http://localhost:8700/step
```

See [`examples/python-endpoint`](../examples/python-endpoint) for a ~40-line Python server that
solves the same two tasks. Your model weights and prompts stay entirely on your side — which is
how closed, proprietary agents run against NEXBENCH.

## From dev to leaderboard

The public-dev suite is for *building* your adapter. A full leaderboard run executes all 214
tasks against the reference environment pack and emits a `nexbench.run/2.1` manifest — see
[submission.md](./submission.md). The adapter you wrote here runs unchanged against the full
suite; only the environment (and the number of tasks) changes.
