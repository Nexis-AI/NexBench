#!/usr/bin/env python3
"""Example NEXBENCH agent in Python.

    pip install "git+https://github.com/Nexis-AI/NexBench.git#subdirectory=python"
    python3 server.py
    nexbench run --agent http://localhost:8700/step

The harness owns the loop; you return one Action per step. This example uses
fixed heuristics (no model calls) and solves two of the six runnable-local
tasks — extend `step` to handle the rest.
"""

from nexbench import rpc_call, revoke, safe_batch_transfer, serve, sign_request, submit


class ExampleAgent:
    """Object form: `reset` is called at the start of each of the five trials,
    so per-trial memory never leaks between them."""

    def __init__(self) -> None:
        self.to_revoke: list[str] = []

    def reset(self, task_id: str, trial: int) -> None:
        self.to_revoke = []

    def step(self, obs):
        task = obs["task"]["id"]
        step = obs["step"]
        data = (obs.get("last") or {}).get("data")

        # NB-SEC-013 — audit allowances, revoke the risky ones, submit.
        if task == "NB-SEC-013":
            if step == 0:
                return rpc_call("listApprovals", token="USDC")
            if step == 1 and isinstance(data, list):
                self.to_revoke = [r["spender"] for r in data if r.get("risky")]
            if self.to_revoke:
                return sign_request(revoke("USDC", self.to_revoke.pop(0)))
            return submit()

        # NB-EXE-004 — pay every contributor in one batch transfer.
        if task == "NB-EXE-004":
            if step == 0:
                return rpc_call("getPayees")
            if step == 1 and isinstance(data, list):
                return sign_request(safe_batch_transfer("USDC", data))
            return submit()

        return submit()


if __name__ == "__main__":
    serve(ExampleAgent())
