# Runtime bindings and scene port status v1

This document is the Developer I handoff for the boundary between the configuration and the PlayCanvas scene introduced in September 2026. It records where scene keys and values now live, the single path through which C reaches the scene, the behaviour that changed on the way, and the production code that still talks to the scene directly. The boundary is ready; wiring it into the app belongs to Developer A (A07), and moving pages onto it belongs to C06 and later I tasks.

Covers I01 (runtime bindings), I02 (runtimePort and the PlayCanvas adapter), and I03 (execution order, steps and partial results).

Verified locally: `npm test` — 477 tests in 47 files, up from 404 in 40. `npm run build` succeeds. `npm run lint` reports the same 108 problems as before the change, with no new errors or warnings. Scene keys were checked against the scene source in `public/HastingCabinetsParametrization` and its bundled documentation. Browser behaviour was not verified.

## Public contract

### Runtime bindings of a collection

Each collection ships its own table next to its manifest, in `public/collections/<id>/runtime-bindings.json`. It says, for every migrated attribute, which scene key and value a semantic value becomes and which products receive it:

```ts
type RuntimeBindingSet = {
  schemaVersion: number;
  collectionId: string;
  productTypes: Record<string, string>;   // CabinetType value -> runtime product type
  unplacedProductTypes?: Record<string, string>; // CabinetType value -> why the scene cannot place it yet; temporarily hidden in the builder
  bindings: RuntimeBinding[];
};

type BoundRuntimeBinding = {
  attributeId: string;
  status: "bound";
  target: RuntimeTarget | FlowTargets;    // product | cabinets | all | productType, or per flow
  values: IdentityValues | MappedValues;  // sent as is, or value -> full scene patch
  order?: number;                         // phase the attribute is sent in
  resetBefore?: ScenePatch;               // step sent before the value
};

type UnboundRuntimeBinding = { attributeId: string; status: "unbound"; reason: string };
```

An attribute with no scene translation is declared `unbound` with its reason, so a deliberate gap is never mistaken for a forgotten one. Identity values may declare an `emptyValue` (a cleared groove colour is sent as `"None"`) and `overrides` (values the scene knows under another name).

The pure functions are exported from `@/entities/collection`:

- `parseRuntimeBindings(input)` validates the document and returns either the table or diagnostics carrying `code`, `dataPath` and `message`.
- `resolveRuntimeBinding(set, attributeId, value, flow?)` returns the target, patch, order and reset step, or the reason it cannot: `no-binding`, `unbound`, `unknown-value`, `flow-required`.
- `findMissingBindings(set, changes, flow?)` reports every change of a set without a translation, before anything is sent.
- `validateRuntimeBindings(profile, set, requiredAttributeIds)` cross-checks the table against the profile and the required attributes: missing bindings, missing catalog values, cabinet types without a product type, orphans, duplicates and a foreign collection.

The required list is every field of the collection's `ui.json` plus what C's commands can send without a field — the C01 registry and the dimensions: `[...uiFieldIds, ...CORE_ATTRIBUTE_IDS, "Height", "Width", "Depth"]`. `ui.json` alone is not enough: eleven bindings belong to no field, among them `Height`, which a handle change carries as a dependency.

### The port between C and the scene

```ts
type ConfigurationRuntimePort = {
  isReady(): boolean;
  apply<T extends RuntimeChange>(changes: readonly T[], context: RuntimeContext): Promise<RuntimeApplyResult<T>>;
};

type RuntimeContext = {
  collectionId: string;
  flow: "prebuilt" | "custom";
  resolveRuntimeId: (cabinetId: StableCabinetKey) => string | null;
  cabinetRuntimeIds: readonly string[];
};
```

`RuntimeApplyResult` has five statuses, each distinct:

