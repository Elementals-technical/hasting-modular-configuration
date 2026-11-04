# HO-012: Class — shrinking a cabinet leaves a gap in the row and drags the countertop off the row

Date: 2026-11-03. Status: OPEN — PlayCanvas layout/CSG timing; no frontend change is possible or planned.

| Field               | Value                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Risk / severity     | S3 geometry/visual (cabinets not flush, countertop uncovers one cabinet and overhangs the other) · reproduces on every shrink           |
| Owning boundary     | PlayCanvas scene source — **verified** (measured in the loaded runtime; the frontend only sends `setConfig(productId, { Width })`)      |
| Environment / build | Staging `https://hasting-modular-phase-2-p98qb.ondigitalocean.app`, scene `Hasting-phase-2-stage-v99`, `js/esm.mjs` SHA-256 `2b47c0839047ecce6dffade1ed7bdae34b0928b29a2b31081782c2daf97bfa91`; Chrome (Playwright, channel chrome, headless), 1600×950 |
| Also present in     | Source checkout `hasting-modular-playcanvas-flow-git/src` and the installed v100 export (`compositionManager.recalculateLayout()` still called synchronously on `sizeChanged`) — **not** a v99-only defect                                            |
| Entry               | `/prebuilt/model?collectionId=class`, card `Class Vanity 55" 1-Drawer 1` (SB 60 + SC 80); Custom Mode ▸ Resize ▸ Width                 |
| Scene / product ids | `Class-sink-cabinet` (order 0, anchor), `Class-side-cabinet` (order 1); nodes `CLMa_Cabinet_Walls`, `CLMa_Cabinet_Floor`, `Top_Solid`   |
| Test account role   | anonymous                                                                                                                              |
| Frequency           | 2 of 2 runs for the right-most cabinet; the same error (smaller magnitude) on the left/anchor cabinet                                   |
| TC / rule           | spec §7.1 (cabinets stay flush in one row) · QA rows C-8, MOB-2                                                                        |

## Starting state

Fresh load of the prebuilt Class model `55" 1-Drawer 1`: two cabinets, `Width` 60 (left, anchor) and 80 (right), countertop length 140.05 cm spanning [-30, 110.05] cm; the row is flush (0.05 cm engine gap, `CABINET_LAYOUT_GAP_METERS`).

## Steps to reproduce

1. Open the entry URL, skip the intro, select the card `Class Vanity 55" 1-Drawer 1`.
2. Switch to Custom Mode (the defect does not depend on the mode — it also reproduces by resizing in the prebuilt scene).
3. Reduce the right-most (80 cm) cabinet: Resize ▸ Width ▸ 23.6" — i.e. `ConfiguratorAPI.setConfig('Class-side-cabinet', { Width: 60 })`.

## Expected

Both cabinets stay flush in one row and the countertop covers the row edge to edge (spec §7.1).

## Actual

The shrunk cabinet keeps roughly the centre of its old slot, leaving a gap, and the countertop follows it:

| step                                       | left cabinet    | right cabinet       | gap      | countertop                      |
| ------------------------------------------ | --------------- | ------------------- | -------- | ------------------------------- |
| baseline 60 + 80                           | [-30, 30]       | [30.05, 110.05]     | 0.05     | 140.05 → [-30, 110.05]          |
| **80 → 60**                                | [-30, 30]       | **[38.25, 98.25]**  | **8.25** | 120.05 → **[-21.8, 98.25]**     |
| manual `recalculateLayout()` after the CSG | [-30, 30]       | [30.05, 90.05]      | 0.05     | stayed at [-21.8, 98.25]        |
| 60 → 80 (grow)                             | [-30, 30]       | [30.05, 110.05]     | 0.05     | 140.05                          |
| left/anchor 60 → 40                        | [-25.12, 24.96] | [28.25, 108.25]     | **3.29** | 110.05                          |

All values in cm, world mesh bounds. The 8.25 cm step matches the QA report (gap 8 cm, cabinet starting at x = 38, countertop −22…98). Price is unchanged ($9,240) because it is derived from configs, not geometry.

## Frontend evidence

Width changes take the direct-product path: `createPlayCanvasRuntimePort.ts:223` → `scene.applyProduct(productId, patch)` → `ConfiguratorAPI.setConfig(productId, { Width })`. One call, correct product id, correct target width; the resulting `getConfig(id).Width` is 60 and the countertop state length (120.05 cm) is correct. Only the geometry placement is wrong, so there is nothing in the payload the UI could change.

## Root cause — verified

`CompositionManager.recalculateLayout()` → `PositionBuilder.build()` → `AutoPlacementService.getPosition()` measures a cabinet by its **mesh AABB** (`offsetDistance = refHalfSize + gap + newHalfSize`). `ProductConfigPlugin.setConfig` (`bridge/plugins/product-config.plugin.mjs:152`, same pattern at :372 for `setConfigBatch`) calls it **synchronously** right after `_executeProductRules`, while `SceneTransformHelper.setStretch` (`helpers/scene-transform-helper.mjs:92-99`) has only *requested* the CSG rebuild (`meshBoolean.requestBoolean()`, after frame sync).

