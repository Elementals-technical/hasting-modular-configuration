---
name: local-debug-root-cause
description: Diagnose a concrete Hastings symptom (client bug, regression, wrong SKU/price/summary, 3D scene state, failing test) by reproduction and one falsifiable hypothesis at a time; fix only on request and only in the frontend. Do not use for features, plans or diff review; never patch backend or PlayCanvas.
---

# Debug Root Cause

Team rules in `ai/AGENTS.md` win on conflict.

## Establish evidence

1. Exact symptom: ticket id, family, flow (prebuilt/custom), selections, environment URL class, expected rule (anchor from `docs/ai/hastings/domain-rules.csv`) vs actual.
2. Check the backlog/comment status in `docs/ai/hastings/comments-ledger.csv`: is it already closed, superseded or a known conflict?
3. Reproduce with the smallest reliable path: a single test (`references/verify-frontend.md` in `local-implement-change`) or the browser runbook `docs/ai/qa/browser-validation.md`. Capture UI, scene state (read-only), console and network. If it does not reproduce, say so — never report it as fixed.

## Trace and test one hypothesis

1. Trace the value along `docs/ai/hastings/dependency-graph.md`: UI field → command → runtime port → scene → commit → SKU/price → summary/save.
2. State one falsifiable hypothesis; run the smallest check that distinguishes it; revise on contrary evidence. No stacked guessed fixes.
3. For scene problems, compare the requested config with what the scene reports (read-only `getConfig`) before blaming either side.

## Ownership

- First incorrect boundary in the frontend → fix only if asked: regression test first, then the fix, then the UI gate from `local-implement-change`.
- In PlayCanvas or backend → handoff with `docs/ai/qa/handoffs/ownership-handoff-template.md`, with confidence and why the frontend cannot fix it safely.

## Report

Verified causal chain with file:line, evidence paths, commands and results, residual uncertainty, owner. After two different failed approaches, stop and re-examine the evidence.