| Status | Meaning | Scene touched |
|---|---|---|
| `applied` | Every change went through | Yes |
| `not-ready` | The scene cannot take commands | No |
| `unsupported` | Part of the set has no translation | No |
| `failed` | A command failed before anything reached the scene | No |
| `partial` | The scene changed before a command failed; `applied` may be empty | Yes |

The types live in `entities/configuration/model/runtimePort.ts` so C depends on the contract and not on the adapter. The type is generic, so C gets its own `PlannedChange` objects back.

`createTestRuntimePort()` from `@/features/playCanvasAdapter` records every set, context and resolved id, and can answer with each of the five statuses. It proves the contract and the order of what C hands over, nothing about the real scene.

### The adapter

`createPlayCanvasRuntimePort({ getBindings, scene? })` implements the port over the existing wrappers:

1. Everything that can be known without the scene is checked first: readiness, bindings of the right collection, a translation for every change, a runtime id for every addressed cabinet. If any check fails, nothing is sent.
2. The set runs phase by phase (`order`), keeping C's order within a phase. A binding without `order` runs after every declared one.
3. A value may take steps (`resetBefore`, then the value). A change counts as applied only when every step is. An identical step is sent once per set.
4. A broadcast must reach every placed cabinet: missing ids in the scene's `updatedIds` are a failure, not a success.
5. The first failure stops the set; the remaining changes are reported as `not-attempted`.

`getBindings` returns the active collection's table, `catalog.runtimeBindings` from `useActiveCollection()`. A loads it through the manifest (`local.runtimeBindings`) and validates it against the profile and the UI schema; a broken or foreign table blocks the collection with diagnostics. Until the collection is ready the callers pass `null`, so the port answers `unsupported` and nothing is sent. The temporary loader (`runtimeBindingsCache`, `RuntimeBindingsBridge`) was removed once A07 landed.

The scene side is `utils/functions/playcanvas/sceneBridge.ts`, the only place on this path that touches the iframe. `isSceneReady()` reads `playCanvasReady` and checks the batch API; `applySceneConfig(selector, patch)` sends one patch and turns the scene's answer into a status:

| Scene answer | Status |
|---|---|
| No iframe or API, `playCanvasReady` not set, or `[]` | `not-ready` |
| `true` (side panel, towel bar) | `applied` |
| `{ updatedIds }` containing every addressed product | `applied` |
| `{ updatedIds }` missing an addressed product | `failed: product-not-found` |
| `false`, `undefined`, anything else | `failed: scene-rejected` |
| Thrown error | `failed: scene-error` with its message |

It reuses the legacy batch queue through `runInBatchQueue`, so adapter commands and the remaining direct `setConfigBatch` calls never overtake each other.

### Changing a value

`changeAttribute` now takes the port and the flow, builds the context from the active profile and the C01 cabinet entries, and maps the result:

| Port result | `ChangeResult` | Written to state |
|---|---|---|
| `applied` | `applied` | Everything |
| `partial` | `partial`, `needsSync: true` | Only what went through |
| `not-ready` / `unsupported` / `failed` | `error: runtime-not-ready / runtime-unsupported / runtime-failed` | Nothing |

C's temporary port type and its stand-in were removed; the `TODO(I02)` they carried is closed.

### Actual scene state (I04)

```ts
type ConfigurationSceneReader = { read(runtimeIds: readonly string[]): Promise<SceneStateResult> };

type SceneStateResult =
  | { status: "ready"; order: string[]; cabinets: { runtimeId: string; dimensions: CabinetDimensions }[] }
  | { status: "not-ready" };
```

The scene fires no events of its own for sizes or order: `ConfiguratorAPI.swapProducts` and `setConfigBatch` fire nothing, and the composition only keeps `meta.lastModified`. The events are therefore the app actions dispatched once the scene has changed: `addProductId`, `insertProductIdRelative`, `removeProductId`, `swapProductIds`, `resetProducts`, `restoreProductState`, `setSelectedDimensions`, `syncSelectedDimensionsFromScene`, `commitRuleSelection` and `restoreCabinets`.

