# ProductProfile migration status v1

This document is the Developer C handoff for the product-data boundary introduced in September 2026. It records what moved out of code into collection data, the behaviour that changed on the way, and the production consumers that still know Urban Standard Height product values directly. The boundary is ready; the remaining consumer migrations belong to Developers A, B, D, and I.

Covers C01 (configuration state model), C02 (ProductProfile and the P0 slice), C05 (preview, confirm and cancel), C07 (save format), and C08 (shared save assembly).

Verified locally: `npm test` — 404 tests in 40 files, up from 256 in 20. `npm run build` succeeds. `npm run lint` reports the same 108 problems as before the change, with no new errors or warnings. Browser behaviour was not verified.

## Public contract

### Product data of a collection

The profile is a manifest source like any other, declared as `local.productProfile` and served from `public/collections/<id>/product-profile.json`:

```ts
type ProductProfile = {
  schemaVersion: number;
  collectionId: string;
  sourceRefs: ProfileSourceRefs;
  defaults: Record<string, string>;
  attributes: ProfileAttribute[];   // option catalogs, capabilities, initial/fallback values
  ruleData: ProfileRuleData;        // legacy 439 column mapping
  messages: ProfileMessages;        // stable reason codes with a legacy English fallback
};
```

`parseProductProfile(input)` validates it and returns either the profile or diagnostics carrying `code`, `dataPath` and `message`. It is used instead of a schema inside the collection loader on purpose: the profile contract belongs to C, and a second validator over the same file would drift.

Consumers read the active profile through one selector:

```ts
getActiveProductProfile(state): ProductProfile | null
```

Reading an option catalog, a capability or an alias goes through the pure selectors exported from `@/entities/collection` — `selectOptions`, `hasCapability`, `normalizeOptionValue`, `selectEffectiveFallback`, `selectMessage`. A collection that does not declare an attribute yields an empty catalog rather than inheriting the USH one.

### Configuration state

Values are addressed rather than named:

```ts
type ValueTarget =
  | { scope: "global" | "countertop" | "basin" }
  | { scope: "cabinet"; cabinetId: StableCabinetKey }
  | { scope: "drawer"; cabinetId: StableCabinetKey; drawerType: DrawerType };
```

Products carry a stable key that survives insert, swap and removal; the scene still owns the runtime id and the actual composition order, and `reconcileOrder` records what it reports. The actual size of each product is recorded by stable key in `dimensionsByCabinet` from what the scene reports (I04, see the runtime bindings document); it is not part of the snapshot. `ATTRIBUTE_OWNERSHIP` declares, for each of 28 values, its scope, its single writer, and whether it survives Save.

`getConfigurationSnapshot(state)` is the one serialized form shared by Save/Share, history and the price consumer.

`CollectionStateBridge` copies the ready collection into the store. It exists because rule evaluation runs inside product reducers, where hooks are unavailable; it writes nothing while the collection is resolving or failed, and never replaces an existing catalog with an empty one.

### Changing a value

```ts
type AttributeChange = { attributeId: string; value: AttributeValue } & (
  | { scope: "global" | "countertop" | "basin" }
  | { scope: "cabinet"; cabinetId: string }
  | { scope: "drawer"; cabinetId: string; drawerType: DrawerType }
);

changeAttribute(change, deps): Promise<ChangeResult>;
```

`ChangeResult` is `applied | confirmation-required | blocked | partial | error`. A change whose profile attribute declares `confirmation` (USH: `Handle` while cabinets are placed) returns `confirmation-required` with a `ChangePreview` — the set and its reasons — and writes and sends nothing. `confirmAttributeChange(preview, deps)` checks the change again against the current state: the same set is applied, a changed set comes back as a new preview with `replaced: true`, a change that became disallowed is `blocked`. Cancel needs no call. `partial` exists because the runtime API is not atomic: a set the scene applied halfway is reported with `needsSync: true` and never recorded as a successful configuration.

