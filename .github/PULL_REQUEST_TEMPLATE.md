## What & why

<!-- What does this change and why? Link an issue if relevant. -->

## Type

- [ ] Harness / CLI / tooling
- [ ] Task or verifier
- [ ] Docs
- [ ] Core (scoring / integrity / validation) — **changes the trust boundary; extra scrutiny**

## Checklist

- [ ] `npm test` is green (Node 20 & 22)
- [ ] No new runtime dependencies
- [ ] Deterministic — no `Date.now()`/`Math.random()` in scored paths
- [ ] New behavior has a test; new core logic has a known-good **and** known-bad case
- [ ] If a task changed: the scripted baseline still solves it (`nexbench run --agent scripted`)
- [ ] If a check changed: `nexbench validate` on `results/*.json` still passes
