# Feature index — where things live

Revision 1 · 2026-10-28 · paths verified at HEAD `cd4f3053`. One row per feature; open the first path, then follow `dependency-graph.md`. Layer rules: `ai/project_conventions.mdc`.

| Feature | Entry files |
|---|---|
| Routing, steps per collection | `src/app/router/routerConfig.tsx`, `src/features/collectionCustomization/lib/buildStepRoutes.ts`, `public/collections/<id>/ui.json` |
| Collection loading, validation | `src/entities/collection/lib/loadCollection.ts`, `src/entities/collection/ui/ActiveCollectionProvider.tsx`, `public/collections/registry.json` |
| Field → command → scene | `src/features/collectionCustomization/ui/FieldControl.tsx`, `src/features/configurationCommands/`, `src/features/playCanvasAdapter/` |
| Scene bridge, iframe, readiness | `src/utils/functions/playcanvas/sceneBridge.ts`, `src/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx` |
| Cabinet limits, builder rules | `src/entities/product/lib/cabinetTypeLimits.ts`, `src/features/configurator-rule-core/cabinetBuilder/` |
| Countertop rules, length, thickness | `src/features/configurator-rule-core/countertop/` |
| Countertop placement, offset/remote, resize, sink lift | `src/features/countertopPlacement/` |
| Drag & drop (ULH, UD) | `src/features/cabinetPlacementDebug/ui/CabinetPlacementDebug.tsx` |
| Side panels | `src/features/sidePanel/`, `docs/side-panel-logic.md` |
| SKU | `src/shared/lib/sku/`, `public/collections/<id>/sku-profile.json` |
| Price | `src/shared/hooks/usePriceCalculation.ts`, `src/shared/lib/pricing/` |
| Summary, quote PDF | `src/pages/prebuilt/summary/SummaryPage.tsx`, `src/pages/custom/summary/index.tsx` (USH), `src/features/quotePrint/lib/printQuote.ts` |
| Save, share, restore | `src/features/saveConfiguration/`, `src/features/configurationRestore/`, `src/pages/restore/RestoreConfigurationPage.tsx` |
| Undo/redo | `src/entities/history/`, `src/features/bottomCanvasButtons/BottomCanvasButtons.tsx` |
| PlayCanvas export (do not edit) | `public/HastingCabinetsParametrization/` |
| E2E helpers (scene reads) | `e2e/support/configurator.ts`, `e2e/support/scene.ts` |
