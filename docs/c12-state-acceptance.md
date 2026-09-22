# C12 state acceptance v2

Acceptance of the configuration state, the single change path and Save/restore (C01, C02, C05–C09).

USH is checked in the browser; the two test profiles are checked by test, because the production
registry (`public/collections/registry.json`) lists only USH and the registry URL is a constant the
provider resolves at startup — a test provider for the browser belongs to A. The scene side of the
same scenarios is I06; this document covers what the state records and what Save carries.

## Automated evidence

Current code evidence: `changeDimension.test.ts` proves Width's stable-key target,
Depth's composition target and pre-runtime rejection of invalid intents. `sceneStateSync.test.ts`
proves an explicit command-triggered I04 read, so the sync no longer depends on a page reducer.

| Criterion | Test |
|---|---|
| One writer per value; a field added to the product slice without an owner fails | `entities/configuration/model/__tests__/ownership.test.ts` |
| Stable identity and order survive reorder, removal and restore | `.../__tests__/identity.test.ts`, `.../sceneState.test.ts` |
| Snapshot and target addressing (global, countertop, basin, cabinet, drawer) | `.../__tests__/snapshot.test.ts`, `.../target.test.ts` |
| One change path: validation against the profile, the agreed set, what the scene answered | `features/configurationCommands/__tests__/changeAttribute.test.ts`, `validateChange.test.ts`, `buildChangePlan.test.ts` |
| Preview, confirm and cancel; a stale plan is re-checked | `.../__tests__/confirmation.test.ts`, `useChangeAttribute.test.tsx` |
| Cabinet colour brings its material, finish and the following groove | `.../__tests__/changeAttributeColors.test.ts`, `resolveColorTraits.test.ts` |
| Availability resets and composition listeners have one owner | `.../__tests__/compositionListeners.test.ts`, `sceneStateSync.test.ts` |
| Save format: targets, versions, values with no typed field | `features/saveConfiguration/__tests__/configurationFragment.test.ts` |
| Reading a payload saved before the fragment, and a damaged one | `.../__tests__/legacyMetadata.test.ts` |
| Scene composition collected once for every entry point | `.../__tests__/collectSceneConfiguration.test.ts` |
| **Five save entry points build one order, and the dropped fields are in it** | `.../__tests__/saveEntryPoints.test.tsx` |
| **Save → read → restore returns every value to its product and drawer; legacy payload restores as USH** | `features/configurationRestore/__tests__/saveRestoreRoundtrip.test.ts` |
| Restore orchestration: not found, rejected composition, partial, no second restore | `.../__tests__/restoreSavedConfiguration.test.ts`, `useRestoreSavedConfiguration.test.tsx`, `buildRestorePlan.test.ts` |
| Test profiles load their own data, with no USH fallback and no production request | `entities/collection/__tests__/fixtureUi.test.ts`, `fixtureRules.test.ts`, `fixtureUiStateIntegration.test.tsx` |
| **A test profile: a forbidden value is refused, an allowed one is recorded, Save carries its collection** | `entities/collection/__tests__/fixtureProfileStateAndSave.test.ts` |
| Test profiles through the real scene adapter | `features/playCanvasAdapter/__tests__/fixtureProfilesThroughAdapter.test.ts` (I06) |
| A saved link restores once under StrictMode, after a page remount and when the scene is ready later | `features/configurationRestore/__tests__/useRestoreSavedConfiguration.test.tsx` |
| A change the product has not decided is blocked as undetermined and changes nothing (CONTRACTS §8) | `features/configurationCommands/__tests__/undeterminedGate.test.ts` |
| Reasons carry a code; USH texts equal the former English strings | `entities/collection/__tests__/legacyReasonTextParity.test.ts`, `reasonCodesHaveMessages.test.ts` |
| Countertop and accessories steps list their options from the profile | `features/collectionCustomization/__tests__/pageOptionCatalogs.test.ts` |

## Browser run (USH)

Status: **not run in this checkout**. The workspace has no connected live PlayCanvas
iframe or Save backend. This table is the required evidence protocol; record the commit,
runner and copied `window.__configuratorApiLogs` before marking any row passed.

Run on USH, custom and prebuilt. Fill in Result; a failure is recorded as it happened, not fixed in place.