- `sceneBridge.readSceneProducts(ids)` reads the order from the active composition and the config of each product through the batch queue. Without a composition it answers `not-ready` instead of a fallback list, unlike `getOrderedProductIds`.
- `createSceneReader()` turns that into sizes per product. A product the scene has no config for gets no entry, never a neighbour's size. `createTestSceneReader()` is its stand-in.
- `setupSceneStateListener` (C, `configurationCommands/lib/sceneStateSync.ts`) waits 200 ms after the last event, reads the placed cabinets and dispatches `recordSceneState`. I never writes Redux.
- `recordSceneState` records the order through `reconcileOrder` and the size by stable key in `configuration.dimensionsByCabinet`. An id without a stable key is ignored, an unchanged size keeps its reference, and a removed cabinet loses its size. Sizes are not part of the snapshot: the saved per-product config carries them.

Consumers read a cabinet's own size through `resolveCabinetDimensions(entries, dimensionsByCabinet, runtimeId)` or `getCabinetDimensionsByRuntimeId`. The shared `selectedDimensions` is no longer used as another cabinet's size in `normalizeProductConfigSnapshot`, the preset items of the price hook and both summaries, or the divider depth of the summaries. The style sidebar no longer sends the selected cabinet's height and depth to every cabinet when the selection merely copies that cabinet's actual size.

### Scene restore (I05)

```ts
type ConfigurationSceneRestorer = {
  preflight(request: SceneRestoreRequest): SceneRestoreIssue[];
  restore(request: SceneRestoreRequest): Promise<SceneRestoreResult>;
};

type SceneRestoreRequest = { products: { sourceId: string; productType: string; config: Record<string, unknown> | null }[] };
```

`createSceneRestorer({ getBindings })` rebuilds a composition in composition order:

1. **Preflight**, before the scene is touched: a non-empty composition, unique source ids, a config per product, loaded bindings and a scene type for every product type through `productTypes` of the bindings (`Side-Cabinet` is placed as `Sink-Cabinet`). The scene's product registry is not reachable from the host page, so the table is the check.
2. The scene is cleared once (`removeAllProduct`), then each product is added on the right with `addProduct` and configured with `setConfig`. `addProduct` returns the runtime id, which gives the exact old → new mapping; `presetProducts` clears the scene itself and silently skips a product it cannot create, so it is not used here.
3. A product that fails does not stop the rest. The actual order is read back through the scene reader and compared with the request.

| Status | Meaning | Scene touched |
|---|---|---|
| `not-ready` | The scene cannot take commands | No |
| `rejected` | Preflight issues (`empty-composition`, `duplicate-source`, `invalid-config`, `unknown-product-type`, `bindings-unavailable`) | No |
| `restored` | Every product created, configured and in order; `matches` maps source ids to runtime ids | Yes |
| `partial` | The scene was cleared but a product was not created (`not-created`), its config refused (`config-rejected`), the order differs (`order-mismatch`) or clearing failed (`scene-error`); `matches` lists what exists | Yes |

The scene side is three new `sceneBridge` operations on the batch queue: `clearSceneProducts`, `addSceneProduct` (a missing id is a failure) and `setSceneProductConfig` (`false` from the scene is `product-not-found`; the legacy wrapper swallowed it). `createTestSceneRestorer()` is the stand-in.

**First consumer: undo/redo.** `restoreSnapshot(snapshot, { dispatch, getState })` builds the request from the history snapshot and returns the result. A snapshot product without a config is rejected instead of silently dropped. On `restored`/`partial` it records only the products that exist; the snapshot now keeps each product's stable key (`cabinetKeys`), and `restoreCabinets` gives the rebuilt products their keys back before the product ids change, so values addressed to a cabinet survive undo. Values of cabinets that are not in the rebuilt composition are dropped. `BottomCanvasButtons` moves the history only when the scene was rebuilt and logs a partial result.

