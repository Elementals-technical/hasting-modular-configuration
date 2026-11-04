# Tricot activation handoff

Status: updated 2026-11-03; delivered catalog and runtime inputs recorded, complete acceptance still open. This is the current issue 7 handoff. The sole maintained external request list is [open-questions.uk.md](open-questions.uk.md); the [prior handoff and question snapshots](../../docs/records/plans/2026-11-03-tricot-integration-status.md) preserve the dated delivery history and superseded blockers.

## Delivered inputs

- The published catalog has 42 ordered presets and 93 composition modules. Model 33, `Tricot 79 2DW 1_70` (preset 3979591210), is published as SB100 → SC40 → SC60, all 2 drawers, with one basin on the first module. The stable IDs, numbered alternatives and filters are preserved.
- All 42 model cards are available. The 41 original PNG hashes remain unchanged; model 33 uses the 300 px card cropped from the real client viewer’s front camera. Its original 404 URL is retained as provenance in `public/collections/tricot/sources/model-images.json`. No PNG request remains. The 2026-10-28 model selection/card/Dimensions acceptance is recorded under `docs/qa/tricot-2026-10-28/evidence/preset-add-33/`; it is not a new v100 retest.
- The approved 2026-10-28 correction of 20 layouts and subsequent publication of model 33 supersede the original 88-module delivery and intermediate 92-module state. Ordered compositions live in `public/collections/tricot/sources/preset-compositions.csv`; the independent regression fixture is `src/entities/collection/__tests__/fixtures/tricot-client-layouts-2026-10-28.json`. CSV position is module order; asymmetry/physical offsets require scene acceptance.
- The production manifest uses `runtime-bindings.json`: `Tricot-sink-cabinet` / `Tricot-side-cabinet`, cm Width/Height/Depth, drawers, CabinetColor and HandleGrooveColor are bound. The three wood assets — Noce Canaletto 933, Rovere Oro 932, Rovere Termocotto 931 — are available under their exact names and bound since the 2026-10-15 export. The old missing-wood request is closed; no substitute material is approved.
- Current profile/preset defaults are Rovere Oro 932, Satin, Agata 407 MT, no panels, BIANCO KOS 250 and integrated VA024. Earlier Cannette / Nero 433 MT / Matte White / LB440 defaults remain only in the archive. Cabinet Pattern is per module under semantic `DrawerPanelFluting`, translated to `CabinetPattern` (`Gessato` → `Gessatto`); its shared and selected-cabinet controls are described in [Tricot rule 11](../../docs/products/tricot/rules.md).
- Cabinet table 592 and countertop table 593 are integrated. `Sink-Cabinet` normalizes to semantic Side-Cabinet. Configurator 12 supplies swatch metadata within the profile’s allowlists: 23 cabinet colors, 20 groove colors, 71 countertop colors and 40 vessel colors. The cabinet catalog has five patterns and ten integrated basins.
- The accepted panel SKU suffix remains `-CAB-{material}-{color}` on `VAN-TRIC-SP-.8W-15.7H-20.5D`; quantity follows active sides, and unknown/stale readback still requires a blocking gap. Panels use the approved cabinet material/color and add 1 cm per active countertop side. These delivered rules do not establish current visual panel acceptance.

## Remaining acceptance and owner questions

- Keep the panel height/support/readback, basin switching/mounting and vessel-palette checks in [open questions 3–4](open-questions.uk.md). Earlier v44/v53 failures are dated observations requiring a v100 retest, not proof that the current export still has the same defect.
- Keep vessel minimum-width/depth confirmation and GB countertop/basin SKU, thickness, quantity and price examples in [open questions 6–7](open-questions.uk.md). Table 593 is a compatibility table, not the complete pricing contract; no Urban pricing fallback is authorized.
- Unit/catalog/adapter checks do not establish complete scene, pricing or save/undo/redo acceptance. The full checklist stays in [issue 8](08-real-scene-acceptance.issue.md).

## Acceptance sequence

1. Validate full catalog coverage and review asymmetry/placement against the real export; a recipe validator does not prove geometry or image content.
2. Integrate and validate outstanding owner answers from [open-questions.uk.md](open-questions.uk.md). Do not repeat requests for delivered recipes, cards, exact woods, types, defaults, tables or swatches.
3. Validate visual readback and pricing; do not remove availability, missing-activation gaps or runtime guards to bypass readiness.
4. Run collection contracts, TypeScript, changed-file lint, relevant tests and build, recording existing repository failures separately.
5. Execute [issue 8](08-real-scene-acceptance.issue.md) in both flows: single/inner drawers, numbered alternatives, asymmetry, double basins, materials/patterns, panels, Summary prices and save/undo/redo replay. The entry is `?collectionId=tricot`; the old “no working configurator” statement is historical.

Supply approved exports/files or repository paths, not credentials. Scene and product-table publication remain with their owners.
