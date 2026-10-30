---
name: local-plan-change
description: Produce a decision-complete Hastings plan or design (multi-file or multi-family change, collection integration, invariant changes, unclear requirements, requested PRD/issues) grounded in code and client sources; stops after the plan. Do not use for implementing, diagnosing a failure or reviewing a diff.
---

# Plan Change

Team rules in `ai/AGENTS.md` win on conflict (its Scope section requires a plan for multi-file work and defines the PRD/issue format).

## Ground the plan

1. Restate goal, success criteria, constraints and what is out of scope.
2. Read the `ai/*.mdc` files the team routing names for the touched files, the collection's team skill and `docs/products/<id>.md` if present.
3. Requirements: rows in `docs/ai/hastings/domain-rules.csv` with anchors and status class; open conflicts in `conflicts-and-decisions.md` become explicit decisions for the user, not assumptions.
4. Find the closest existing implementation (name, domain term, UI text, behaviour) and its tests.
5. Blast radius from `docs/ai/hastings/dependency-graph.md`; boundaries, `PENDING_*` lists and paired pages the change touches.

## Design

1. Smallest solution consistent with team conventions; the current → target responsibility map for multi-file changes.
2. Ownership: anything in PlayCanvas or backend becomes a handoff item with acceptance criteria, not a frontend step.
3. Each step: files, how it is verified (exact command or TC id from `docs/ai/qa/ui-test-matrix.csv`), affected invariants.
4. Ask only decisions that change the result and cannot be found locally.

## Deliver

- In chat by default. A persistent plan only when asked: `references/plan-template.md`; a PRD/issues only when asked, in the format `ai/AGENTS.md` › Scope names.
- No placeholders such as "add validation". Stop after the plan; implementation is `local-execute-plan` after approval.