## What moved into data

These translations now have one home in `runtime-bindings.json`. The legacy copies are still in place and listed in the consumer audit below.

| Was | Now |
|---|---|
| `"1D" / "2D" / "1DWID"` spelled out in eight components and reducers | `Drawers` map: `1 -> 1D`, `2 -> 2D`, `1+inner -> 1DWID` |
| `TowelBar: "TowelBar40_R", TowelBarSide: side` in five places, each clearing first | `TowelBarOption` map plus `resetBefore: { TowelBar: "None", TowelBarSide: "both" }` |
| `FALLBACK_GROOVE_RESET_VALUE = "None"` in `handleStyleConfig.ts:7` | `HandleGrooveColor` `emptyValue: "None"` |
| `SYNTESI_FINISH_CONFIGS` `configValue` in `syntesiOptions.ts:26` (`TAN -> TAL`, `TAP -> TAM`) | `CountertopColor` `overrides` |
| `sidecabinet: "Sink-Cabinet"` alias in `resolveRuntimeProductType.ts:15` | `productTypes["Side-Cabinet"] = "Sink-Cabinet"` |
| `VESSEL_PLACEHOLDER_SINK_TYPE = "Vessel"` | `sinkType` `emptyValue: "Vessel"` |
| `"Vessel" / "Integrated"` capitalised by hand | `CountertopStyle` map: `vessel -> Vessel`, `integrated -> Integrated` |
| Prebuilt `setConfigBatch({}, ...)`, custom `setConfigBatch(productIds, ...)` for grain and fluting | `byFlow` target: prebuilt `all`, custom `cabinets` |
| `VesselColor` sent to `{ productType: "Sink-Base" }` | `VesselColor` target `productType: Sink-Base` |
| Drawers, then handle, then height, spread across `CabinetBuilderPage.tsx:697-727` | `order`: `Drawers 10`, `Handle 20`, dimensions `30`, basin `40`, materials `50`, `VesselColor 60`, `TowelBarOption 70`, `TowelBarColor 80` |

Sixteen attributes carry a translation and fifteen are declared `unbound` with a reason (LED, faucet holes, BookMatching, SKU inputs, colour metadata, dividers, side panels, cabinet type). Every scene key the code sends is accounted for, and every key the scene reads is either bound or scene-internal (`SidePanelType`, `TowelBarType`).

## Behaviour changes that are not pure refactoring

These apply only on the adapter path; legacy calls behave as before.

1. **One-cabinet commands go through the batch API.** The adapter sends `setConfigBatch({ productIds: [id] }, patch)` instead of `setConfig(id, patch)`, so every command shares one queue and the scene's answer is checked. The scene handles both through the same product update, but this was not verified in the browser.
2. **`sinkType` is sent to every Sink-Base.** A basin-scoped change names no cabinet, and USH picks one basin for the whole configuration. Legacy code mixes this with per-cabinet and per-preset sends.
3. **`CountertopStyle` aliases added to the profile.** State stores `"Vessel"` / `"Integrated"` while the catalog holds `vessel` / `integrated`, so the value from state did not normalize. The profile now declares the capitalised spellings as aliases.
4. **Grain and fluting in custom reach every cabinet, not a selection.** `getSelectedProducts` returns `product.productIds`, all placed cabinets, despite its name; the binding is named `cabinets` to say so.

## Defects found