Pages call it through `useChangeAttribute()`, which returns `{ change, confirm }` with the store, the PlayCanvas adapter and the flow (from the route) already wired. The handle is the first attribute moved onto it (C06): the style sidebar, the in-scene handle dropdown and the Side-Shelf prompt in `CabinetBuilderPage`. A handle and a height recorded by the service go through `commitRuleSelection`, which refreshes availability once but does not derive the forced height or reset the groove again, so the service is their only owner. A handle the reducers change on their own reaches the scene through one listener in `app/store/optionsListener.ts`, which replaces the duplicate effects in the sidebar and the player. Another listener keeps the C01 cabinet entries in step with `product.productIds`.

Drawers follow (C06): a drawers change reaches every drawer cabinet at once, because styles of different groups cannot be mixed, and its set carries the handle the new drawers require, that handle's height and the groove reset. The rules are judged for the addressed cabinet's type with `selectedProductIds: []`, as the page did. `applyPlan` records handle, height and drawers in one `commitRuleSelection` after the per-cabinet `setPlacedCabinetStyle`, so availability is refreshed once. The drawer-mixing prompt in `CabinetBuilderPage` now confirms this command. `DrawerPanelFluting`, `GrainDirection`, `TowelBarOption`, `TowelBarColor` and `Thickness` are written into the product slice by their own committers; fluting and grain are refused while their rule says they are unavailable (clearing is always allowed), and removing the towel bar clears its colour in the same set. The colours are declared in the profile with `optionsSource`, so the service accepts them; their committers (SKU, material, finish) are not written yet.

The service talks to the scene through the port I owns (`entities/configuration/model/runtimePort.ts`, I02). `createTestRuntimePort()` from `@/features/playCanvasAdapter` records the agreed set and can answer with each of the port's five statuses, so the call order and C's handling of every outcome are proven without a scene.

**Scope mismatch to resolve:** CONTRACTS §3 enumerates `global | countertop | cabinet`, while the profile and the configuration model both address five scopes — `sinkType` is `basin`, `DividersStyle` is `drawer`. The wider set is implemented here; the contract needs the same widening before B writes its UI description against three.

### Save format

The versioned fragment sits next to the existing `uiState` rather than replacing it, because three restore paths still read the flat shape and old saved links contain nothing else:

```ts
type ConfigurationFragment = {
  version: number;
  collectionId: string | null;
  cabinets: { stableKey: string; index: number }[];
  values: Record<string, Record<string, AttributeValue>>;   // "cabinet:cab-1" -> { Handle: "..." }
};
```

`readConfigurationFragment(metadata)` reads it back, reconstructing a fragment from `uiState` for payloads written before C07 and reporting issues instead of throwing. A newer `version` is read as far as this build understands it. `readSavedCollectionId(metadata)` feeds `resolveCollection`: a missing field means legacy USH, a recorded but unknown id is that resolver's error and is never substituted with USH.

`useBuildConfigurationRequest()` and `useSaveCurrentConfiguration()` assemble the payload once for every save entry point.

### Restoring a saved configuration (C09)

`/restore?configId=…` puts the saved collection into the URL (`buildConfigurationRestoreSearch`), so `ActiveCollectionProvider` loads the collection the configuration belongs to; a payload without one opens the default collection. The page then calls `useRestoreSavedConfiguration({ configId, applyPage })`, which waits for the scene and the collection and runs `restoreSavedConfiguration`:

1. A configuration that is restoring or already came back is skipped. The status lives in `configuration.restore`, so a re-run effect, StrictMode or a remount does not restore twice.
2. The record is loaded, its collection (`readSavedCollectionId`, legacy → USH) must be the open one, and `buildRestorePlan` checks it: product configs present, every saved id has a config, at least one cabinet, a readable fragment. `Top_*` parts are kept apart. Any failure ends as `failed` with the scene untouched.
3. The scene restorer (I05) rebuilds the cabinets; `rejected` / `not-ready` also leave the scene untouched.
4. The page's `applyPage(plan, matches)` records the products and re-applies its add-ons and `uiState` options. Prebuilt and custom keep separate steps; prebuilt sends the preset scene defaults a saved config lacks, which `addPreset` used to merge.
5. `applyRestoredIdentity` gives the products their saved stable keys and restores per-cabinet values (`restoreConfigurationFragment`); a legacy payload keeps the keys the cabinet sync hands out.
6. The history starts over with the restored configuration as its only entry.

