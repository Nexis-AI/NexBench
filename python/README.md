# nexbench (Python)

Write [NEXBENCH](https://github.com/Nexis-AI/NexBench) agents in Python.

The harness itself is the `nexbench` **npm** package — it owns the loop, the
clock, the per-task budgets, and all entropy. This package is the Python side of
the agent contract: typed `Observation`/`Action`, intent constructors, and a
zero-dependency server that speaks the `/step` protocol.

## Install

```bash
# the agent SDK (Python)
pip install "git+https://github.com/Nexis-AI/NexBench.git#subdirectory=python"

# the harness (Node ≥ 20)
npm install -g nexbench
```

## Write an agent

```python
from nexbench import serve, rpc_call, sign_request, revoke, submit

def step(obs):
    if obs["step"] == 0:
        return rpc_call("listApprovals", token="USDC")
    rows = (obs.get("last") or {}).get("data") or []
    risky = [r["spender"] for r in rows if r.get("risky")]
    if risky:
        return sign_request(revoke("USDC", risky[0]))
    return submit()

serve(step)
```

```bash
python3 agent.py                                   # listens on :8700/step
nexbench run --agent http://localhost:8700/step    # in another terminal
```

Your model, keys, and prompts never leave your process — which is also how
closed, proprietary agents run against NEXBENCH.

## Per-trial state

Every task runs **5 independent trials**. If you keep state between steps, use
the object form: `reset(task_id, trial)` is called at each trial boundary, so
memory never leaks across trials.

```python
class MyAgent:
    def reset(self, task_id, trial):
        self.queue = []
    def step(self, obs):
        ...

serve(MyAgent())
```

The wire protocol has no reset event — `serve()` derives the boundary from
`obs["step"] == 0` and tracks the trial index per task.

## API

| Function | Returns |
|---|---|
| `rpc_call(method, params=None, **kwargs)` | read state |
| `sign_request(intent)` | change state with a signed intent |
| `corpus_query(query)` | search the frozen research corpus |
| `note(text)` | scratchpad (recorded, not scored) |
| `submit(answer=None)` | finish the task |

Intent constructors: `transfer`, `approve`, `revoke`, `swap`,
`safe_batch_transfer`, `bridge_deposit`. Amounts are integer strings in base
units.

`serve(agent, host="localhost", port=8700, path="/step")` runs until interrupted.

Types (`Observation`, `Action`, `TaskBrief`, `Budget`, …) mirror
`src/env/types.ts`. **The TypeScript types are the source of truth**; this module
is a convenience layer over the same wire format.

## Notes

- **Zero dependencies** — stdlib only.
- `obs["task"]["brief"]` contains the embedded canary. Never echo it back; a run
  whose output contains it is flagged contaminated and rejected.
- A raised exception returns HTTP 500 and fails that trial, with the traceback on
  stderr — agent bugs surface loudly rather than scoring as a silent zero.

Full docs: [Observation/Action reference](../docs/tutorial-build-an-agent.md) ·
[CI](../docs/ci.md) · [submission](../docs/submission.md)