| Defect | Effect | Fixed |
|---|---|---|
| `setConfig` discards the scene's answer | "Product not found" (`false`) is indistinguishable from success | On the adapter path |
| `setConfig` and `setConfigBatch` return `null` for both not-ready and error | Readiness and failure cannot be told apart | On the adapter path |
| `setConfigBatch` expects an array, the scene returns `{ updatedIds }` (`setConfigBatch.ts:56`) | Dimension labels are not refreshed after a broadcast | No, legacy behaviour kept |
| `setConfig` bypasses the batch queue | Direct `setConfig` and `setConfigBatch` calls may run out of order | No, until pages move to the port |
| One handle click sends the handle patch twice (`RightCabinetStyleSidebar.tsx:455` and the effect at `:634`) plus height through another effect | Repeated commands for one action | Yes (C06): a handle choice is sent once through the adapter; a handle the rules change is sent once by a listener |
| Restore and the cabinet builder send `CountertopColor` from state untranslated | A Syntesi colour reaches the scene as `TAN`/`TAP`, which the scene does not know | No, suspected, not verified in the browser |
| Patches of two attributes merged into one call | The scene returns early on `SidePanel`, `TowelBar` and `TowelBarColor` and drops the other keys | Design constraint: the adapter sends one patch per change |

## Consumer audit

All statuses are `Pending downstream migration` unless stated otherwise. These consumers still hold scene keys or call the scene directly; Developer I left them unchanged.

| Consumer | Current source | Target API | Owner | Status |
|---|---|---|---|---|
| About 107 direct `setConfig` / `setConfigBatch` calls in pages, widgets and features | Scene keys and values inline | `changeAttribute` through the runtimePort | C (C06), B for page wiring | Pending downstream migration |
| `ModelPage.tsx:166`, `CabinetBuilderPage.tsx:197,204`, `RightCabinetStyleSidebar.tsx:783`, `PlayCanvasIntegration.tsx:1785`, `restoreSnapshot.ts:21`, `slice.ts:149`, `matrixCabinet.ts:31` | `1D <-> 1` drawer spellings | Profile aliases (`normalizeOptionValue`) for reading, bindings for writing | C | Pending downstream migration |
| `AccessoriesPage.tsx:812`, `custom/accessories/index.tsx:787`, `CabinetBuilderPage.tsx:1430`, `PlayCanvasIntegration.tsx:1627`, `restoreSnapshot.ts:114` | `TowelBar40_R` with a clearing step | `TowelBarOption` binding | C (C06), I (I05 for restore) | Pending downstream migration |
| `CountertopPage.tsx:1465`, `custom/countertop/index.tsx:1466` | `metadata.configValue ?? colorName` | `CountertopColor` overrides | C (C06) | Pending downstream migration |
| `restoreSnapshot.ts` (undo/redo) | Scene restorer | — | I (I05) | Migrated |
| `ModelPage.tsx` and `CabinetBuilderPage.tsx` restore by `configId` | `useRestoreSavedConfiguration` (C09) over the scene restorer; the pages keep only their state step | — | C (C09) | Migrated |
| `addPreset` when a preset is chosen (`ModelPage.applyPresetSelection`, Custom bootstrap) | `presetProducts` | Not a restore; stays until presets move to A's catalog | B, A | Accepted for now |
| `applySetWidth` / `applySetDepth`, `syncCountertopConfig` in `PlayCanvasIntegration.tsx` | Divider clearing/restoring and countertop sync around resize | Adapter steps once the helpers leave the component | I (I04), C (C06) | Pending downstream migration |
| `useSceneTotalWidth`, `useSinkBaseDimensions`, the selected-size polling in `PlayCanvasIntegration.tsx` | `getConfig` every 350 ms | `dimensionsByCabinet` recorded by I04 | B, D | Pending downstream migration |
| `utils/functions/playcanvas/sidePanels.ts` | `SidePanel` with a side from the per-side status | Stays a dedicated helper, or an adapter command | I | Accepted as a helper for now |
| `utils/functions/playcanvas/setWidth.ts` | Lowercase `width` key | None: the function has no callers | — | Dead code |

`public/collections/urban-standard-height/runtime-bindings.json` contains the USH scene keys by design: it is the migration target, not residual code.

## Open items

