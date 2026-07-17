"""Serve a Python agent over the NEXBENCH `/step` protocol.

    from nexbench import serve, submit

    def step(obs):
        return submit()

    serve(step)            # then: nexbench run --agent http://localhost:8700/step

Stdlib only — no dependencies.
"""

from __future__ import annotations

import json
import sys
import traceback
from collections import defaultdict
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Callable, Dict, Optional, Protocol, Tuple, runtime_checkable

from .types import Action, Observation

StepFn = Callable[[Observation], Action]


@runtime_checkable
class Agent(Protocol):
    """Stateful agent. `reset` is optional."""

    def step(self, obs: Observation) -> Action: ...


def _normalize(agent: Any) -> Tuple[StepFn, Optional[Callable[[str, int], None]]]:
    if callable(agent) and not hasattr(agent, "step"):
        return agent, None
    step_fn = getattr(agent, "step", None)
    if step_fn is None or not callable(step_fn):
        raise TypeError("agent must be a callable step function or an object with a .step method")
    reset_fn = getattr(agent, "reset", None)
    return step_fn, reset_fn if callable(reset_fn) else None


def serve(
    agent: Any,
    host: str = "localhost",
    port: int = 8700,
    path: str = "/step",
    quiet: bool = True,
) -> None:
    """Run the agent as an HTTP endpoint until interrupted.

    The harness POSTs one Observation per step and expects one Action back.

    Per-trial reset: the wire protocol has no reset event, but `obs["step"] == 0`
    marks the start of a new trial. If the agent exposes `reset(task_id, trial)`,
    it is called at that boundary so per-trial memory does not leak across the
    five independent trials — matching the in-process JS/TS agent contract.
    """
    step_fn, reset_fn = _normalize(agent)
    trials: Dict[str, int] = defaultdict(int)

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802
            if self.path.rstrip("/") != path.rstrip("/"):
                self._send(404, {"error": f"unknown path {self.path}"})
                return
            length = int(self.headers.get("content-length", 0))
            try:
                obs: Observation = json.loads(self.rfile.read(length) or b"{}")
            except json.JSONDecodeError as err:
                self._send(400, {"error": f"invalid JSON: {err}"})
                return

            task_id = (obs.get("task") or {}).get("id", "?")
            if obs.get("step") == 0 and reset_fn is not None:
                trial = trials[task_id]
                trials[task_id] += 1
                try:
                    reset_fn(task_id, trial)
                except Exception:  # noqa: BLE001 — surface agent bugs, don't mask them
                    traceback.print_exc()
                    self._send(500, {"error": "agent reset() raised"})
                    return

            try:
                action = step_fn(obs)
            except Exception as err:  # noqa: BLE001
                traceback.print_exc()
                self._send(500, {"error": f"agent step() raised: {err}"})
                return

            if not isinstance(action, dict) or "type" not in action:
                self._send(500, {"error": f"step() must return an Action dict, got {action!r}"})
                return
            self._send(200, action)

        def do_GET(self) -> None:  # noqa: N802
            self._send(405, {"error": "POST an Observation to " + path})

        def _send(self, code: int, payload: Dict[str, Any]) -> None:
            body = json.dumps(payload).encode()
            self.send_response(code)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args: Any) -> None:
            if not quiet:
                super().log_message(*args)

    server = HTTPServer((host, port), Handler)
    url = f"http://{host}:{port}{path}"
    print(f"nexbench agent listening on {url}", file=sys.stderr)
    print(f"  run it:  nexbench run --agent {url}", file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped", file=sys.stderr)
    finally:
        server.server_close()