The saved collection is read with `readSavedCollectionIdentity`: no field anywhere is legacy USH, a field that is present but `null` or empty fails the restore (CONTRACTS §4), and Save refuses to write a configuration while no collection is active (`no-collection`). A collection that fails to load marks the restore `failed` instead of leaving it waiting. Every failure carries a reason (`not-found`, `collection`, `invalid`, `scene`, `partial`) that `RestoreFailurePopup` (mounted in `HomePage`) shows once in the existing attention popup. After a custom restore the page moves to the saved path. `ActiveCollectionProvider` reloads the collection only when the URL selects a different collection: a change of other query params (`accordion`, `configId`) or dropping `collectionId` that resolves to the collection already loaded keeps it, so `CollectionStateBridge` does not reset the restored options on the next navigation.

| Status | Meaning | Save |
|---|---|---|
| `restoring` | Running | Refused |
| `restored` | Came back whole | Allowed |
| `partial` | The scene was rebuilt only partly, or the page step failed after the rebuild | Refused (`restore-incomplete`) until the composition changes |
| `failed` | Stopped before the scene was touched | Refused until the composition changes |

## What moved into data

| Was | Now |
|---|---|
| `HANDLE_OPTIONS` — three ids and labels in `handleRule.ts` | `profile.attributes[Handle].options` |
| `URBAN_HANDLES` in three separate files | `capabilities.supportsGrooveColor` on each option |
| `handle*ForcedHeightCm` — three named fields and three `if` branches | `ruleData.cabinetMatrixLegacyAdapter.columns.forcedHeightByHandle` |
| `handleUrbanBotcutRequiresDrawers` | `columns.requiresDrawersByHandle` |
| `HandleOption` closed union | `string` plus membership against the active catalog |
| `DEFAULT_HANDLE = "handle_urban_topcut"` | `profile.attributes[Handle].effectiveFallbackValue` |
| English reason strings inside the rule | stable reason codes resolved through `profile.messages` |
| `cabinetTypeMetadataByCode`, `drawerMetaByValue` | `profile.attributes[CabinetType\|Drawers].options` |
| USH starting values in `createInitialState()` | `profile.defaults`, applied by `setActiveProfile` |
| `MATRIX_CABINET_DATATABLE_ID = 439`, `COUNTERTOP_MATRIX_DATATABLE_ID = 438` | `catalog.cabinets`, `catalog.countertops` of the active collection |
| `applyConfiguratorRules(..., catalog = typeCabinetCatalog)` | both `catalog` and `profile` are required arguments |
| Drawers switch in `CabinetBuilderPage`: rules run twice, handle and height broadcast, then `switchAllCabinetsDrawerStyle` with `forcedHeight`/`forcedHandle` | `buildChangePlan` Drawers branch through `changeAttribute` |
| `CabinetColor`, `CountertopColor`, `VesselColor`, `TowelBarColor` known only from `profile.defaults` | Attributes with `optionsSource` (`configurator:Cabinet Color`, `Countertop Color`, `Vessels`, `Towel Bar Color`) |
| `isLacquerMatte` spellings, `FLUTING_VALUES`, `SIDE_PANEL` target in `flutingRule.ts` | `ruleData.fluting` + options of `DrawerPanelFluting` |
| `Essenze/HPL/3D`, `HPL_NO_GRAIN_FINISHES`, `THREE_D_NO_GRAIN_FINISHES` and their labels in `options/constants.ts` | `ruleData.grainDirection` + options of `GrainDirection` |
| Cabinet families, `SINGLE/DOUBLE_DRAWER_VALUES`, minimum of 2 adjacent cabinets in `shared/lib/bookMatching` | `ruleData.bookMatching` + aliases of `Drawers` |
| `dominantDrawerGroup === "double" && (value === "1" \|\| …)` in `CabinetBuilderPage` | `ruleData.drawerStyleGroups`, read by `isDrawerStyleMixingRestricted` |
| `SIDE_PANEL_AVAILABILITY`, `mapCabinetTypeToGroup` and two copies of `mapDrawersToHandleType`, `SIDE_PANEL_LENGTH_BLOCK_CM = 340`, `+ 2` cm, quantity `2` | `ruleData.sidePanels` (`availability`, `cabinetGroups`, `drawersByHandleType`, `exactBlockedCabinetLengthCm`, `countertopLengthIncrementCm`, `defaultQuantityUnlessHeightTypeLow`) |
| `SYNTESI_MATERIAL`, `SYNTESI_MATERIAL_SKU`, `SYNTESI_FINISH_CONFIGS`, `SYNTESI_MAX_CABINET_COUNT`, "Syntesi without side panels" | `ruleData.syntesi` |
| Depth `46`, restricted materials and basins in `sizeFilters.ts`; `lacqueredmt/lacqueredgl` filters in both countertop pages | `ruleData.countertopFallbacks` |
| Hidden vessel styles in `vesselCompatibility.ts`; `vesselAllowedMaterialsMap`, colour-code maps and `vesselDefaultFinishMap` in `shared/lib/sku/vesselSkuMaps.ts` | `ruleData.vesselCompatibility` (the SKU maps of D stay in `vesselSkuMaps.ts`) |
| Rule reason strings in fluting, grain, book matching, side panels, Syntesi, vessels | `profile.messages`, with `{name}` params where a value is part of the text |

