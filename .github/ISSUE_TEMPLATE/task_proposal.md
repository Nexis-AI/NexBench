---
name: Task proposal
about: Propose a new benchmark task or verifier
title: "[task] "
labels: task
---

**Category**
One of: execution, swaps, bridging, defi, research, security, analysis, governance.

**What the agent must do**
The task statement, as an agent would read it.

**Environment**
Which fork / corpus / honeypot state it needs, and any pinned block/slot.

**Checker (programmatic)**
Exactly what post-run state or gold answer decides pass/fail. Remember: no LLM judges — it must
be assertable on chain state, balances, event logs, or a numeric/label gold set.

**Difficulty**
easy / medium / hard / expert (calibrated to expert-human wall-clock).

**Solvability**
How a correct general policy would clear it (so we can extend the scripted baseline).
