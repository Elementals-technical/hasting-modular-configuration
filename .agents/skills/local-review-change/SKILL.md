---
name: local-review-change
description: Read-only review of a Hastings diff, commit, branch or PR against team boundaries, client rules and SKU/price/scene consumers; findings by severity with file and line. Never implement fixes here; do not use for planning or diagnosing an unscoped failure.
---

# Review Change

Read-only. Team rules in `ai/AGENTS.md` win on conflict.

## Scope

1. Diff against the base named in the task, else the branch's upstream (`git diff <base>...HEAD`); feature branches target `origin/phase-2/staging` (see `docs/ai/env/environment-branch-map.md`).
2. The requirement the change must satisfy: ticket, client rule rows in `docs/ai/hastings/domain-rules.csv`, conflicts.
3. Read changed code plus only the contracts and tests needed to prove a finding.

## Project checks

- Team boundaries from `ai/AGENTS.md` › Invariants and the `ai/*.mdc` files for the touched paths (scene path, collection data, imports, types, styling).
- Paired pages per `ai/paired_pages.mdc`: one page of a pair changed without the other.
- `PENDING_*` lists grew or did not shrink after a migration.
- Every consumer in `docs/ai/hastings/dependency-graph.md` of a changed attribute is updated: scene, UI, SKU, price, summary, save/share, PDF, undo snapshot.
- Hand edits under "Do not edit by hand"; any change to the PlayCanvas export or backend contract without an owner handoff.
- New `any`, `@ts-ignore`, `as T` casts, suppressions, silent fallbacks; unrelated formatting.
- UI/3D change without browser evidence → finding "not verified in browser", not an assumption that it works.

## Output

Findings first, by severity: location, failure mode, impact, evidence, minimal fix direction. No findings → say so. End with residual risk and which checks actually ran.
