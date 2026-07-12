# FAQ

**Can I benchmark a closed, proprietary agent?**
Yes. Point the adapter at an HTTP `/step` endpoint — weights and prompts never leave your
infrastructure. The verified tier needs a runnable image or an endpoint held stable while Nexis
re-executes it.

**What does a full run cost?**
The harness is free and open source; you pay your own inference. Across listed agents a full
214-task, 5-trial run ranged from roughly **$130** (small models) to **$3,300** (frontier
models). The bundled public-dev suite is free — it runs offline.

**Why programmatic verifiers instead of LLM judges?**
Determinism and no self-preference bias. Every checker asserts on post-run chain state,
balances, event logs, or gold numeric answers, and is unit-tested against known-good and
known-bad traces. See [scoring.md](./scoring.md) and [methodology.md](./methodology.md).

**What's the difference between `pass@1` and `pass⁵`?**
`pass@1` is the mean success over five independent trials — expected performance. `pass⁵`
requires all five trials to succeed — reliability. Production agents should be judged on both.

**How is training contamination handled?**
24 tasks are public for development; **190 stay private and rotate quarterly**. Canary GUIDs
embedded in every task file detect leakage, and suite versions are pinned so old scores stay
comparable. See [environments.md](./environments.md).

**How are fabricated or duplicated results caught?**
Twelve intake checks run on every manifest: scores must sit on the mathematically achievable
trial grid, the `runId` content hash must recompute, trace roots and score vectors are
collision-checked against every listed run, and unknown harness builds are capped at
self-reported. The full list is enforced and shown by `nexbench validate`; the adversary
mapping is in the [threat model](./threat-model.md).

**Can I submit several configurations?**
One leaderboard entry per **agent + model + scaffold** configuration. Ablations are welcome as
separate, clearly named entries.

**Why is only part of the suite runnable in this repo?**
The full 214-task suite runs against the reference environment pack (pinned multi-chain fork
snapshots, the frozen corpus, the honeypot net, and the private split), which is large and
versioned with the harness image. This repository ships the public-dev environment — 24 public
tasks, 6 runnable fully offline — so you can build and validate an adapter before requesting a
verified run. The `Observation`/`Action` interface is identical in both.

**What does a "safety violation" mean for my score?**
A hard violation — signing a drainer approval, sending to a known-malicious address, labelling
a malicious signature benign — forces that trial to fail regardless of task success, and is
counted in the SVR (violations per 100 tasks). Completing a task unsafely is a failure.

**Does the harness need my private keys or real funds?**
No. Runs execute against forked or synthetic environments; signing is simulated by the harness.
Nothing touches mainnet and no real value is at risk.

**How do I report a broken task, checker, or a suspected leaderboard entry?**
Open an issue on [github.com/Nexis-AI/NexBench](https://github.com/Nexis-AI/NexBench/issues).
Task or checker bugs are treated as correctness issues; a canary hit retires the affected task
version.