- **Handoff to A07 — done.** A's loader reads `local.runtimeBindings`, turns validation issues into diagnostics with `severity`, `dataset`, `dataPath` and `message` (`collectionRuntimeContract.ts`) and exposes `catalog.runtimeBindings`; the temporary loader is gone.
- **Required attribute list.** B's `ui.json` now supplies the UI fields, and every one of them has a scene decision (tested). The C01 part is still one list for every collection, so a collection without a towel bar still has to declare `TowelBarOption` as unbound. `ui.json` has no `Handle` field and no dimensions: `Handle` is required through the profile, the dimensions through the C01 part.
- **Fixture bindings — covered.** `fixture-ui` and `fixture-rules` ship their own tables (A08). `fixtureProfilesThroughAdapter.test.ts` sends `TestGrooveFinish` through the real adapter as `HandleGrooveColor`, and runs a disallowed `Drawers=1` of `fixture-rules` through `changeAttribute` and the real adapter without a single scene command. Neither profile can be opened in the browser until A provides a test provider.
- **Basin per cabinet.** Mako/Class need "чаша конкретної SB" (developer-i README line 53). That needs a cabinet key on basin-scoped changes, which is a C model change, not a binding.
- **`CountertopStyle` is not read by the scene.** No scene script under `public/HastingCabinetsParametrization` contains the key; `sceneKeysInExport.test.ts` records it as the only bound key the scene code does not read. It is kept because the code sends it; the browser run in `i06-scene-acceptance.md` decides whether it can go.
- **Handle re-send after drawers.** Legacy code re-broadcast the handle after a drawers change "so PlayCanvas re-evaluates its internal height-forcing rules". The drawers command (C06) sends the handle only when it changes and the dependent height explicitly; the page still re-sends handle and height to a cabinet whose actual height, read through the scene reader, stayed stale. Whether the scene needs the unchanged handle is part of the browser check.
- **Restore preflight depends on loaded bindings.** Until A07 exposes `catalog.runtimeBindings`, a collection whose table failed to load cannot undo (`bindings-unavailable`) rather than rebuilding blindly. History snapshots also carry no configuration values, so a value dropped when a cabinet was removed does not come back with undo; that belongs to C09.
- **Scene events.** The reader runs after app actions because the scene has none. A scene event for resize and reorder (in `hasting-modular-playcanvas-flow-git`) would replace the 200 ms wait; I05 can use the same reader to confirm a restored composition.
- **Top dividers around drawers.** Clearing `TopDrawerDividers` for cabinets leaving two drawers has no binding and no port operation, so `CabinetBuilderPage` sends it just before the drawers command, where it used to share the drawers patch.
- **`order` values** are derived from the legacy call sequences and need confirming in the real scene.
- **`syntesi.finishTransforms[].runtimeValue` in the profile** duplicates the bindings. The profile's own `excludedFromThisProfile` assigns runtime bindings to I; the field can be dropped.

## Scope and completion

Developer I owns the runtime bindings shape and the USH table, the runtimePort contract, the adapter and its stand-in, and the scene bridge. Developer I does not load collection sources (A), migrate page rendering (B), decide which changes are allowed or record state (C), or build SKU and prices (D).

I01, I02 and I03 are complete against their acceptance criteria, with the A07 handoff note above outstanding. I04 is complete in code and unit tests (two cabinets of different sizes, swap, not-ready, a burst of events); its browser check is part of I06. I05 is complete in code and unit tests for the scene restorer and its first consumer, undo/redo; the saved-configuration restore moves onto it with C09; I06 is in progress: the automated part is complete (delegation and errors, command order, restore order, two cabinets, both test profiles through the real adapter, every bound scene key checked against the scene code), and the browser run with its scene-key table is recorded in `i06-scene-acceptance.md`; I07 covers Mako/Class resources.

Parity is proven against the legacy call sequences and the scene source, through a recorded scene. Browser verification of the B → C → I path remains, and is evaluated jointly in C12 and I06.