| # | Step | Expected | Result |
|---|---|---|---|
| 1 | Cabinet builder: place three cabinets, change the handle on the middle one | Only that cabinet changes; the other two keep their handle and size | |
| 2 | Drawers 1 → 2 where the profile asks to confirm | Nothing changes until Confirm; Cancel leaves the scene and the state as they were | |
| 3 | Drawers 2 → 1 back, then change the height | The height the handle forces is recorded; the state matches the scene | |
| 4 | Colour step: pick a cabinet colour | The groove colour follows it; material and finish are recorded without a second pick | |
| 5 | Choose a fluting and a grain, then a colour that forbids them | Both are cleared, in the state and in the scene | |
| 5a | Countertop step: pick a vessel, then a vessel colour, then switch the style back to integrated | The vessel colour is cleared; the basin, colour and style are recorded and come back after Save/open | |
| 5b | Accessories: set the towel bar to None; place a divider, then set dividers to None | The towel bar disappears; the dividers are cleared; the option is recorded | |
| 6 | Save from each of the five points: Player, the buttons under the scene, custom Summary, prebuilt Summary, the quote link in the bottom bar | Each produces the same configuration; opening any link gives back the same composition and options | |
| 7 | Open a link saved before the migration | It opens as USH; the options come back; nothing is reset to defaults | |
| 8 | Open a link whose payload is damaged (change the id in the URL) | The scene is left alone and the failure is shown | |
| 9 | Interrupt a restore so it ends partial | Save refuses while the restore is incomplete | |
| 10 | F5 on a saved link | The configuration is restored once; no duplicated products | |
| 11 | `?collectionId=` with an unknown id | An error, not a silent USH | |

## Migrated fields and the rest

Owner today: **service** — the value goes through `changeAttribute`; **page** — the page still writes the
state and calls the scene itself (B06); **runtime** — the scene reports it and the state mirrors it.

| Attribute | Scope | Owner today | Saved in | Left to do |
|---|---|---|---|---|
| CabinetType | cabinet | runtime | product config | Encoded in the runtime product id; nothing to move |
| Drawers | cabinet | service | product config | — |
| Handle | cabinet | service | product config | Also in `uiState` since C07 |
| Height | cabinet | service | product config | Width and depth go through `changeDimension`; the sidebar size effect still sends Height with Depth itself |
| CabinetColor | global | service | uiState + product config | Pages still write the SKU (D) |
| CabinetColorMaterial, CabinetColorFinish | global | service | not saved | Recorded with the colour by the command, the preset colour included |
| HandleGrooveColor | cabinet | service | uiState + product config | — |
| DrawerPanelFluting | cabinet | service | uiState + product config | — |
| GrainDirection | cabinet | service | uiState + product config | — |
| BookMatching | global | service (state-only) | uiState | — |
| CountertopStyle | countertop | service | uiState + product config | The scene does not read the key (I06) |
| Thickness | countertop | service | uiState | — |
| CountertopColor | countertop | service | uiState + product config | Pages still write the SKU (D) |
| VesselColor | basin | service | uiState + product config | — |
| sinkType | basin | service, one page path | uiState + product config | An integrated basin sent only to the sink bases it fits by width stays on the page until the adapter addresses one sink base (I) |
| SidePanels, SidePanelLeft, SidePanelRight | global | service (side panel command) / runtime | uiState | Per-side statuses come from the scene |
| LedOption | global | service (state-only) | uiState | No field; restored from saved links |
| DividersOption | global | service (recorded) | uiState | The divider adapter clears the scene zones (I) |
| DividersStyle | drawer | page | uiState + product config | The picker's style has no drawer; placements are recorded per drawer |
| TowelBarOption, TowelBarColor | global | service | uiState | — |
| FaucetHolesAmount | countertop | service (state-only) | uiState | — |
| FaucetHolesSpacing | countertop | page | uiState | No profile attribute yet |

`ATTRIBUTE_OWNERSHIP` (`entities/configuration/model/ownership.ts`) is the machine-checked version of
this table; `ownership.test.ts` fails when a value is added without an owner.

## Not covered here

- **Test profiles in the browser.** `fixture-ui` and `fixture-rules` have no entry in the production
  registry, so they are covered by test only. A test provider is A's item.
- **The sidebar size effect** sends Height with Depth to every cabinet in one scene call (see `dev-residue-report.md`).
- **Two page paths** still write the scene themselves: the integrated basin per fitting sink base and dividers None (I).
- **The scene side** of these scenarios (order of commands, what the scene really applied) is I06; the
  browser run is done once for both.