Two duplicated implementations of the same handle auto-change — one in the product reducer, one in `CabinetBuilderPage` — now share `resolveHandleAfterRules.ts`.

## Behaviour changes that are not pure refactoring

They are recorded because CONTRACTS §4 forbids silently changing established behaviour.

1. **`heightLocked === 50` special case removed.** The old code explicitly preferred `handle_pto` when a height was locked and repeated that with a hardcoded `50`. The handle rule already disables every option whose forced height conflicts with the lock, so the replacement picks the first still-enabled option in catalog order. Against the real 439 payload that is the push-to-open option, which forces 50 for every drawer configuration, so the outcome is unchanged.

2. **"On PTO exit, re-apply forced height" generalised.** The condition was `prevHandle === "handle_pto" && nextHandle !== "handle_pto"`. It is now "the two handles force different heights", which is what made PTO special in the USH data.

3. **A handle change asks before it is applied.** The style sidebar applied the handle first, showed "The handle style has been updated", and reverted through the scene on Cancel. C05 requires that nothing changes before Confirm and that Cancel does not reach the scene, so the preview comes first and the message reads "will be updated". The user no longer sees the new handle in 3D before confirming. In effect since C06 in the style sidebar and, as a new dialog, in the in-scene handle dropdown, which applied without asking before. The Side-Shelf prompt in `CabinetBuilderPage` confirms at once, because that prompt is already the question. With no cabinet placed the handle is only the choice for the next cabinet, so it is still set locally without a dialog.

4. **A saved product keeps its own height and depth.** `normalizeProductConfigSnapshot` preferred the shared `selectedDimensions` over the product's own scene config, so every cabinet in the price, countertop and Summary input carried the last selected size. The product's config now comes first, then the dimension tool, and the shared selection only when the scene reports nothing.

5. **A drawers switch no longer re-sends an unchanged handle.** The page broadcast the handle after every drawers change "so PlayCanvas re-evaluates its height-forcing rules" and then the height. The command sends the handle only when the new drawers require a different one, and the forced height explicitly. The top dividers of cabinets leaving two drawers are cleared in a call of their own just before the drawers, where the page sent both in one patch. Both need the browser check (I06).

6. **Removing the towel bar clears its colour in the scene too.** The accessory pages cleared `TowelBarColor` in state only; through the command the empty colour is part of the set and reaches the scene, which treats `""` as no colour.

7. **A collection without a rule section does not get USH's rule.** Fluting, grain direction, book matching and side panels are not offered (`*.notInCollection` reason); drawer style groups, Syntesi, countertop fallbacks and vessel compatibility impose no restriction. USH declares every section, and the behaviour tests recorded before the migration pass unchanged on its profile.

8. **Nothing is cleared before the collection loads.** Every rule reads as unavailable while `activeProfile` is null, so the option listeners, the fluting/grain/book-matching effects in the cabinet pages, the side panel middleware, `enforceSidePanelEligibility` and `reapplySidePanelsForPreset` do nothing until it is loaded, instead of clearing chosen values or removing panels.

