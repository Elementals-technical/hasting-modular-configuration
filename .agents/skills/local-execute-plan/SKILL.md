---
name: local-execute-plan
description: Execute an approved Hastings plan, checklist or plans/ issue in small verified steps, adapting to repository drift and finishing with the browser acceptance gate. Do not use to create the initial design, explore an unapproved idea or diagnose an unscoped failure.
---

# Execute Plan

Team rules in `ai/AGENTS.md` win on conflict.

## Prepare

1. Re-read the plan or issue and its acceptance criteria; read `docs/ai/checkpoint.md` when continuing earlier work.
2. Re-check the paths, contracts and client rules the plan relies on (`docs/ai/hastings/domain-rules.csv`, source revision). If part of the plan no longer holds, stop that part, report it, continue with the rest.
3. Identify step dependencies and the smallest proof per acceptance criterion.

## Execute

1. One dependency-complete step at a time inside the approved frontend boundary; never backend or PlayCanvas.
2. Keep the diff to what the plan needs and inside `ai/AGENTS.md` › Invariants.
3. Add the colocated tests the plan names; after each risky step run the narrow check from `local-implement-change/references/verify-frontend.md`.
4. An unexpected failure → `local-debug-root-cause` before further fixes.

## Finish

1. UI/3D/config steps: run the plan's TC ids via `local-implement-change/references/ui-regression.md`.
2. Inspect the final diff for scope creep, weakened contracts and missing coverage.
3. Tick only acceptance criteria actually met; report deviations, commands, results and unverified areas. Commit only when the user asks.
