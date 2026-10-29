# Persistent plan template

Use only when a plan must be stored or handed to another executor. PRD/issue files follow `ai/AGENTS.md` › Scope instead.

```markdown
# <Change title>

## Summary
<Problem, outcome, user-visible success criteria; client rule ids R-xxx with source revision.>

## Constraints and decisions
- <Confirmed constraint, explicit default, or open decision with both conflicting anchors.>

## Responsibility map
- Current: <owner per touched layer: UI / command / runtime port / scene / SKU / price / summary / save>.
- Target: <where the new responsibility lives; what stays unchanged; foreign-owner handoffs>.

## Implementation
1. <Concrete change and its checkable result.>

## Tests and acceptance
- <Unit/contract test with exact command.>
- <UI TC ids from docs/ai/qa/ui-test-matrix.csv: positive, negative/edge, dependent-change.>

## Risks
- <Material risk only.>
```

Record blockers as explicit decisions; never leave vague tasks.