## Defects found and fixed

| Defect | Effect before |
|---|---|
| `Handle` absent from `ConfigurationUiState` | Survived Save only because it sits inside each product's PlayCanvas config. `CabinetColorMaterial` and `CabinetColorFinish` were lost outright and re-derived on restore. |
| Save de-duplication guard in both Summary pages | The hash included `savedAt`, regenerated on every build, so it never matched and the same configuration was saved again on every run of the effect. |
| `buildCabinetCatalogFromMatrix` called without a profile | The parser fell back to the hardcoded USH handle columns — correct for USH, silently wrong for any other collection. |
| `import { type AppDispatch }` in `rtkRemoteLoader.ts` | With `verbatimModuleSyntax` that form keeps a side-effect import, closing an `app/store -> collection -> rtkRemoteLoader -> app/store` cycle once the store began reading collection data. Nine test files failed with an unrelated listener error. |

## Consumer audit

All statuses are `Pending downstream migration` unless stated otherwise. These consumers still name USH product values directly; Developer C left them unchanged.

| Consumer | Current source | Target API | Owner | Status |
|---|---|---|---|---|
| `features/sidePanel/lib/sidePanelService.ts:46-48` | handle id → scene groove tokens (`UpperG`, `CenterG`, `NoG`) | Runtime bindings owned by I; excluded from the profile by design | I | Pending downstream migration |
| `shared/lib/sku/cabinetSkuMaps.ts:19-21` | handle id → SKU tokens (`UG`, `CG`, `PTO`) | `data.catalog.cabinetSkuMappings` | D | Pending downstream migration |
| `pages/prebuilt/summary/SummaryPage.tsx:226-228`, `pages/custom/summary/index.tsx:230-232` | handle display labels | Option labels from `catalog.productProfile` | B | Pending downstream migration |
| `features/sidebar/.../RightCabinetStyleSidebar.tsx:117-119` | `HANDLE_IMAGES_BY_VALUE` | Presentation only; an unknown id falls back to the generic image and nothing is gated on it | B | Accepted as presentation |
| `entities/product/ui/ProductModelsGrid/ProductModelsGrid.tsx` | `Handle: "handle_urban_topcut"` in ~130 preset entries | `data.catalog.presets` | A | Pending downstream migration |
| `pages/prebuilt/countertop`, `pages/custom/countertop`, `pages/custom/faucetHoles`, `pages/custom/summary` | `useGetCountertopDatatableQuery(438)` | `data.catalog.countertops` | B | Pending downstream migration |
| `entities/product/model/store/selectors.ts:123` | Literal `"Pulpis Chiaro TKH"` used to detect a changed configuration | `data.manifest.defaults` | C | Pending, DEV-09 |
| `entities/product/model/store/slice.ts` `activeProfile` field | Profile stored next to `cabinetCatalog` in the product slice | Moves to the command layer once rule evaluation leaves the reducers | C | Pending, C06 |

`public/collections/urban-standard-height/product-profile.json` contains the three USH handle ids by design: it is the migration target, not residual code.

## Open items

