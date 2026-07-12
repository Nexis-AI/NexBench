# Example: Python endpoint adapter

Benchmark an agent written in **any language** by exposing an HTTP `/step` endpoint. The
harness POSTs each observation as JSON and reads the returned action — your model weights and
prompts stay entirely in your process. This is how closed, proprietary agents run against
NEXBENCH.

## Run it

```bash
# terminal 1 — start the adapter (stdlib only, no pip install)
python3 examples/python-endpoint/server.py

# terminal 2 — point the harness at it
nexbench run --agent http://localhost:8700/step
```

`server.py` solves `NB-SEC-013` and `NB-EXE-004` with fixed heuristics; the rest fall through
to an empty submit. Replace `decide()` with your model's planning.

## The protocol

- **Request:** POST body is the `Observation` (see
  [`docs/tutorial-build-an-agent.md`](../../docs/tutorial-build-an-agent.md)).
- **Response:** JSON `Action` — `rpc_call`, `sign_request`, `corpus_query`, `note`, or `submit`.
- **State:** the endpoint gets `obs.step` and `obs.last`; reset per-trial memory when
  `obs.step == 0` (a new trial has begun), since the harness runs the five trials in sequence.
