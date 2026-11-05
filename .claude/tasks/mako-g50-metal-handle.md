# Mako G50 handle comes in Metal only

**Stage:** Review, waiting for the user (uncommitted on `phase2/ui-fixes` at 0152f0a1, moved there at the user's request)

## Goal
A Mako composition never holds G50 with a lacquered handle colour through placement or a handle change, and the Handle Color field offers G50 only Metal, its Material filter included. G57, Lame and every other collection behave as before.

## Sources
- Vivid: none recorded · PRD: none
- Collections: mako
- Product data: WebGL Logic notes (Mako > Handle Styles and its handle image), Dev Feedback "Select Color Step > Handle Color", configurator 9 "Select Handle Color", R-MAKO-CAB-006, R-MAKO-CAB-007, K-CTML-006
- Figma: none (the client's annotated screenshot)

## Out of scope
- Healing saved configurations: restore, undo and replay are not re-derived.
- A command gate for HandleColor, a new reason code, the Handle popup copy.
- Changes to the sidebar, the player menu or the pages.
- Compositions with different handles; none is reachable from the UI or the presets.
- G50 length by width (R-MAKO-CAB-008); LegColor following the handle colour.

## Decisions
- The rule lists colours, not materials: placement has no configurator, and `sku-profile.json` already names Gold and Silver. A test ties the list to the Metal variants of configurator 9.
- The first colour of a handle's list is the one it starts in.
- Lacquered colours are hidden, not disabled (`visibleValues`): the client struck Lacquered MT out of the filter, and `allowedValues` would keep it there.
- The dependent colour is in `buildChangePlan`, not `useFieldAutoSelect`, which is outside history and runs only while the step is open.
- No reason code on the dependent colour: the Handle popups render `reasons[0]` only.
- G50 starts in Silver, the only G50 colour with a recorded price: the user approved the plan without naming another. Provisional against the client's answer to K-CTML-006; the list order in the profile is the only thing that changes.
- A colour field's filters belong to its option set: the fields step remounts `ColorField` when the option values change, which covers Material, Color, Price and full mode without a state reset or a filter-by-filter check. Only `HandleColor.allowed` changes that set today. A filter that would still match is dropped too.
- A placed config's own colour still wins, unless its handle does not come in it: then it gives way to the composition's or the starting value. A wider "composition always wins" would rewrite a teammate's pins (`compositionCommands.test.ts:1055`, `:1063`) and change G57 and Lame, against the Goal.
- A stale colour the handle DOES come in still wins at command level (`compositionCommands.test.ts:1056`), but no UI path to it was found: in Chrome, click a cabinet, pick another metal, then "+" placed the current colour, with and without Undo/Redo.
- Commits wait for the user's request (their local rule); this departs from CLAUDE.md's commit-per-chunk.
- The work stays on the user's `phase2/ui-fixes`, not a branch of its own; this departs from CLAUDE.md's Branch stage. That branch carries scene v102 and lacks v103-v105 and the Urban Modo fixes of staging.

## Reuse
- Reuse as is: `selectRuleData`, `RULE_SECTION_FIELDS`, `parseRuleSection`, `isStringArrayRecord` (`entities/collection`); `FieldAvailability.visibleValues` (`resolveSectionState.ts`); `recordedTargets`, `isBroadcastCabinetValue` (`commitChange.ts`); `recordInherited` (`composition.ts`); `resolveConfirmation`; runtime `order` Handle 20, HandleColor 50; `getCompositionValues`.
- Lift first: none.

## Trace
- Selection: Handle (sidebar or player menu) → `evaluateChange` → `buildChangePlan` (new HandleColor dependency) → `applyPlan` → bindings `HandleStyle` order 20, `HandleColor` order 50 → scene; `commitPlan` records the colour on every cabinet. No cabinet yet: `selectedProductConfig.Handle` → `addCabinet` → `cabinetToPlace` → `selectBroadcastValues` (starting colour by handle) → scene and `recordInherited`.
- Pricing: `sku-profile.json` `HDL-{LACM|MTL}-{code}` reads the recorded colour; no pricing code changes.

## Plan
- [x] Step 0: the work lives on `phase2/ui-fixes` (first cut on `fix/mako-g50-metal-handle`, moved at the user's request; that branch is empty and still exists locally).
- [x] Step 1: rule, data, field. Tests first, red for the right reason.
  - `ruleData.handleColors.allowedByHandle` in the Mako profile; drop `excludedFromThisProfile.handleColorByStyle`; `availabilityRef: "HandleColor.allowed"` on `handle-color` in `ui.json`.
  - `HandleColorsRuleData` in `productProfile.ts`; `RULE_SECTION_FIELDS` and `parseRuleSections` in `parseProductProfile.ts`.
  - New `configurator-rule-core/cabinetBuilder/lib/handleColorRule.ts`: `selectHandleColors`, `resolveHandleColor`.
  - `"HandleColor.allowed"` in `useFieldAvailabilityResults`.
  - `FieldsStepPage`: a `key` from the option values resets the filters of a `ColorField` when its options change.
  - Tests: `makoProfile.test.ts`, `FieldsStepPage.colors.test.tsx`, `handleColorRule.test.ts`.
- [x] Step 2: plan and placement. Tests first, red for the right reason.
  - `buildChangePlan`: dependent HandleColor beside `resolveGrooveReset`, from `nextHandle`; `evaluateChange` passes the held colour.
  - `selectBroadcastValues(state, handle)`: the starting value by handle; `cabinetToPlace` passes `product.config.Handle`.
  - Tests: `buildChangePlan.test.ts`, `confirmation.test.ts`, `CabinetBuilderPage.makoPlacedCabinet.test.tsx:155-162`.
- [x] Step 2b: a stale colour the placed cabinet's handle does not come in gives way to the composition's. Reproduced in Chrome: G50 + Silver held, third cabinet placed with `HandleColor: Nebbia 402 Lacquered MT`, SKU `...G50...HDL-LACM-402`.
- [x] Step 3: acceptance: `npm run tsc`, affected tests, `npx eslint`, `npm run build`, browser flows on `?collectionId=mako` plus a Lame smoke, no Save.
- [ ] Step 4: Review, Docs sync (`docs/products/mako.md`, `docs/mako-profile.md`, R-MAKO-CAB-007, K-CTML-006, HO-004, TC-MAKO-CAB-007), PR on the user's request.
