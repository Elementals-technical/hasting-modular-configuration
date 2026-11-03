---
name: grill-me
description: Interview an ambiguous plan when asked to be grilled. Do not implement.
---

Interview the user about every aspect of this plan until you reach a shared understanding. Walk
down each branch of the design tree, resolving dependencies between decisions one by one, and
give your recommended answer with every question.

Ask the questions one at a time.

When the codebase or `docs/` can answer a question, check it read-only instead of asking the user; use an available read-only search agent when delegated by the active workflow.

Record settled decisions in the task tracker selected by `ai/workflow.md`; do not create a competing tracker.
