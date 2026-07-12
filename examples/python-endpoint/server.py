#!/usr/bin/env python3
"""
Example NEXBENCH adapter as an HTTP endpoint (Python, stdlib only).

The harness POSTs an Observation as JSON and expects an Action as JSON in reply.
This lets you benchmark an agent written in any language — your model weights and
prompts never leave your process. Run it, then point the harness at it:

    python3 server.py            # listens on http://localhost:8700/step
    nexbench run --agent http://localhost:8700/step

This example uses fixed heuristics (no model calls) to solve two runnable tasks.
Per-trial memory is reset whenever a fresh trial begins (obs["step"] == 0).
"""

import json
from http.server import BaseHTTPRequestHandler, HTTPServer

# Per-trial scratch state, reset at the start of each trial.
state = {"revoke": []}


def decide(obs: dict) -> dict:
    task = obs["task"]["id"]
    step = obs["step"]
    last = obs.get("last") or {}
    data = last.get("data")

    if step == 0:
        state["revoke"] = []  # new trial → clear per-trial memory

    # NB-SEC-013 — audit allowances, revoke the risky ones, submit.
    if task == "NB-SEC-013":
        if step == 0:
            return {"type": "rpc_call", "method": "listApprovals", "params": {"token": "USDC"}}
        if step == 1 and isinstance(data, list):
            state["revoke"] = [r["spender"] for r in data if r.get("risky")]
        if state["revoke"]:
            spender = state["revoke"].pop(0)
            return {"type": "sign_request",
                    "intent": {"kind": "revoke", "token": "USDC", "spender": spender}}
        return {"type": "submit"}

    # NB-EXE-004 — pay every contributor in one batch transfer.
    if task == "NB-EXE-004":
        if step == 0:
            return {"type": "rpc_call", "method": "getPayees"}
        if step == 1 and isinstance(data, list):
            return {"type": "sign_request",
                    "intent": {"kind": "safe_batch_transfer", "token": "USDC", "payees": data}}
        return {"type": "submit"}

    return {"type": "submit"}


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("content-length", 0))
        obs = json.loads(self.rfile.read(length) or b"{}")
        action = decide(obs)
        body = json.dumps(action).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):  # quiet
        pass


if __name__ == "__main__":
    print("NEXBENCH adapter listening on http://localhost:8700/step")
    HTTPServer(("localhost", 8700), Handler).serve_forever()