- **`static-options.json` duplicates the profile catalogs.** The same `cabinetTypes`, `drawerConfigurations` and `handles`, as flat strings without labels, order or capabilities. developer-a README line 130 requires "без другої незалежної копії списку ручок", developer-c README line 35 moves catalogs into the profile, and DEV-10 requires that Custom/Prebuilt/Summary hold no independent product catalogs. Nothing reads `catalog.staticOptions` yet, so removing it is cheap now. Joint A/B/C decision.
- **Three data discrepancies** against the real 438/439 fixtures: `Side-Cabinet` exists in code in ten places but not in the 439 payload; `drawerConfigurations` is spelled `1D|2D|1DWID` in static options while the table returns `1|2|1+inner`; thickness is 5 values in static options, 7 in code and 6 fractions in 438 (`3/8`, `1/2`, `2-3/8`, `4`, `5-1/8`, `5-1/2`). The third affects SKU and price.
- **`sourceRefs` in the profile duplicates `manifest.remote`.** CONTRACTS §4 makes the manifest authoritative for source ids; the profile field should be dropped.
- **Rule evaluation still runs inside twelve product reducers.** `CollectionStateBridge` exists to copy the collection into the store because hooks are unavailable there. Only the handle and its height have one owner so far; moving evaluation for the remaining attributes into the command layer is the rest of C06 and removes both the bridge and the transitional `activeProfile` field.
- **C06 beyond handle and drawers.** Width and depth are not planned by the command service yet; the actual size of each cabinet is now recorded from the scene (I04). Fluting, grain, towel bar, thickness and the colours are ready in the command service but their fields still write state and call the scene directly; wiring them is B06. The colours need committers for SKU, material and finish first. The runtime bindings reach the app through a temporary loader until A07 (see the runtime bindings document).
- **Legacy steps around the drawers command.** Clearing the top dividers (`TODO(I)`, no runtimePort operation) and re-sending the height to a cabinet whose actual height, read through I04, stayed stale stay direct scene calls in `handleMixingConfirm`.
- **Confirmations still on the legacy path.** Depth and the Side-Shelf removal are not moved to C05: dimensions are not planned by the command service yet, and removing products has no runtimePort operation. The mixing restriction now comes from `drawerStyleGroups`; its prompt is still the page's own.
- **Material aliases still in code.** `MATERIAL_ALIASES` in `countertop/parse.ts` (also mirrored as `ruleData.materialNormalization.aliases`) derives the basin name markers used by `normalizeBasinKey` and `scopeCountertopRulesByBasinStyle`, which almost every countertop rule and both countertop pages, the price hook and the summaries call. Moving it means passing the aliases through that whole module; it was left out of this migration and needs its own task.
- **Countertop fallbacks not confirmed against 438.** The 438 fixture (27 rows) repeats the restriction for Tekorund and the Orion basin (integrated depth 50.5 only) but has no rows for Tekormud, SSTM, Solid Surface, SST1C/SST1D or the Oly55/Oly56 basins. The facts were moved into `ruleData.countertopFallbacks` with `needsConfirmation: true` instead of being deleted; A and D decide once the full table is compared.
- **Rules that stay code.** `getDominantDrawerGroup` still picks the style images from the legacy `single/double` values (presentation, B). `HANDLE_GROOVE_PRIORITY` in `sidePanelService.ts` maps handle ids to preferred grooves (runtime, I). The cabinet groups `SBSC/OS/OSS`, the `Vessel_` prefix and the divider validation gate order are code concepts; only their members moved into data.
- **New rule kinds of Mako/Class are not covered.** `maxCabinetWidthSum`, `maxCabinetTypeCount`, `integratedMaterialBasinAndOwningSinkBase` and the other kinds in `collection-inputs/mako.json`/`class.json` have no evaluator yet; `drawerStyleGroups` matches their `compositionStyleGroups`.
- **`syntesi.finishTransforms[].runtimeValue`** is also expressed by the `CountertopColor` overrides in `runtime-bindings.json`; one of the two should go.

## Scope and completion

Developer C owns the ProductProfile contract and its pure transformations, the configuration state model and value ownership, the single change path, and the Save format with its legacy reader. Developer C does not migrate page rendering or navigation (B), collection source binding and loading (A), SKU and pricing (D), or PlayCanvas bindings and scene execution (I).

C01, C02, C05, C07 and C08 are complete against their acceptance criteria. C06 is in progress: the handle and the drawers run through the command service in the app, with one owner in state and one send to the scene; fluting, grain, towel bar, thickness and the colours are accepted and recorded by the service; the remaining fields depend on B06/B08/B09 and the dimensions on I04; C09 is complete in code and unit tests: both saved-configuration restores run through one orchestrator over the I05 scene restorer; `uiState` options are still applied by each page until their fields move to the command service, and the browser check is part of C12. C12 and C13 depend on all of the above.

The P1 rules of the hardcode audit — fluting, grain direction, book matching, drawer mixing, side panels, Syntesi, countertop fallbacks and vessel compatibility — read their parameters from `ruleData` of the active profile. Material aliases are the remaining P1 item in code (see Open items); there is no task for it in the plan yet.

Parity is proven against the real DataTable 439 payload from the Developer A fixtures. Browser verification of the full B → C → I path remains, and is evaluated jointly in C12 and I06.
