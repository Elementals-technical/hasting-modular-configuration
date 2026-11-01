# Common AI workflow

`AGENTS.md` routes owners and permissions. Use one procedure, one task-state writer and repo-owned domain skills; roles grant no rights.

[Diagrams](../ai/workflow-diagrams.md): lifecycle and runtime adapters.

| Request | Procedure |
|---|---|
| Explain | Targeted read-only research |
| Unknown-cause bug | `local-debug-root-cause` |
| Plan/design | `local-plan-change` |
| Known change | `local-implement-change` |
| Approved plan | `local-execute-plan` |
| Review | `local-review-change` |
| Guidance/adapters | `local-maintain-agent-guidance` |

1. **Preflight:** Git root, HEAD/diff, owner, environment, capabilities; preserve unrelated work/index.
2. **Intake:** goal, source revision/status, acceptance, exclusions, unknowns. Approved requirements define expected behavior; code/runtime establishes actual behavior.
3. **Plan:** reuse first; dependency-complete chunks and proof per criterion. Small changes need no ceremonial spec package; commercial/cross-contract risks need stronger proof.
4. **Execute:** smallest scoped change; meaningful regression test before its fix. Two failed approaches trigger evidence review. Reuse settled decisions.
5. **Verify:** required focused/final gates, measured brownfield baseline, runtime evidence and independent oracle where relevant. Label PASS/FAIL/BLOCKED/UNKNOWN/NOT_RUN honestly.
6. **Review:** task diff and AC coverage; independent read-only review for high risk.
7. **Docs sync:** update the existing owner; preserve ledgers, Records and durable rationale.
8. **Handoff:** changes, evidence, limits and unresolved owner. No delivery in this pilot.

Use the existing plan/checkpoint, or deliberately selected SDD tracker, never competing status copies. Resume evidence only for matching code/diff, source, build/export and scenario. SDD is opt-in; its installed gates/defaults cannot override local permissions.

For long/parallel runs, formal features, verification or runtime setup, read [protocol details](../ai/workflow-details.md). It covers isolation, budgets and hook limits; browser mechanics remain in their runbook.
