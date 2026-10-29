---
name: local-implement-change
description: Implement a Hastings frontend change (feature, known-cause fix, UI/3D/collection/SKU/price) with dependency-graph blast radius, focused tests and the browser acceptance gate. Do not use for unknown-cause bugs, plan-only work, approved-plan execution, review or guidance work; never change backend or PlayCanvas.
---

# Implement Change

Team rules in `ai/AGENTS.md` win on conflict; this workflow adds Hastings domain routing and the UI gate.

## Load context just in time

1. Request, `git status`, relevant diff; the `ai/*.mdc` file that `ai/AGENTS.md` › Where to read more names for the touched files.
2. Requirement: find the rule in `docs/ai/hastings/domain-index.md` → its rows in `domain-rules.csv` (source anchor, status class, conflicts). If the rule is `conflicting` or `unknown`, stop and ask with both anchors from `conflicts-and-decisions.md`.
3. Collection work: the team skill `skills/hastings-<id>/SKILL.md` and `docs/products/<id>.md`, if they exist.
4. Owner and nearest tested analog in `src/`; one row of `docs/ai/hastings/feature-index.md` when unsure where it lives.
5. Blast radius: the attribute's row in `docs/ai/hastings/dependency-graph.md` → list every consumer (scene, UI, SKU, price, summary, save/share, PDF) as affected invariants, near neighbours and unaffected baselines.

Do not preload all docs, ledgers or the PlayCanvas export.

## Ownership gate

If the first incorrect boundary is in the PlayCanvas export/scene or in backend data/API, do not change it: write a handoff with `docs/ai/qa/handoffs/ownership-handoff-template.md` and stop. A frontend workaround that hides a foreign defect is not a fix.

## Change

1. First make the problem observable (browser for UI/3D; test for logic). Record steps and evidence.
2. Fix the earliest incorrect frontend boundary with the smallest diff; reuse existing commands, rules, profiles and SKU builders.
3. Add or update a colocated regression test that fails for the original cause.

## Verify

1. Narrow commands from [`references/verify-frontend.md`](references/verify-frontend.md).
2. UI/3D/config behaviour: [`references/ui-regression.md`](references/ui-regression.md) — mandatory, including the stateful and negative paths from the blast radius.
3. SKU/price: compare with the oracle in `docs/ai/hastings/sku-price-oracle-map.md`; no oracle → `BLOCKED`, never `passed`.

## Report

Per `ai/AGENTS.md` › Definition of done, plus: TC ids and browser evidence, what was not verified and why, affected rules with source revision, and a learning check via `local-maintain-agent-guidance`.
