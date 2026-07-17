"""NEXBENCH — write a Web3 benchmark agent in Python.

    from nexbench import serve, rpc_call, sign_request, revoke, submit

    def step(obs):
        if obs["step"] == 0:
            return rpc_call("listApprovals", token="USDC")
        rows = (obs.get("last") or {}).get("data") or []
        risky = [r["spender"] for r in rows if r.get("risky")]
        if risky:
            return sign_request(revoke("USDC", risky[0]))
        return submit()

    serve(step)   # nexbench run --agent http://localhost:8700/step

The harness (the `nexbench` npm package) owns the loop, the clock, the budget,
and all entropy; your agent returns one Action per step. Docs:
https://github.com/Nexis-AI/NexBench
"""

from .serve import Agent, StepFn, serve
from .types import (
    Action,
    ActionResult,
    Budget,
    CategoryId,
    Difficulty,
    Intent,
    Json,
    Observation,
    TaskBrief,
    Wallet,
    approve,
    bridge_deposit,
    corpus_query,
    note,
    revoke,
    rpc_call,
    safe_batch_transfer,
    sign_request,
    submit,
    swap,
    transfer,
)

__version__ = "2.1.7"

__all__ = [
    "Action",
    "ActionResult",
    "Agent",
    "Budget",
    "CategoryId",
    "Difficulty",
    "Intent",
    "Json",
    "Observation",
    "StepFn",
    "TaskBrief",
    "Wallet",
    "approve",
    "bridge_deposit",
    "corpus_query",
    "note",
    "revoke",
    "rpc_call",
    "safe_batch_transfer",
    "serve",
    "sign_request",
    "submit",
    "swap",
    "transfer",
]
