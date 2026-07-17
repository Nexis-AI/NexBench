"""Typed mirror of the NEXBENCH agent contract.

These types mirror `src/env/types.ts` exactly — the wire format is the source of
truth, and this module is a convenience layer over it, not a second definition
of the protocol. If the two ever disagree, the TypeScript types win.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union

try:  # TypedDict moved into typing in 3.8; Required/NotRequired are 3.11+.
    from typing import TypedDict
except ImportError:  # pragma: no cover
    from typing_extensions import TypedDict  # type: ignore

Json = Any

CategoryId = Literal[
    "execution",
    "swaps",
    "bridging",
    "defi",
    "research",
    "security",
    "analysis",
    "governance",
]

Difficulty = Literal["easy", "medium", "hard", "expert"]


class TaskBrief(TypedDict):
    id: str
    category: CategoryId
    title: str
    difficulty: Difficulty
    brief: str
    """The task statement. It contains the embedded canary — never echo it."""


class Budget(TypedDict):
    stepsRemaining: int
    secondsRemaining: float
    usdRemaining: float


class Wallet(TypedDict):
    address: str
    chain: str


class ActionResult(TypedDict, total=False):
    ok: bool
    data: Json
    error: str
    costUsd: float


class Observation(TypedDict, total=False):
    task: TaskBrief
    step: int
    """0-based step index within the current trial. 0 means a new trial began."""
    wallet: Wallet
    last: ActionResult
    """Result of your previous action; absent on the first step."""
    budget: Budget


# An Action is a plain dict on the wire. Build them with the helpers in
# `nexbench` rather than hand-writing the shapes.
Action = Dict[str, Json]
Intent = Dict[str, Json]


def rpc_call(method: str, params: Optional[Dict[str, Json]] = None, **kwargs: Json) -> Action:
    """Read state. `rpc_call("getBalance", token="USDC")`."""
    merged: Dict[str, Json] = dict(params or {})
    merged.update(kwargs)
    action: Action = {"type": "rpc_call", "method": method}
    if merged:
        action["params"] = merged
    return action


def sign_request(intent: Intent) -> Action:
    """Change state with a signed intent. `sign_request(revoke("USDC", spender))`."""
    return {"type": "sign_request", "intent": intent}


def corpus_query(query: str) -> Action:
    """Search the frozen research corpus."""
    return {"type": "corpus_query", "query": query}


def note(text: str) -> Action:
    """Scratchpad. Recorded in the trace, never scored directly."""
    return {"type": "note", "text": text}


def submit(answer: Json = None) -> Action:
    """Finish the task; `answer` is required only for graded tasks."""
    action: Action = {"type": "submit"}
    if answer is not None:
        action["answer"] = answer
    return action


# ————————————————————————— intent constructors —————————————————————————
# Amounts are integer strings in base units.


def transfer(token: str, to: str, amount: Union[str, int]) -> Intent:
    return {"kind": "transfer", "token": token, "to": to, "amount": str(amount)}


def approve(token: str, spender: str, amount: Union[str, int]) -> Intent:
    return {"kind": "approve", "token": token, "spender": spender, "amount": str(amount)}


def revoke(token: str, spender: str) -> Intent:
    return {"kind": "revoke", "token": token, "spender": spender}


def swap(pool: str, token_in: str, amount_in: Union[str, int], min_out: Union[str, int]) -> Intent:
    return {
        "kind": "swap",
        "pool": pool,
        "tokenIn": token_in,
        "amountIn": str(amount_in),
        "minOut": str(min_out),
    }


def safe_batch_transfer(token: str, payees: List[Dict[str, Json]]) -> Intent:
    return {"kind": "safe_batch_transfer", "token": token, "payees": payees}


def bridge_deposit(bridge: str, token: str, amount: Union[str, int], to_chain: str) -> Intent:
    return {
        "kind": "bridge_deposit",
        "bridge": bridge,
        "token": token,
        "amount": str(amount),
        "toChain": to_chain,
    }
