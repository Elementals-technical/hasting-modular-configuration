---
paths:
  - "src/features/playCanvasAdapter/**"
  - "src/utils/functions/playcanvas/**"
  - "src/utils/playcanvasRotation.ts"
  - "src/features/configuratorApi/**"
  - "src/widgets/Player/**"
  - "src/features/dividers/**"
  - "src/features/countertopPlacement/**"
  - "src/features/cabinetPlacementDebug/**"
  - "src/entities/configuration/model/runtimePort.ts"
  - "src/entities/collection/lib/runtimeBindings/**"
  - "src/entities/collection/model/runtimeBindings.ts"
  - "src/shared/hooks/usePlayCanvasReady.ts"
---

# Scene rules

## Boundary

- The scene is the one same-origin iframe that `PlayCanvasIntegration` mounts, reached through `window.containerRef`; no npm engine, no second iframe.
- A new scene capability is a port: its type in `src/entities/configuration/model/runtimePort.ts`, a `createX({ …, scene = defaultScene })` factory in `features/playCanvasAdapter/lib/` with a `createTestX` stand-in, both exported from `features/playCanvasAdapter/index.ts`. Its result union includes `not-ready`. Adapter code neither imports Redux nor logs.
- A new call on the flat `ConfiguratorAPI` goes into `src/utils/functions/playcanvas/sceneBridge.ts`, returning `{ status }`, never into a new wrapper file. The namespaced API goes through `features/configuratorApi`: feature-detect a newer member, throw `ConfiguratorError(code)`.
- Iframe code narrows `unknown` with a file-local `isRecord` or a feature check, typing the window as a local `Window & { … }` shape.
- Send one patch per `setConfigBatch` call, through the serial `runInBatchQueue`. Why: the scene returns early for SidePanel, TowelBar and TowelBarColor, dropping keys merged into the same call.
- Scene keys, product types and material names live in the collection's `runtime-bindings.json`; code names attribute ids and resolves them with `resolveRuntimeBinding`. A value with no scene translation is `unbound` with a `reason`, or `state-only`, never guessed. Enforced by: `validateRuntimeBindings`, `sceneKeysInExport.test.ts`, `sceneMaterialsInExport.test.ts`.
- A change set stops at its first failure; once anything reached the scene, the result is `partial`, never `failed`.

## Lifecycle

- Wait for the scene with `usePlayCanvasReady()` in React and `isSceneReady()` elsewhere.
- Dispose every scene subscription (an `.on(…)` unsubscribe, an iframe document listener, an interval) in the effect cleanup.
- Overlay frames live in a module-level store read with `useSyncExternalStore`; their coordinates are CSS px of the iframe viewport, mapped 1:1 onto a layer covering the iframe.
- The app's stylesheets don't reach the scene document: style an element created there imperatively.
- Read the rect of an element the scene itself draws from `window.containerRef`'s document, returning `null` when the iframe, its document or a visible element is missing. From a component, read it synchronously during render, and only while the runtime flag under which the scene draws that element is set. Example: `src/features/countertopPlacement/lib/readEditSizeButtonRect.ts`.

## Dividers

- Only `features/dividers/adapter/` knows `ConfiguratorAPI.dividers.*`; `dividers/model/` imports no transport, React or Redux; `settle()` reads Redux at call time, never from a closure.

## Engineering tools

- Gate engineering-only UI behind a URL flag read with `new URLSearchParams(location.search).has(flag)`, off by default and mounted only for the collection it applies to.
- A new scene export in `public/HastingCabinetsParametrization/` comes with a bump of `PLAYCANVAS_VERSION` in `PlayCanvasIntegration.tsx` and a run of the scene-export tests.
