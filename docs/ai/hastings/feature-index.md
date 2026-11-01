# Feature index — where things live

Revision 2 · 2026-11-01. A router, not a description: one row per feature, open the first path, then follow [`dependency-graph.md`](dependency-graph.md) for consumers. Layer rules: `ai/rules/project-conventions.md`. Every path in backticks is checked by `validate-guidance.mjs`; `<id>` stands for a collection id.

## Data and routing

| Feature | Entry files | Tests | Owner / rule |
|---|---|---|---|
| Collection package (data contract) | `public/collections/<id>/manifest.json`, `ui.json`, `product-profile.json`, `sku-profile.json`, `runtime-bindings.json`, `presets.json`; `public/collections/registry.json` | `src/entities/collection/__tests__/` | skill `hastings-<id>`, `docs/products/<id>/README.md` |
| Collection loading, validation | `src/entities/collection/lib/loadCollection.ts`, `src/entities/collection/ui/ActiveCollectionProvider.tsx` | `src/entities/collection/__tests__/collectionConsumerBoundary.test.ts` | invariant: loader only |
| Routing, steps per collection | `src/app/router/routerConfig.tsx`, `src/features/collectionCustomization/lib/buildStepRoutes.ts`, `src/pages/fieldsStep/FieldsStepPage.tsx` | `src/pages/fieldsStep/__tests__/` | `ui.json` steps |
| Product profile, runtime product type | `src/entities/product/types.ts`, `src/entities/product/lib/resolveRuntimeProductType.ts`, `src/entities/product/lib/buildSteppedSceneProducts.ts` | `src/entities/product/` (11 files) | `docs/product-profile-migration.md` |
| Presets (prebuilt models) | `public/collections/<id>/presets.json`, `src/shared/lib/shouldUsePresetProducts.ts`, `src/pages/prebuilt/model/` | `src/entities/collection/__tests__/` (`*Presets.test.ts`) | skill `hastings-<id>` |

## Configuration flow (UI → scene)

| Feature | Entry files | Tests | Owner / rule |
|---|---|---|---|
| Field → command → scene | `src/features/collectionCustomization/ui/FieldControl.tsx`, `src/features/configurationCommands/`, `src/features/playCanvasAdapter/` | `src/features/configurationCommands/__tests__/`, `src/features/playCanvasAdapter/__tests__/` | invariant: `useChangeAttribute` → port → adapter |
| Configuration state, runtime port | `src/entities/configuration/model/runtimePort.ts`, `src/entities/configuration/ui/CollectionStateBridge.tsx`, `src/entities/configuration/model/identity.ts` | `src/entities/configuration/model/__tests__/` | `docs/runtime-bindings-migration.md` |
| Scene bridge, iframe, readiness | `src/utils/functions/playcanvas/sceneBridge.ts`, `src/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx` | `src/features/playCanvasAdapter/__tests__/sceneKeysInExport.test.ts` | `docs/parent-configurator-integration.md` |
| ConfiguratorAPI contract (UI ↔ 3D) | `src/features/configuratorApi/bridge.ts`, `src/features/configuratorApi/client.ts`, `src/features/configuratorApi/countertop.ts`, `src/features/configuratorApi/cabinetCover.ts` | `src/features/configuratorApi/__tests__/` | skills `hasting-countertop`, `hasting-side-panels` (`references/contract*`) |
| Reason codes → UI texts | `src/shared/lib/reasonText/`, USH profile `messages` | `src/entities/collection/__tests__/reasonCodesHaveMessages.test.ts` | invariant: every code has a text |
| Scene refusals, in-scene notices | `src/features/sceneRefusalNotice/lib/sceneRefusalNotice.ts`, `src/features/inSceneQuickEditorNotification/model/useInSceneQuickEditorNotification.ts` | each feature's `__tests__/` | — |

## Placement and 3D-driven features

| Feature | Entry files | Tests | Owner / rule |
|---|---|---|---|
| Cabinet limits, builder rules | `src/entities/product/lib/cabinetTypeLimits.ts`, `src/features/configurator-rule-core/cabinetBuilder/` | `src/features/configurator-rule-core/cabinetBuilder/__tests__/` | `docs/ai/hastings/domain-rules.csv` (`R-*-CAB-*`) |
| Add cabinet from sidebar (+ placement, width) | `src/features/sidebar/lib/plusPlacement.ts`, `src/features/sidebar/lib/buildAddedCabinetRequest.ts`, `src/features/sidebar/lib/useVesselCountertop.ts` | `src/features/sidebar/lib/__tests__/` | `docs/cabinet-drag-and-drop-ui.md` |
| Drag & drop (ULH, UD) and its debug panel | `src/features/cabinetPlacementDebug/ui/CabinetPlacementDebug.tsx`, `src/features/cabinetPlacementDebug/lib/` | `src/features/cabinetPlacementDebug/__tests__/`, `e2e/ulh/` | `docs/cabinet-drag-and-drop-ui.md` |
| Countertop rules: length, thickness, style | `src/features/configurator-rule-core/countertop/` | `src/features/configurator-rule-core/countertop/__tests__/` | skill `hasting-countertop` |
| Countertop placement: offset/remote, resize, sink lift/land | `src/features/countertopPlacement/` | `src/features/countertopPlacement/__tests__/` | skill `hasting-countertop`, `docs/countertop-position-ui.md` |
| Side panels | `src/features/sidePanel/` | `src/features/sidePanel/__tests__/` | skill `hasting-side-panels`, `docs/side-panel-logic.md` |
| Drawer organizers / dividers (Phase 2) | `src/features/drawerOrganizers/ui/DrawerOrganizerLayer.tsx`, `src/features/dividers/adapter/DividerRuntimeAdapter.ts`, `src/features/dividers/controller/useDividerController.ts`, `src/entities/configuration/model/drawerOrganizers.ts` | `src/features/drawerOrganizers/__tests__/`, `src/features/dividers/controller/__tests__/` | `docs/drawer-organizers-ui.md` |
| Accessories step (organizers, towel bars) | `src/pages/accessories/AccessoriesPage.tsx`, `src/widgets/AccessoriesSections/ui/AccessoriesSections.tsx`, `src/widgets/AccessoriesSections/lib/towelBarColorOptions.ts` | `src/widgets/AccessoriesSections/__tests__/` | — |
| Full dimensions overlay | `src/features/fullDimensions/model/useFullDimensionsRefresh.ts` | — | — |

