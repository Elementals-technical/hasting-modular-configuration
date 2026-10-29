---
trigger: Changing anything that reaches the PlayCanvas scene, adding a configurable field or attribute, editing configurationCommands, playCanvasAdapter or a runtime-bindings.json, replacing the PlayCanvas export.
reader: An agent or developer changing scene behavior.
authoritative:
  - src/features/configurationCommands/hooks/useChangeAttribute.ts
  - src/features/configurationCommands/lib/changeAttribute.ts
  - src/entities/configuration/model/runtimePort.ts
  - src/features/playCanvasAdapter/lib/createPlayCanvasRuntimePort.ts
  - src/utils/functions/playcanvas/sceneBridge.ts
  - src/entities/collection/__tests__/collectionConsumerBoundary.test.ts
  - src/features/playCanvasAdapter/__tests__/sceneKeysInExport.test.ts
---

# Scene and commands

## Change path

1. The UI calls `useChangeAttribute` or `useChangeDimension` from `@/features/configurationCommands`. `src/features/configurationCommands/hooks/useChangeAttribute.ts` wires the store, the adapter and the flow.
2. The command builds a change plan and hands it to `ConfigurationRuntimePort` (`src/entities/configuration/model/runtimePort.ts`).
3. The PlayCanvas adapter (`src/features/playCanvasAdapter/lib/createPlayCanvasRuntimePort.ts`) implements the port.
4. The adapter reaches the scene through `src/utils/functions/playcanvas/sceneBridge.ts`.

## Direct scene calls

- `setConfig`, `setConfigBatch`, `addPreset`, `addProduct` and `removeAllProducts` may be called only in:
  - `src/utils/functions/playcanvas/`;
  - `src/features/playCanvasAdapter/`;
  - `src/entities/collection/model/runtimeBindings.ts`.
- Files that still call the scene directly are listed in `PENDING_DIRECT_SCENE_CALLERS` (`src/entities/collection/__tests__/collectionConsumerBoundary.test.ts:50-94`). The list only shrinks; see `docs/ai/testing.md`.

## Runtime bindings

- Scene keys and values come from the collection's `runtime-bindings.json`.
- Every bound key must appear in the scene bundle or be listed in `NOT_READ_BY_SCENE`. Enforced by `src/features/playCanvasAdapter/__tests__/sceneKeysInExport.test.ts`. Run that test after replacing the PlayCanvas export.

## Debugging in the browser

- `window.__configuratorApiLogs` — the scene API call log (`src/utils/functions/playcanvas/apiLogger.ts`).
- `window.__HASTING_DIVIDER_UI_DEBUG__.dump()` — divider UI state (`src/utils/functions/playcanvas/dividers/dividerUiDebug.ts`).

## Examples

- `src/features/configurationCommands/hooks/useChangeAttribute.ts`
- `src/features/configurationCommands/lib/changeAttribute.ts`
- `src/entities/configuration/model/runtimePort.ts`
- `src/features/playCanvasAdapter/lib/createPlayCanvasRuntimePort.ts`

## Don't copy

- `src/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx` — very large, untyped, and it calls the scene directly.

## Background

- `docs/runtime-bindings-migration.md`
