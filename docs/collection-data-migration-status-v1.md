# Collection data migration status v1

This document is the Developer A handoff for the collection-data boundary introduced in September 2026. It records the production consumers that still know Urban Standard Height data directly. The boundary is ready; the consumer migrations remain with Developers B, C, D, and I.

## Public contract

`useActiveCollection()` returns this state union:

```ts
type ActiveCollectionState =
  | { status: "resolving" }
  | { status: "loading"; collectionId: string }
  | { status: "ready"; collectionId: string; data: LoadedCollectionData }
  | { status: "error"; collectionId?: string; error: CollectionError };
```

The provider is mounted inside the root router and always renders its children. Consumers must read data only from `ready`. A declared source failure produces `error`; an explicit empty or unknown identity never falls back to USH. Optional manifest references remain absent in both `sources` and `catalog`.

`LoadedCollectionData` has two deliberately separate views:

```ts
type LoadedCollectionData = {
  id: string;
  manifest: CollectionManifest; // label, flexible defaults, defaultPresetId, source declarations
  sources: {
    local: { navigation?; presets?; staticOptions?; cabinetSkuMappings? };
    remote: { configurator?; countertopTable?; cabinetTable? };
  };
  catalog: {
    navigation?;
    presets?;
    staticOptions?;
    cabinetSkuMappings?;
    configurator?: { groups; groupsByName };
    cabinets?: ConfiguratorCatalog;
    countertops?: CountertopMatrixRule[];
  };
};
```

Use `sources` for diagnostics against validated source-shaped responses. Use `catalog` for application behavior. The collection domain preserves unknown remote metadata, table-row fields, and preset-product extensions while keeping normalized cabinet and countertop behavior in the existing parsers.

`withCollectionId(targetUrl, collectionId)` adds or replaces only `collectionId` in the target URL and retains that target's existing query parameters and hash. It does not copy unrelated parameters from the current page.

`resolveCollection({ registry, urlCollectionId, savedCollection })` is the React-independent restore contract. A valid saved ID takes precedence over the URL. An absent `collectionId` field in a saved legacy payload resolves to `urban-standard-height`; explicit `null`, empty, and unknown saved values return a typed failure.

## Consumer audit

All statuses below are `Pending downstream migration` unless stated otherwise. Developer A has intentionally left these production consumers unchanged.