## Materials and commerce

| Feature | Entry files | Tests | Owner / rule |
|---|---|---|---|
| Cabinet colors, materials, price filter | `src/widgets/CabinetColorSections/ui/CabinetColorSections.tsx`, `src/shared/lib/buildMaterialLookup.ts`, `src/features/swatchOrder/ui/SwatchOrder.tsx`, `src/shared/lib/bookMatching/index.ts` | `src/widgets/CabinetColorSections/__tests__/`, `src/shared/lib/__tests__/` | `docs/ai/hastings/domain-rules.csv` (`*-CTML-*`), Material Pricing Tiers |
| SKU | `src/shared/lib/sku/`, `public/collections/<id>/sku-profile.json` | `src/shared/lib/sku/__tests__/` | `docs/ai/hastings/sku-price-oracle-map.md` |
| Price | `src/shared/hooks/usePriceCalculation.ts`, `src/shared/lib/pricing/buildCollectionPricingLines.ts`, `src/shared/lib/pricing/priceRequests.ts` | `src/shared/lib/pricing/__tests__/` (recorded fixtures: do not edit by hand) | oracle map; `RECORD_PRICES=1` only on request |
| Summary, quote PDF | `src/pages/prebuilt/summary/SummaryPage.tsx`, `src/pages/custom/summary/index.tsx` (USH), `src/features/quotePrint/lib/printQuote.ts` | `src/features/quotePrint/lib/__tests__/` | `ai/rules/paired-pages.md` |
| Save, share, restore | `src/features/saveConfiguration/`, `src/features/configurationRestore/`, `src/pages/restore/RestoreConfigurationPage.tsx` | `src/features/configurationRestore/__tests__/` | browser write guard (`docs/ai/qa/browser-validation.md`) |
| Undo/redo | `src/entities/history/`, `src/features/bottomCanvasButtons/BottomCanvasButtons.tsx` | `src/entities/history/__tests__/` | — |
| AR export | `src/entities/arConfiguration/api/arConfigurationApi.ts`, `src/pages/arDownload/ArDownloadPage.tsx` | — | — |

## UI shell and support

| Feature | Entry files | Tests | Owner / rule |
|---|---|---|---|
| Player, scene controls | `src/widgets/Player/`, `src/features/bottomCanvasButtons/BottomCanvasButtons.tsx`, `src/features/bottomStickyBar/` | `src/widgets/Player/` tests | — |
| Sidebar, step navigation | `src/widgets/ConfiguratorSidebar/`, `src/widgets/SideNavigation/`, `src/features/StepNavigationBar/StepNavigationBar.tsx` | `src/widgets/ConfiguratorSidebar/__tests__/`, `src/features/StepNavigationBar/__tests__/` | — |
| Prebuilt ↔ custom paired pages | `src/pages/prebuilt/`, `src/pages/custom/` | — | `ai/rules/paired-pages.md` |
| Tutorial, help center | `src/features/interactiveConfiguratorTutorial/model/steps.ts`, `src/widgets/helpCenter/` | `src/features/interactiveConfiguratorTutorial/__tests__/` | — |
| Icons | `src/shared/ui/AppIcon/AppIcon.tsx`, `src/shared/ui/AppIcon/createSceneIcon.ts` | — | `ai/rules/scss.md` › Icons |
| Analytics | `src/shared/lib/analytics/initGoogleAnalytics.ts`, `src/shared/lib/analytics/modularKeyEvents.ts` | `src/shared/lib/__tests__/` | — |

## Outside the UI code

| Feature | Entry files | Tests | Owner / rule |
|---|---|---|---|
| PlayCanvas export (do not edit) | `public/HastingCabinetsParametrization/` | `src/features/playCanvasAdapter/__tests__/sceneKeysInExport.test.ts` | `AGENTS.md` › Do not edit by hand; source: PlayCanvas Editor |
| E2E and browser scenarios | `e2e/support/configurator.ts`, `e2e/support/scene.ts`, `docs/ai/qa/scenarios/tc/` | `e2e/ulh/` | `docs/ai/qa/browser-validation.md` |