`CLMa_Cabinet_Floor` carries both `smartStretch` and `meshBoolean` (cutters `Mako_Cabinet_SBBoolBox`, `Mako_Bot_DrawerBoolBox`, `Mako_Top_DrawerBoolBox`), so in the layout frame it is still the old width while the walls are already stretched. Snapshot taken inside `recalculateLayout` (patched method, same frame):

| node                       | at `before-recalc` | +1.5 s |
| -------------------------- | ------------------ | ------ |
| `CLMa_Cabinet_Walls`       | **60** (stretched) | 60     |
| `Class_Bot_Drawer_HInsert` | 58.8               | 58.8   |
| `CLMa_Cabinet_Floor`       | **76.39** (old 80) | 56.39  |

Engine debug event for the 80 → 60 step (`ConfiguratorAPI.dividers.getDebugEvents({ stageIncludes: 'AutoPlacement' })`): `refSize 0.6`, `newModelSize 0.7639`, `offsetDistance 0.6825`, `resultPosition.x 0.6825` → pivot 68.25 → body [38.25, 98.25]. The placement error is `(oldWidth − 3.61 − newWidth) / 2` cm.

Consequences worth recording:

- **Growing only looks correct.** The stale floor is then narrower than the new walls, so the walls define the AABB. Same defect, invisible in that direction.
- **Not only the edge cabinet.** Shrinking the left/anchor cabinet 60 → 40 also leaks 3.29 cm; the QA note "shrinking the middle or left cabinet keeps the row flush" does not hold, the error is just smaller for a smaller delta.
- **Composition data is intact.** A second `recalculateLayout()` after the CSG settled closes the gap to 0.05 cm — only the measuring moment is wrong. The countertop did not follow that manual pass, so its placement must be re-run together with the layout.
- Other boolean nodes with the same exposure: `Class_Top_Drawer_Floor`, `Mako_Bot_DrawerWalls`, `Mako_Top_DrawerWalls`.
- **Why ULH/UD are immune:** `MODULAR_COLLECTIONS` (`domain/cabinet-placement/modular-collections.mjs`) covers only ULH and UD, which lay a row member from the row's left edge instead of its own half-extent. Class/Mako/Tricot/Urban use the legacy packed layout. Established by reading the code; not verified by an ULH run.
- **MOB-2** is the same defect; it does not depend on viewport, so no separate cause needs looking for.

## Why the frontend cannot fix it safely

The scene owns cabinet placement and countertop placement. The UI has no command to move a cabinet pivot, and faking one would desync geometry from the composition order, the countertop state and the SKU. The PlayCanvas source and the export in `public/HastingCabinetsParametrization/**` are read-only in this checkout.

## Requested change from the owner

1. **Preferred:** let `setConfig` await the CSG rebuild before laying out — `MeshBooleanQueue` and `scene-boolean-helper.mjs:63` already expose promise/queue paths — then `recalculateLayout()` and the aggregator. Keeps the existing "measure the mesh" design.
2. **Alternative:** make the nominal `Width` from the product config authoritative in the legacy layout instead of the mesh AABB. Removes the timing dependency entirely, but changes `PositionBuilder` / `AutoPlacementService` for every legacy collection.
3. **Cheap mitigation:** add the boolean nodes (`CLMa_Cabinet_Floor`, `Class_Top_Drawer_Floor`, `Mako_Bot_DrawerWalls`, `Mako_Top_DrawerWalls`) to `aabbIgnoreNodes` for Class/Mako — the mechanism already exists (`collectAabbIgnoreNodes`, `product-registry-v2.mjs:231`, next to `BotDrawerFramingDD`). Risk: where such a node genuinely is the widest, the measured extent becomes smaller than the real one.
4. Not recommended: re-running `recalculateLayout()` after the CSG. It works, but the row visibly jumps and the countertop has to be moved separately.

## Acceptance criteria

- [ ] Shrinking any cabinet in a Class row (edge, middle, anchor) leaves the engine gap only (≤ 0.05 cm), with no intermediate jump.
- [ ] The countertop spans the row edge to edge after the shrink: no uncovered cabinet, no overhang.
- [ ] Growing stays flush (it must not regress when the measuring source changes).
- [ ] Mako / Tricot / Urban rows unchanged; ULH / UD rows unchanged.
- [ ] Price and SKU unchanged by the geometry fix (they already follow configs).

## Proposed regression tests

- Scene: a width-shrink case per legacy collection asserting the neighbour distance right after `setConfig` resolves (not after a timeout).
- UI: a QA pass over C-8 / MOB-2 on the installed export after delivery, plus `sceneKeysInExport.test.ts` when the export is replaced.

## Side observations (not verified, not part of this defect)

- `Width = 70` on `Class-side-cabinet` left the cabinet mesh at 80 cm while the config and countertop went to 70 (130.05 cm). `RuleWidthCabinetClass` has breakpoints [40, 60, 80, 100, 120] with no 70, while the UI offers 70 cm (27.6"). Could also be an insufficient wait; not investigated separately.
- At `Width = 40` the sink `Sink_LV890` (50.08 cm) is wider than the 40 cm carcass and protrudes.

## Evidence

`.work/diagnostics/c8-class-resize-gap.md` (full report) and `.work/diagnostics/c8/` (`repro.mjs`, `probe.mjs`, `probe2.mjs`, run logs, screenshots). Local evidence, not committed artifacts.

No scene, source or export file was changed in this task.
