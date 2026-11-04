# A picked vessel gets its colour in every collection

**Stage:** PR (waiting for the user's go-ahead to commit)

## Goal
Picking a vessel basin through a command sets `VesselColor` in the same plan, for all 8 collections, from data: the current colour if compatible, else the vessel's `defaultFinishByStyle`, else the first compatible. A forbidden colour never stays selected, and the scene, the pressed swatch and the SKU agree after a model change.

## Sources
- Vivid: none · PRD: none
- Collections: urban-standard-height, urban-low-height, class, mako, urban-freestanding, urban-duplex, lame, tricot
- Product data: RenderAdmin configurator 4 (live, public GET) for USH; `defaultFinishByStyle` in each `product-profile.json`
- Client rules: R-USH-BAS-007 (colour reaches every Sink Base), R-TRICOT-BAS-004 + open conflict K-CTML-013, R-MAKO-BAS-005, R-CLASS-BAS-003, R-TRICOT-BAS-003
- Figma: none (no new UI)

## Out of scope
- Reverting c76d5554.
- K-CTML-013 data (Tricot Latte 417 MT vs 415/401/400): stays on `defaultFinishByStyle` until the client answers.
- Healing saved configurations; restore, undo and replay are not re-derived.
- The 48 extra Countertop Color options USH offers for vessels (only judged, not moved).
- DnD placement `PlayCanvasIntegration.tsx:628`, which passes no vessel colour.
- PlayCanvas scene fallback, `ui.json` changes, `useFieldAutoSelect` (keeps healing restore and preset states).
- Dead `useBasinState.applyIntegratedBasin`.

## Decisions
- User confirmed the norm on 2026-11-03: a picked vessel takes the default available colour in every collection, USH included. No client rule for USH; Tricot's rule points the same way.
- The dependency lives in `buildChangePlan`, not in `useAvailabilityResets` (would rewrite restored configurations on load) or `useFieldAutoSelect` (outside history, only while the step is open).
- No colour dependency without a placed Sink Base (`basin.sinkBaseIds` empty): this is what leaves a hosted sink alone.
- No scene-refusal guard on the dependency colour: `VesselColor` is `identity` in all 8 bindings, so it would never fire (the plan assumed Tricot's strict catalog could refuse it; it does not).
- A dependency colour is not explicit (`applyPlan` revokes it), so a model change carries `VesselColor` whenever the vessel itself is carried (`overrides.sinkType` is a vessel basin).
- A carried colour reaches the new scene whatever the basin: flat through `shared`, compact through a replay. The scene paints nothing with it until a vessel is there (`_sinkColor`), and the next vessel pick re-judges it.
- A colour that is not carried is blanked on a model change, so the state never claims a colour the new scene does not hold.
- Known limits, left as they are: per-Sink-Base colours from configurations saved by the old widget are not re-judged; a model whose preset itself holds a different vessel is unreachable (no preset has one); an allowed list that is empty on a loaded configurator leaves the colour alone (no vessel in the data has one).
- Commits wait for the user's request (their local rule and the execute-plan skill); this departs from CLAUDE.md's commit-per-chunk.
- `buildChangePlan` imports the resolver by deep path and the resolver imports `countertop/vesselCompatibility` directly, not the barrels, which reach the command layer.
- A colour the vessel section lists and refuses is replaced even if another section lists it under an accepted material; a colour outside the section is kept if any of its listings is accepted.
- USH test groups reuse the `configurator4WithLiveVessels` helper, compared with live configurator 4 on 2026-11-03.

## Reuse
Skipped the search-manager reuse query: the earlier research in this session already read these; the Review-stage reuse sweep still runs.
- Reuse as is: `isVesselBasin` (`entities/collection`); `isMaterialCompatibleWithVesselStyle`, `isPreferredVesselFinish` (`configurator-rule-core/countertop`); `resolveConfiguratorOptions`, `buildConfiguratorOptions` (`collectionCustomization/lib`); `resolveBasinTargets` (`buildChangePlan.ts`); `resolveRuntimeBinding`, `toSceneValue`.
- Lift first: allowed + preferred from `useCustomizationSectionState.ts:240-253` → new `collectionCustomization/lib/resolveVesselColor.ts`, used by that file and by `buildChangePlan`.

## Trace
- Selection: `sinkType` field → `useChangeAttribute.change` → `evaluateChange` → `buildChangePlan` (new `VesselColor` entries, origin `dependency`) → `applyPlan` → runtime bindings `sinkType` order 40, `VesselColor` order 60 → scene; `commitPlan` writes the store.
- Pricing: colour reaches `buildVesselSku`/`ushVesselLines` through the store; no pricing code changes. A vessel with a fixed material keeps priority there (`CER-T1C` stays possible only through a stale colour, which this removes).

## Plan
- [x] Step 0: baseline at 2d4953bc on Node 20.19.2: 31 affected test files, 466 tests, 2 failures (`CountertopSections.test.tsx` "sends a picked thickness through the command", `countertopFieldAvailability.test.tsx` "Tricot vessel choice follows the Class one offers both countertop styles"). Firefox: ULH 36" 1-Drawer + Urban Modo → T1C pressed, white vessel, $6,669; after 36" 1-Drawer → 36" 1-Drawer 1 the vessel takes the countertop colour, T1C stays pressed, price stays: the carry bug is not USH-only.
- [x] Step 1: `collectionCustomization/lib/resolveVesselColor.ts`, `useCustomizationSectionState` calls it, `resolveVesselColor.test.ts` pins the pick table for 8 collections, USH groups built inline in the test (`configurator-4.json` is a reduced recording and recorded fixtures are not edited by hand).
  - `resolveVesselColorOptions(profile, configurator, vesselStyle)` → `{ allowed, preferredValue }`: the body of `useCustomizationSectionState.ts:240-253` moved as is.
  - `resolveVesselColorForBasin({ profile, configurator, vesselStyle, current })` → `string | null`, null meaning leave the colour alone: null when `!isVesselBasin(profile, vesselStyle)` or `allowed` is empty; `current` when it is in `allowed`; `current` when it is outside the section but `configurator.groups.flatMap(buildConfiguratorOptions)` finds it and `isMaterialCompatibleWithVesselStyle` accepts it by that option's `traits.materials` (USH offers HPL and Porcelain from Countertop Color); else `preferredValue ?? allowed[0].value`.
  - Pick table to pin: USH, ULH: Blade 11/18 → Antracite Matte OCF, Urban Modo → Matte White T1C, Urban Morris → Bianco Gloss TAL, Aquarius → Agata BD MT. Urban Freestanding: the same, no Aquarius. Urban Duplex: the same except Aquarius → Bianco Gloss TAL. Class, Mako, Lame, Tricot: Iris → Salvia 415 MT, Frame → Fumo 401 MT, Plaza → Antracite 400 MT.
- [x] Step 2: `sinkType` branch in `buildChangePlan`, placed before `const selectionField`; plan tests in `buildChangePlan.test.ts`, integration in `sinkBaseTarget.test.ts` for USH, ULH, Mako.
  - Branch: `next = resolveVesselColorForBasin({ profile, configurator, vesselStyle: value, current: basin?.vesselColor })`; when `next !== null`, `next !== (basin?.vesselColor ?? "")` and `basin?.sinkBaseIds?.length`, push `{ attributeId: "VesselColor", target: t, value: next, origin: "dependency" }` for each `t` of `resolveBasinTargets(target, basin.sinkBaseIds)`; return `{ ok: true, plan }` either way. No new reason code.
  - Plan test cases: empty colour → preferred; compatible colour → no dependency; forbidden colour → replaced on every target; `noneValue` and integrated basin → no dependency; no Sink Base → none; null configurator → none; addressed `sinkBaseId` → that target only.
- [x] Step 3: USH widget.
  - `CountertopSections.tsx` `changeVesselColor`: drop `sinkBaseId` from the request, keep the `!sinkBaseCabinetId` guard. The colour then reaches every Sink Base (R-USH-BAS-007) and `recordAcceptedUserChoice` marks it explicit.
  - `changeBasin`: `const result = await changeFromUser(...)`; on `result.status === "applied"` with `VesselColor` in `result.plan`, `vesselState.setSelection({})`, or the new colour can sit behind the active filter.
  - `useVesselColorState.ts`: delete `resolveColorForSinkStyle`, `syncColorWithSinkStyle` (no callers) and what only they use (`useAppDispatch`, `dispatch`, `setVesselColor`, `setConfigBatch`, `isPreferredVesselFinish`, and `isCompatibleWithSinkStyle`'s second parameter if nothing else passes it).
  - `collectionConsumerBoundary.test.ts`: remove the two `useVesselColorState.ts` entries (`:82-86`, `:165-169`). Leave the other PENDING entries.
  - `CountertopSections.test.tsx:124`: the expectation gains `userInitiated: true`. New cases: a vessel colour request names no `sinkBaseId`; a basin pick whose plan set a colour clears the filter, one whose plan did not keeps it.
- [x] Step 4: `ModelPage.tsx` carry. A colour from the plan is not explicit, and today only an explicit one is carried; `shared` hands it to the placement config, not to the store (checked with a temporary test), and only `afterPlacement` records it on the new Sink Bases.
  - `resolveCountertopSceneOverrides`: carry `VesselColor` when it is explicit, or when the resulting `overrides.sinkType` is a vessel basin.
  - Flat path (`:872`): `afterPlacement` also sends `VesselColor`, only when `globalConfig.sinkType` is a vessel basin; `shared` hands the colour to the placement config in every case. Do not put it inside `countertopValuesAfterPlacement`: compact `top` (`:755`) and restore (`:1215`) share that helper and stay as they are.
  - Compact path: after `syncCountertopSelectionFromSceneConfig` (`:786-793`), `await replay({ send: { VesselColor }, record: true })` for any carried colour. `mergeCompactPresetOverrides` replaces only fields a row already records, so the import cannot carry it. A failed replay warns, marks the runtime out of sync as `settleValues` does, and does not abort the import.
  - Both paths: a colour not carried is blanked in the state (`clearVesselColorNotCarried`).
  - Tests in `ModelPage.countertopState.test.tsx` (flat) and `ModelPage.compactPricing.test.tsx` (compact).
- [x] Step 5: acceptance: `npm run tsc`, affected tests, `npx eslint`, `npm run build`, browser table on all 8 collections. Firefox local dev at 2d4953bc + the working tree: all 8 prebuilt; USH custom through Customize. UD Aquarius takes Agata BD on live data (the fixture gives TAL; it has no default finish, so the first compatible wins).
- [x] Step 6: Docs sync via `docs-manager`.
