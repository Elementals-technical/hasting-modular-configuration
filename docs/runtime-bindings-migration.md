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

`getBindings` returns the active collection's table. Until A07 loads it, nothing in the app provides it, and the port is exercised only by tests.

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
| One handle click sends the handle patch twice (`RightCabinetStyleSidebar.tsx:455` and the effect at `:634`) plus height through another effect | Repeated commands for one action | No, removed when the sidebar moves to `changeAttribute` (C06) |
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
| `restoreSnapshot.ts`, `ModelPage.tsx` presets, `CabinetBuilderPage.tsx` restore | Direct scene rebuild | Restore through the adapter | I (I05), C (C09) | Pending downstream migration |
| `applySetWidth` / `applySetDepth`, `syncCountertopConfig` in `PlayCanvasIntegration.tsx` | Divider clearing/restoring and countertop sync around resize | Adapter steps once the helpers leave the component | I (I04), C (C06) | Pending downstream migration |
| `utils/functions/playcanvas/sidePanels.ts` | `SidePanel` with a side from the per-side status | Stays a dedicated helper, or an adapter command | I | Accepted as a helper for now |
| `utils/functions/playcanvas/setWidth.ts` | Lowercase `width` key | None: the function has no callers | — | Dead code |

`public/collections/urban-standard-height/runtime-bindings.json` contains the USH scene keys by design: it is the migration target, not residual code.

## Open items

- **Handoff to A07.** `validateRuntimeBindings` issues carry `code`, `attributeId` and `value`, but CONTRACTS §5 asks for `severity`, `dataset/path` and `message` as well. The manifest schema is `.strict()`, so `local.runtimeBindings` must be added to it before the file can be referenced. Loading, validating and exposing `catalog.runtimeBindings` is A07.
- **Required attribute list.** B's `ui.json` now supplies the UI fields, and every one of them has a scene decision (tested). The C01 part is still one list for every collection, so a collection without a towel bar still has to declare `TowelBarOption` as unbound. `ui.json` has no `Handle` field and no dimensions: `Handle` is required through the profile, the dimensions through the C01 part.
- **Fixture bindings.** `fixture-ui` (`TestGrooveFinish -> HandleGrooveColor`, all cabinets) and `fixture-rules` need their own tables once A08 prepares the fixture profiles. The fixture-ui binding is covered by an inline test.
- **Basin per cabinet.** Mako/Class need "чаша конкретної SB" (developer-i README line 53). That needs a cabinet key on basin-scoped changes, which is a C model change, not a binding.
- **`CountertopStyle` is not read by the scene.** No file under `public/HastingCabinetsParametrization` contains the key. It is kept because the code sends it; it may be removable.
- **Handle re-send after drawers.** Legacy code re-broadcasts the handle after a drawers change "so PlayCanvas re-evaluates its internal height-forcing rules". C sends the dependent height explicitly, so this may be unnecessary; it is one data field if the browser check shows otherwise.
- **`order` values** are derived from the legacy call sequences and need confirming in the real scene.
- **`syntesi.finishTransforms[].runtimeValue` in the profile** duplicates the bindings. The profile's own `excludedFromThisProfile` assigns runtime bindings to I; the field can be dropped.

## Scope and completion

Developer I owns the runtime bindings shape and the USH table, the runtimePort contract, the adapter and its stand-in, and the scene bridge. Developer I does not load collection sources (A), migrate page rendering (B), decide which changes are allowed or record state (C), or build SKU and prices (D).

I01, I02 and I03 are complete against their acceptance criteria, with the A07 handoff note above outstanding. I04 (actual values and scene events) and I05 (restore) come next; I06 verifies the adapter against the real scene in the browser; I07 covers Mako/Class resources.

Parity is proven against the legacy call sequences and the scene source, through a recorded scene. Browser verification of the B → C → I path remains, and is evaluated jointly in C12 and I06.
