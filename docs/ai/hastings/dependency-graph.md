# Dependency graph — attribute → consumers

Revision 1 · 2026-10-28 · every path below was checked to exist at HEAD `cd4f3053`. Use it for blast radius: each changed attribute must be re-verified at **every** consumer in its row (scene, UI, SKU, price, summary, save/share, PDF, undo). Rules: `domain-rules.csv`; oracle: `sku-price-oracle-map.md`.

## Shared pipeline (one selection)

`collectionCustomization/ui/FieldControl.tsx` → `configurationCommands/hooks/useAttributeChangeHandler.ts` (+ history step `entities/history/lib/useHistoryStep.ts`) → `configurationCommands/hooks/useChangeAttribute.ts` → `lib/evaluateChange.ts` (validation, change plan, confirmation modal) → `lib/applyPlan.ts` → `entities/configuration/model/runtimePort.ts` → `playCanvasAdapter/lib/createPlayCanvasRuntimePort.ts` (bindings from `public/collections/<id>/runtime-bindings.json`) → `utils/functions/playcanvas/sceneBridge.ts` → iframe `ConfiguratorAPI.setConfigBatch` → `lib/commitChange.ts` (only writer of committed values). Partial scene result → out-of-sync flag → `configurationCommands/lib/sceneStateSync.ts` reads sizes/order back; Save is guarded by `saveConfiguration/lib/restoreSaveGuard.ts`.

Price: `shared/hooks/usePricingInput.ts` → `usePriceCalculation.ts` → `shared/lib/pricing/priceRequests.ts` → GET `pricing-v2/resolve?sku=` (backend) → `priceStore` → sidebar total and Summary (`pages/prebuilt/summary/SummaryPage.tsx`; USH custom: `pages/custom/summary/index.tsx`) → quote PDF `features/quotePrint/lib/printQuote.ts`. SKU: `shared/lib/sku/resolveSkuProfile.ts` → `createSkuBuilders.ts` / `buildCollectionSkus.ts` (per-collection `sku-profile.json`; USH `skuSeries.ts` + `cabinet-sku-mappings.json`).

Persistence: `saveConfiguration/hooks/useSaveCurrentConfiguration.ts` (POST, write) → share `lib/buildConfigurationShareUrl.ts` → restore `pages/restore/RestoreConfigurationPage.tsx` + `features/configurationRestore/`. Undo/redo: `entities/history/model/store/slice.ts` (max 30, blocked during drag), `lib/captureSnapshot.ts` / `restoreSnapshot.ts` / `moveInHistory.ts`; buttons `features/bottomCanvasButtons/BottomCanvasButtons.tsx`.

## P0 rows (cross-cutting invariants)

| # | Trigger | Rules / validation | Scene | SKU / price | Also re-check |
|---|---|---|---|---|---|
| D1 | Countertop **material/colour** | `configurator-rule-core/countertop/*` (`materialAvailability`, `rules`), auto-thickness | `CountertopColor` binding | `sku/countertopColorResolution.ts`, `buildCountertopSku.ts` → per-cm price | thickness (D2), basin options, lower-top colour (D6), summary line, PDF, undo |
| D2 | Countertop **thickness** | `countertop/thicknessCapabilities.ts`; movement `countertopPlacement/lib/useCountertopMovementMode.ts` | top geometry, brackets, can-move/resize | thickness token in countertop SKU | offset/remote legality, lifted top never silently lowered, length limits (D3) |
| D3 | **Composition width / length** | `countertop/lengthLimits.ts`, `hooks/useMaxCountertopLength.ts`; `entities/product/lib/cabinetTypeLimits.ts` (max 2 SB) | cabinets + top length, resize handles `countertopPlacement/ui/CountertopResizeHandles.tsx` | `entities/countertop/lib/calcCountertopWidth.ts` → `widthCm` in price request | side-panel 340 cm block (D5), double basin, 220 cm (Class/Tricot/Mako/Lame: note only) |
| D4 | **Basin over/off SB** (lift/land, SB↔SC) | `countertopPlacement/lib/useSinkLanding.ts`; remote/offset rules | `liftSink` / `landSink`, cabinet product swap | cabinet SKU SB vs SC, basin SKU | sizes offered after conversion (SB sizes must not remain), one history step, side panels |
| D5 | **Side panels** | `features/sidePanel/lib/sidePanelMiddleware.ts` (auto remove/restore), `configurationCommands/lib/changeSidePanels.ts` | `playCanvasAdapter/lib/createSidePanelPort.ts` | `sku/buildCollectionSidePanelSku.ts`, `buildSidePanelSku.ts`, USH `pricing/ushSidePanelLines.ts` | handle/drawer change (groove variant), reposition, countertop +2 cm, summary |
| D6 | **Lower countertop (cover)** ULH/UFS/UD | `countertopPlacement/lib/cabinetCoverPublisher.ts`, `useLowerCountertopDefaultColor.ts` | cover entries (`ConfiguratorAPI.cabinetCover`) via `shared/hooks/useCabinetCovers.ts` | `sku/buildCabinetCoverSku.ts`, `pricing/cabinetCoverItems.ts` | follows upper colour; length/material conflicts K-… |
| D7 | **Per-cabinet values** (UD Series, LateralPanelSide, heights, UFS short cabinet) | `configurationCommands/lib/perCabinetAttributes.ts` | `sceneBridge.ts` stepped products | per-series SKU | drawer alignment, undo |
| D8 | **Partial scene result** | `applyPlan.ts` → out-of-sync | scene ≠ store | price/SKU from store | `restoreSaveGuard.ts` blocks Save; save fragment must round-trip |
| D9 | **Undo/redo** | history slice + snapshot | full composition rebuild | recomputed | new attributes (LegColor, CabinetPattern, …) must survive undo |
| D10 | **CabinetType naming** | profile tables | `runtime-bindings.json` `productTypes`, export keys (`sceneKeysInExport.test.ts`) | `sku-profile.json` codes | Side- vs Sink-Cabinet spelling per family |

## Flow-level consumers

| Trigger | Consumers |
|---|---|
| `?collectionId` | read once (`entities/collection/ui/ActiveCollectionProvider.tsx`) → loader `entities/collection/lib/loadCollection.ts` → steps `collectionCustomization/lib/buildStepRoutes.ts`; switching family = full reload |
| Prebuilt model switch | keeps colours (client rule) → products, countertop, prices, summary |
| Scene drag & drop (ULH, UD) | `features/cabinetPlacementDebug/ui/CabinetPlacementDebug.tsx` (the real DnD widget) → placement commands → D3/D4/D5/D6 |
| Summary / quote | price lines must equal the sidebar total; PDF mirrors Summary |
