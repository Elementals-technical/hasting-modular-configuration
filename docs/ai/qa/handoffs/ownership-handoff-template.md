# Ownership handoff template (PlayCanvas / backend / frontend)

Use for any defect whose first incorrect boundary is outside the change you may make, and for frontend defects found during QA that are not fixed in the current task. File: `HO-<NNN>-<slug>.md`. The goal: the owner reproduces it and returns a checkable contract on the first attempt. Never send "please check PlayCanvas".

```markdown
# HO-<NNN>: <title>

| Field | Value |
|---|---|
| Risk / severity | <S1 blocker · S2 wrong config/SKU/price · S3 visual/UX> · <likelihood> |
| Owning boundary | <PlayCanvas scene/export · backend API/catalog/price · frontend> — <verified | suspected> |
| Environment / build | <URL class>, bundle <index-*.js>, branch/commit <sha>, browser + version, viewport |
| Entry | <URL path>?collectionId=<id>, mode <prebuilt/custom>, model/preset <name> |
| Scene / asset ids | <PlayCanvas scene, entity/product type, runtime-binding key — if known> |
| Test account role | <anonymous / role; no personal data> |
| Frequency | <n of m runs> |
| TC / rule | <TC_ID> · <R-xxx> |

## Starting state
<exact state after fresh load + steps to reach it>

## Steps to reproduce
1. …

## Expected
<behaviour> — client rule <source_anchor> (revision <…>): "<short quote>"

## Actual
<behaviour>; evidence: <screenshot/video paths, same camera>, console <excerpt>, network <request + status; sanitized, no tokens>

## Frontend evidence
<selected options → request payload (sanitized) → scene state read-only → SKU/price result>; relevant frontend code: <path:line>

## Suspected root cause
<hypothesis> — confidence <low/medium/high>, because <evidence>

## Why the frontend cannot fix it safely
<e.g. the scene computes the position; a UI workaround would desync scene and SKU>

## Requested change from the owner
<concrete contract: API field, scene behaviour, asset fix>

## Acceptance criteria
- [ ] <observable result in the UI and scene>
- [ ] <SKU/price matches oracle row …>

## Proposed regression tests
- UI: <TC ids>; unit/contract: <test file or new case>

## Dependencies / open decisions
<conflict ids, client questions>
```

After the owner's fix: re-run the TC end-to-end in Chrome plus dependent configurations from `../../hastings/dependency-graph.md`; Firefox for cross-browser risk; update the TC rows and close the handoff with evidence.
