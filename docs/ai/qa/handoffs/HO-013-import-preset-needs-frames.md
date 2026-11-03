# HO-013: `composition.importPreset` only advances while the render loop ticks, so a restore never finishes in an unpainted tab

Date: 2026-11-03. Status: OPEN — PlayCanvas command completion is tied to `requestAnimationFrame`; the frontend cannot finish the command for the scene.

| Field               | Value                                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Risk / severity     | S2 wrong configuration state (the whole rule layer evaluates against zero cabinets: price $0.00, cabinet-type cards wrong, the two-Sink-Base limit and the max-length check skipped) · reproduces on every load whose tab is not painted                      |
| Owning boundary     | PlayCanvas scene — **verified** (measured in the loaded runtime: the command resumes the moment frames resume, with no other input)                                                                                                                           |
| Environment / build | Local dev `http://localhost:5174`, export `public/HastingCabinetsParametrization` (`index.html?v=041`), `js/esm.mjs` SHA-256 `b0ebaa3bada664231f4229e8abf2cf8ef7ebf5c649516340aa1a342d471eb962`; Chromium (Claude desktop browser pane), 800×600 and 1440×900 |
| Entry               | `/restore?configId=15816` → `/custom/cabinet-builder?configId=15816&collectionId=urban-low-height`                                                                                                                                                            |
| Scene / product ids | `ULH-sink-cabinet-<uuid>` (120 cm), `ULH-side-cabinet-<uuid>` (60 cm), `Top_Solid-<uuid>`; command `composition.importPreset`                                                                                                                                 |
| Test account role   | anonymous                                                                                                                                                                                                                                                     |
| Frequency           | 6 of 7 observed loads stalled; the one that did not was the load during which the pane was being screenshotted continuously                                                                                                                                   |
| TC / rule           | restore flow (C09) · `restoreSavedConfiguration` status contract                                                                                                                                                                                              |

## Starting state

Fresh load of the saved configuration 15816 (Urban Low Height, one Sink Base + one Side Cabinet under a `Top_Solid`). The scene renders the two cabinets within a second or two; the React store still holds nothing.

## Steps to reproduce

1. Open `http://localhost:5174/restore?configId=15816`.
2. Leave the tab unpainted — in a browser, switch to another tab; in an automation pane, simply do not request a frame.
3. Wait. Read `state.rootStateUI.configuration.restore` and `state.rootStateUI.product.productIds`.
4. Make the tab paint again (switch back, or take a screenshot).

## Expected

`composition.importPreset` resolves on its own. The restore reaches `status: "restored"` and the store receives the two runtime ids, whether or not the tab is being painted — a command's completion must not depend on the render loop.

## Actual

While the tab is not painted the command never settles. Measured in the loaded runtime:

| moment                      | scene fps | `restore.status` | `productIds` |
| --------------------------- | --------- | ---------------- | ------------ |
| during the stall            | **0.0**   | `restoring`      | 0            |
| after three forced repaints | **70.2**  | `restored`       | 2            |

Nothing else was touched between the two rows — no click, no API call, only frames.

The stall has no upper bound: observed 25 s, 59 s, 95 s, 149 s and "still running" at 160 s, each ended by the pane happening to paint. `document.visibilityState` reads `"visible"` in both states, so it is the compositing, not the Page Visibility API, that matters.

The scene does its visible work regardless: both cabinets are in `compositionManager.getProductEntitiesByCategory('cabinets')` within ~1 s. Only the promise is outstanding.

## Frontend evidence

Temporary marks on every `await` of the restore path (removed again) on one stalled load:

```
0.0s  start
0.5s  record-loaded          backend answered in 0.5 s
0.5s  plan-start
0.5s  restorer-start
0.5s  importLayout-start
59.0s importLayout-done:imported     <- the whole wait
59.0s reader.read (2)  0.0s
59.0s restorer-done:restored
59.0s applyPage        0.6s
59.6s finished
```

Every other step is milliseconds. The call chain is
`restoreSavedConfiguration` (`src/features/configurationRestore/lib/restoreSavedConfiguration.ts:97`) →
`createSceneRestorer.restore` → `importLayout` (`src/features/playCanvasAdapter/lib/createSceneRestorer.ts:176`) →
client `composition.importPreset` (`src/features/configuratorApi/client.ts:415`) →
`runInBatchQueue` (`src/utils/functions/playcanvas/setConfigBatch.ts:21`) →
`ConfiguratorAPI.composition.importPreset`.

Narrowing inside the scene, during a stall:

- the main thread is free — injected JS answers instantly, so it is not CPU-bound;
- `app.assets`: 1768 loaded, **0 loading**, so it is not an asset download;
- `modules.whenSettled`, `aggregator.whenIdle`, `countertopCompositionAdapter.whenSettled` and `cabinetCoverCompositionAdapter.whenSettled` all resolve immediately when called directly, so it is not the post-commit settle;
- calling `compositionManager.importCompositions(...)` directly with the exported composition reproduces it: still unresolved at 64 s in an unpainted pane.

That leaves the frame-driven work inside `importCompositions` (`Scripts/app-configuration/domain/composition/composition-manager.mjs:1784`): the per-product `createProductEntity` loop and `_executeProductRules`, whose SmartStretch / MeshBoolean / aggregator steps advance on `app.on('update')`.

## Why the frontend cannot fix it safely

The command is a promise the scene owns; the UI has no way to finish it. Forcing frames from the parent document is not available to the iframe's own loop, and abandoning the promise after a timeout would leave the scene rebuilt while the store believes the restore failed — the exact desync this handoff is about, made permanent.

## Requested change from the owner

1. `composition.importPreset` (and any command routed through the local runtime's `committed()`) must settle without depending on `requestAnimationFrame` — either by driving the needed passes synchronously inside the command, or by pumping the scene's update loop for the duration of a command.
2. If a command genuinely needs frames, it must fail with a code (e.g. `SCENE_LOOP_STALLED`) after a bounded wait rather than hanging, so the bridge can surface it.

## Acceptance criteria

- [ ] With the tab hidden or unpainted from the moment of load, `/restore?configId=15816` reaches `restore.status: "restored"` and `productIds.length === 2`, with no repaint in between.
- [ ] `compositionManager.importCompositions(exported, { replaceCompositionId: 'cabinets' })` resolves in an unpainted tab.
- [ ] Scene fps during the command is irrelevant to its duration (measure `app.on('update')` ticks as above).

## Proposed regression tests

- Scene (node): a `composition.importPreset` test that never advances a frame and asserts the promise settles.
- UI: a restore test asserting `restore.status` leaves `"restoring"` within a bounded time.

## Dependencies / open decisions

- The frontend side has its own gap, tracked separately, not for this owner: the shared `runInBatchQueue` (`setConfigBatch.ts:21`) is a single global serial queue with no timeout, so one unsettled command blocks every later scene call; and the restore shows no "restoring" state in the UI, so the user sees a finished-looking page with zero cabinets.
- The same measurements were taken in the Claude desktop browser pane. A real Chrome tab left in the background is the same condition, but the owner should confirm the numbers there before sizing the fix.
