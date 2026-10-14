# Test UI (PlayCanvas side)

Portable debug / test panel over `window.ConfiguratorAPI`. No imports from the app, the scene or the
domain: copy `Scripts/dev-panel/` into another configurator and mount it.

- **Enable:** add `?testUI=1` to the page URL (the `flag` option changes the name).
- **Mount:** `mountTestUI({ window, getAPI: () => window.ConfiguratorAPI })` after the API is exposed
  (here: `bridge/global-bridge.mjs`, next to the cabinet debug panel). `destroy()` removes it.
- **Sections** (`sections/*.mjs`): `{ id, title, mount({ api, ui, log, refresh, root }) → { refresh?, dispose? } }`.
  `api()` returns the live API; `ui` are the components (`components.mjs`); `log(label, value)` writes to the panel log.
  - `presets` — base compositions (`presetProducts` payloads, editable JSON) + Remove all.
  - `cabinets` — collection → type → JSON config (`CATALOG`, project data); the scene locks the collection
    (read from `getEdgeCabinets` + `getConfig(id).productType`). Add via `addProduct` / `addProductByLeft` / `addProductByRight`,
    via the scene "+" (`setHandleButtonClick` → `setProductByParams`; the panel takes over the "+" callback while on),
    or by drag-and-drop for modular collections (`cabinetPlacement.beginAdd` → Apply / Cancel through the API-only
    `bridge/clients/cabinet-api-client.mjs` — the one import outside this folder). Select / remove / remove selected / remove all.
    Moving a placed cabinet by drag-and-drop is in the `urban-duplex` section only. The UD entries of `CATALOG` take
    their handle from `handleStyleFor(width)` (`sections/urban-duplex.mjs`).
  - `urban-duplex` — Urban Duplex (UD) columns, independent of `cabinets`: Test presets (a select of `UD_TEST_PRESETS` —
    the example + the six manufacturer cases — and Load = `removeAllProduct` → `importCompactPreset`, the JSON also lands in
    the Preset text area); Mode (56 on the floor / 28 column cabinet) → Type → Width (SKU lists),
    a Config readout with the exact `{ definitionId, selection }`; Start (`removeAllProduct` + `addProduct`), Add ← / Add →,
    Remove selected (`removeProduct`), Clear scene (`removeAllProduct`);
    the scene "+" (`setHandleButtonClick` → the available placement option of that "+" kind and anchor cabinet →
    `beginAdd` → `apply`), a Show filter (`setPlusFilter`), per selected column Hide / Show / Reset
    (`plusButtons.hideForColumn` / `showForColumn` / `reset`) and a `plusButtons.list()` readout (visible / hidden); compact preset v2
    Save / Restore / Example / Copy (`exportCompactPreset` / `importCompactPreset` / clipboard); drag & drop (Start D&D at a placement kind:
    first available / right end (a 28 hangs, a 56 stands on the floor) / over a lone bottom / under a hanging top; Move selected =
    `beginMove` of the scene selection; Place at X / Y in metres = `updateDraft` with a free wall placement, for snap tests;
    Apply / Cancel; a status readout of the open session with raw `placement` → `effectivePlacement` per axis, a snap shows as
    "(snapped)"); a composition readout (size, x/y, SupportGroupId).
    SKU widths and colours are constants at the top of `sections/urban-duplex.mjs`; the sample and test presets
    (`UD_SHARED`, the `v2()` builder, `EXAMPLE_COMPACT_PRESET`, `UD_TEST_PRESETS`) are in `data/urban-duplex-presets.mjs`.
  - `countertop` — D&D start/apply/cancel, Standard/Offset/Remote, offset X/Y steppers, length ±, resizeFrom,
    length limits, thickness (`setConfigBatch({}, { Thickness })`), material (`setConfigBatch({}, { CountertopColor })`),
    sink (`setConfig(<sink cabinet>, { sinkType })`) and a generic method caller for `countertop.*` / `countertopOverlay.*`.
    Test values (thicknesses, material names, sink types) are in `COUNTERTOP_TEST_VALUES` — edit them per project.
- **Add a section** for cabinets / side panels: create `sections/<name>.mjs` with the contract above and add it to
  `DEFAULT_SECTIONS` in `test-ui.mjs` (or pass `sections` to `mountTestUI`). The `ui.methods(label, getNamespace)`
  component exposes every function of an API namespace with JSON args, so new API methods are testable at once.
- **Errors** are logged as slugs only: `CODE · REASON_CODE…` (the message only when there is no code).
- **Cabinet-section helpers** (`components.mjs`, shared by `cabinets` and `urban-duplex`): `failure(code, reasons)`,
  `slug(error)` and `cabinetSectionHelpers(api, client)` → `need`, `connectReady`, `selectedCabinetId`, `keepConnected`
  (the 3-s reconnect of the cabinet client from `refresh`).
- **Input isolation:** wheel, clicks and keys inside the panel stop at the panel (`isolateInput`), so the camera
  does not zoom/orbit and the scene does not select or fire hotkeys; a gesture started on the canvas keeps working over the panel.
- **Test:** `node --test tests/node/test-ui.test.mjs` (fake DOM, fake API).

## Phase 1 (Oct 2026)

The `countertop` section gained the following controls:

- **Guard** toggle. Off (default) sends `{ validation: 'skip' }`. On makes the API reject an invalid pose with `COUNTERTOP_POSE_INVALID`.
- **Lock Y** toggle, which calls `setVerticalLocked`.
- **−1″ left** and **+1″ right** buttons, which call `resizeFrom`. They also work on a standard top.
- A sink landing readout showing `sink.landing` and `sink.pending`.
- **Move sink here** button, which calls `cabinets.moveSink(sink.pending)`.
- `sink-landing` actions are written to the log.
- The State readout now includes `validation`, `verticalLocked`, `verticalLockViolated` and `canResize`.

Full contract: `docs/countertop/ui-integration-phase1.md`.
