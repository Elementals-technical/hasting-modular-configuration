---
paths:
  - "src/features/configurationCommands/**"
  - "src/entities/configuration/**"
---

# Configuration command rules

- A command turns an intent into a validated plan, applies it to the scene through a port, then records in Redux only what the scene applied. Nothing reached the scene: record nothing. A partial apply: record what applied, then dispatch `markRuntimeOutOfSync()` and `requestSceneStateSync()`.
- `evaluateChange` and everything it calls only read state: no dispatch, no scene call.
- The validation gates run in a fixed order (known attribute, declared scope, catalog membership, current rules), and the order is part of the contract.
- A confirmed preview is evaluated again at confirmation time; a plan that changed in between goes back to the user.
- A command returns a discriminated union (`ChangeResult`, `CompositionResult`, `{ status: "applied" | "partial" | "error" }`) and never throws for an expected refusal.
- A new attribute starts as data: its entries in the collection's `product-profile.json`, `runtime-bindings.json` and `ui.json`. Code is needed only for dependent changes (`buildChangePlan`) or an availability gate (`availabilityGates.ts`). An attribute without a binding makes its whole change set `unsupported`.
- A command outside attributes has the signature `(request, { dispatch, port = createXPort() })`; its port type is declared in `src/entities/configuration/model/runtimePort.ts` and implemented in `features/playCanvasAdapter`. It joins `CommandRunner` only when pages need it.
- Handle, height and drawers commit together as one `commitRuleSelection` after the per-cabinet actions, so availability refreshes once.
- A per-product scope carries the cabinet's stable key, never its runtime id.
- Pages reach commands through `@/features/configurationCommands`: `useAttributeChangeHandler` for a field, `useChangeAttribute()` for the runner.
- Test a command against the real `store`, reset in `beforeEach`, with `createTestRuntimePort()` from `@/features/playCanvasAdapter`.