| Consumer | Current source | Target API | Owner | Status |
| --- | --- | --- | --- | --- |
| `widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx` | Configurator ID `4` | `data.sources.remote.configurator` or `data.catalog.configurator` | I | Pending downstream migration |
| `pages/prebuilt/model/ModelPage.tsx` | Configurator ID `4`; embedded `productMockData`; `productMockData[0]` default assumptions | `data.catalog.configurator`, `data.catalog.presets`, `data.manifest.defaultPresetId` | B | Pending downstream migration |
| `pages/prebuilt/cabinet/CabinetPage.tsx` | Configurator ID `4`; embedded cabinet option constants | `data.catalog.configurator`, `data.catalog.staticOptions` | B | Pending downstream migration |
| `pages/custom/cabinetColors/index.tsx` | Configurator ID `4`; embedded cabinet option constants | `data.catalog.configurator`, `data.catalog.staticOptions` | B | Pending downstream migration |
| `pages/prebuilt/countertop/CountertopPage.tsx` | Configurator ID `4`; DataTable `438`; embedded countertop/basin/thickness options | `data.catalog.configurator`, `data.catalog.countertops`, `data.catalog.staticOptions` | B | Pending downstream migration |
| `pages/custom/countertop/index.tsx` | Configurator ID `4`; DataTable `438`; embedded countertop/basin/thickness options and USH values | `data.catalog.configurator`, `data.catalog.countertops`, `data.catalog.staticOptions`, `data.manifest.defaults` | B | Pending downstream migration |
| `pages/prebuilt/accessories/AccessoriesPage.tsx` | Configurator ID `4`; embedded accessory options | `data.catalog.configurator`, `data.catalog.staticOptions` | B | Pending downstream migration |
| `pages/custom/accessories/index.tsx` | Configurator ID `4`; embedded accessory options | `data.catalog.configurator`, `data.catalog.staticOptions` | B | Pending downstream migration |
| `pages/prebuilt/faucet/index.tsx` | Configurator ID `4`; embedded faucet options | `data.catalog.configurator`, `data.catalog.staticOptions` | B | Pending downstream migration |
| `pages/custom/faucetHoles/index.tsx` | Configurator ID `4`; DataTable `438`; embedded faucet options | `data.catalog.configurator`, `data.catalog.countertops`, `data.catalog.staticOptions` | B | Pending downstream migration |
| `features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar.tsx` | Configurator ID `4` | `data.catalog.configurator` | B | Pending downstream migration |
| `features/swatchOrder/ui/SwatchOrder.tsx` | Configurator ID `4` | `data.catalog.configurator` | B | Pending downstream migration |
| `pages/prebuilt/summary/SummaryPage.tsx` | Configurator ID `4`; literal USH product/quote identity | `data.catalog.configurator`, `data.id`, `data.manifest.label` | D | Pending downstream migration |
| `pages/custom/summary/index.tsx` | Configurator ID `4`; DataTable `438`; literal USH defaults and product/quote identity | `data.catalog.configurator`, `data.catalog.countertops`, `data.manifest.defaults`, `data.id`, `data.manifest.label` | D | Pending downstream migration |
| `shared/hooks/usePriceCalculation.ts` | Configurator ID `4`; literal USH countertop and sink defaults | Pure collection data passed from `data.catalog.configurator` and `data.manifest.defaults` | D | Pending downstream migration |
| `pages/custom/cabinetBuilder/CabinetBuilderPage.tsx` | DataTable `439`; embedded presets; literal USH defaults | `data.catalog.cabinets`, `data.catalog.presets`, `data.manifest.defaults` | C | Pending downstream migration |
| `features/configurator-rule-core/countertop/hooks/useCountertopRules.ts` | DataTable `438` | Inject `data.catalog.countertops` into rule evaluation | C | Pending downstream migration |
| `entities/product/model/store/slice.ts` | Literal USH initial `CabinetColor`, `CountertopColor`, and `sinkType` | Initialize from `data.manifest.defaults` after collection readiness | C | Pending downstream migration |
| `entities/product/model/store/selectors.ts` | Literal USH values used to detect configuration changes | Compare with active `data.manifest.defaults` supplied to state logic | C | Pending downstream migration |
| `entities/product/ui/ProductModelsGrid/ProductModelsGrid.tsx` | 54 embedded USH presets and implicit fallback | `data.catalog.presets`; migrated runtime package is ready | B | Boundary ready; consumer pending |
| `pages/prebuilt/modelDetails/ModelDetailsPage.tsx` | Direct `productMockData` lookup | `data.catalog.presets` | B | Pending downstream migration |
| `widgets/SideNavigation/ui/SideNavigation.tsx` | `PREBUILT_STEPS` / `CUSTOM_STEPS` | `data.catalog.navigation` and `withCollectionId` | B | Pending downstream migration |
| `widgets/ConfiguratorSidebar/ui/ConfiguratorSidebar.tsx` | `PREBUILT_STEPS` / `CUSTOM_STEPS` | `data.catalog.navigation` and `withCollectionId` | B | Pending downstream migration |
| `features/StepNavigationBar/StepNavigationBar.tsx` | `PREBUILT_STEPS` / `CUSTOM_STEPS` | `data.catalog.navigation` and `withCollectionId` | B | Pending downstream migration |
| `features/bottomStickyBar/ui/BottomStickyBar.tsx` | `PREBUILT_STEPS` / `CUSTOM_STEPS` | `data.catalog.navigation` and `withCollectionId` | B | Pending downstream migration |
| `features/inSceneQuickEditorNotification/lib/resolveBacktrack.ts` | `PREBUILT_STEPS` / `CUSTOM_STEPS` | Pure navigation data supplied from `data.catalog.navigation` | B | Pending downstream migration |
| `pages/prebuilt/cabinet/constants.ts` and `pages/custom/cabinetColors/constants.ts` | Embedded cabinet UI options | Extend/use `data.catalog.staticOptions` | B | Pending downstream migration |
| `pages/prebuilt/countertop/constants.ts` and `pages/custom/countertop/constants.ts` | Embedded countertop, basin, thickness options and USH values | Extend/use `data.catalog.staticOptions` | B | Pending downstream migration |
| `pages/prebuilt/accessories/constants.ts` and `pages/custom/accessories/constants.ts` | Embedded accessory options | Extend/use `data.catalog.staticOptions` | B | Pending downstream migration |
| `pages/custom/faucetHoles/constants.ts` | Embedded faucet-hole options | Extend/use `data.catalog.staticOptions` | B | Pending downstream migration |
| `entities/countertop/lib/thicknessOptions.ts` and `entities/countertop/lib/countertopPricingSku.ts` | Global countertop thickness list | Pass collection static thickness data into the pure mapping functions | D | Pending downstream migration |
| `shared/lib/sku/cabinetSkuMaps.ts` and its `buildCabinetSku.ts`, `buildProductSku.ts`, and `summaryFormatters.ts` consumers | Global USH cabinet/drawer/handle/accessory SKU maps | Pass `data.catalog.cabinetSkuMappings` into SKU builders | D | Pending downstream migration |
| `shared/lib/sku/countertopSkuMaps.ts` and `shared/lib/sku/resolveDefaultBasinByCountertopColor.ts` | USH countertop/basin aliases and defaults | Future collection-declared pricing/SKU contract after D integration | D | Pending downstream migration |

The numeric `id: 4` entries inside UI option arrays in `pages/**/constants.ts` and `ProductModelsGrid.tsx` are local option or preset IDs, not configurator source references. They were reviewed and excluded from the remote-source rows above. Commented `productMockData[0]` examples in `features/bottomCanvasButtons/BottomCanvasButtons.tsx` are dead code; the live `productMockData[0]` assumptions are recorded under `ModelPage.tsx`.

## Scope and completion

Developer A owns the collection domain, production USH package, root provider, pure URL and restore contracts, frozen API fixtures, fixture UI/rules proofs, and this audit. Developer A does not migrate page rendering or navigation (B), Redux configuration state or Save/restore orchestration (C), pricing/SKU/summary behavior (D), or PlayCanvas bindings (I).

Developer A completion is evaluated from those artifacts and automated tests without waiting for downstream migrations. The planning files under `plans/` were read as input and left unchanged.

Human review is required before this v1 handoff is marked complete. The reviewer should confirm consumer coverage, B/C/D/I ownership, and that the target APIs are clear enough for each downstream migration.
