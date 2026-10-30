# Tricot Collection Integration

Status: agreed scope and implementation plan; external product and 3D inputs required before full acceptance.

## Problem Statement

Customers cannot configure the Tricot collection in the modular configurator. The application currently supports Urban Standard Height, Urban Low Height, Class, and Mako, but has no Tricot collection package.

The supplied Tricot master catalog identifies 42 models and their option catalogs. The supplied SKU workbook confirms cabinet construction, material/pattern compatibility, cabinet SKU grammar, and base prices. These sources must be translated into the configurator's existing collection contracts so customers can select a preset or build a custom composition, customize it, see accurate prices, and save and restore their work.

The master catalog does not define the ordered cabinet composition of each preset. There is currently no access to a Tricot 3D scene or its export. These missing inputs have an agreed owner: the user's 3D/product team supplies the scene, preset compositions, and related product data. The configurator integration must make that dependency explicit and provide a clear handoff contract.

## Solution

Add Tricot as a collection with application identity `tricot`, using the existing manifest loader, UI renderer, product rules, runtime adapter, and SKU/pricing pipeline. Support both `prebuilt` and `custom` flows with the same Tricot catalogs and compatibility rules.

Use the agreed five-page flow:

| Page | Prebuilt                                              | Custom                                                |
| ---- | ----------------------------------------------------- | ----------------------------------------------------- |
| 1    | Select a Tricot model                                 | Build a Tricot cabinet composition                    |
| 2    | Cabinet color → cabinet pattern → handle groove color | Cabinet color → cabinet pattern → handle groove color |
| 3    | Side panels                                           | Side panels                                           |
| 4    | Countertop color → thickness → basin style            | Countertop color → thickness → basin style            |
| 5    | Summary                                               | Summary                                               |

Preserve all 42 master models and their filters. Populate their working compositions from the 3D/product handoff. Extend shared modules where necessary to support material-dependent patterns, Tricot side panels, and external catalog aliases or allowlists. Keep collection data in the package rather than adding collection-specific branches to page components.

Preparation and automated integration checks may proceed before the scene is delivered. Full customer acceptance requires validated preset compositions, real scene behavior, and complete pricing for the supported selections.

## User Stories

1. As a customer, I want to open the Tricot configurator directly, so that I can configure the collection I selected.
2. As a customer, I want the interface to identify the active collection as Tricot, so that I know which product I am configuring.
3. As a customer, I want Tricot identity preserved throughout navigation, so that subsequent pages use the same collection.
4. As a customer, I want to choose a ready-made Tricot preset, so that I can start with a complete product composition.
5. As a customer, I want to see all 42 supplied Tricot models, so that I can compare the intended collection range.
6. As a customer, I want recognizable model names and images, so that I can identify the composition I want.
7. As a customer, I want to filter presets by size range, so that I can find models suitable for my space.
8. As a customer, I want to filter presets by drawer style, basin count, and asymmetry, so that I can find the layout I need.
9. As a customer, I want similarly named presets to retain their distinct layouts, so that selecting another model changes the intended composition.
10. As a customer, I want preset cabinets to appear in their approved order, so that the configured layout matches the selected model.
11. As a customer, I want to build a custom Tricot composition, so that I can choose a layout beyond the ready-made presets.
12. As a customer, I want to choose supported sink-base and side-cabinet modules, so that my composition uses available Tricot products.
13. As a customer, I want the builder to offer the correct widths for each cabinet type, so that I cannot select an unsupported module size.
14. As a customer, I want Tricot cabinets to retain their 40 cm height and 52 cm depth, so that their construction remains valid.
15. As a customer, I want one-drawer, two-drawer, and inner-drawer options represented correctly, so that the storage configuration matches my selection.
16. As a customer, I want invalid composition combinations explained, so that I can adjust my design to a supported configuration.
17. As a customer, I want to choose from the 23 Tricot cabinet colors, so that I can select a finish from the actual collection.
18. As a customer, I want matte lacquer and wood veneer finishes grouped clearly, so that I can understand the material choice.
19. As a customer, I want Loden offered with matte lacquer, so that I can select the supported lacquer pattern.
20. As a customer, I want Cannette, Twill, Gessato, and Satin offered with wood veneer, so that I can compare the supported wood patterns.
21. As a customer, I want a material change to resolve an incompatible pattern consistently, so that my configuration remains valid.
22. As a customer, I want an already compatible pattern preserved when I change color, so that unnecessary changes do not disrupt my design.
23. As a customer, I want to choose the handle groove color from the 20 supplied matte lacquer colors, so that I can coordinate it with the cabinet.
24. As a customer, I want my selected pattern and groove color reflected in the scene, so that I can evaluate the appearance.
25. As a customer, I want to enable or disable Tricot side panels on their own page, so that I can choose the intended finish for the composition edges.
26. As a customer, I want side panels to follow the approved placement and material rules, so that the resulting product can be supplied.
27. As a customer, I want panel quantities and their effect on dimensions reflected in the configuration, so that the summary describes the actual product.
28. As a customer, I want panel prices included when panels are selected, so that the total accounts for all ordered parts.
29. As a customer, I want to choose from the 71 supplied countertop colors, so that I can explore the Tricot countertop range.
30. As a customer, I want countertop materials grouped correctly, so that Solid Surface, HPL, Porcelain, and Glass finishes are distinguishable.
31. As a customer, I want only compatible countertop thicknesses offered, so that the selected top matches its material and basin.
32. As a customer, I want to select the supplied basin styles using recognizable labels and images, so that I can choose the correct basin.
33. As a customer, I want basin availability to account for sink-base width, so that the basin fits the chosen cabinet.
34. As a customer, I want countertop and basin restrictions to apply in both flows, so that a preset and a custom composition follow the same product rules.
35. As a customer, I want countertop changes to resolve incompatible dependent selections, so that the summary does not retain an invalid combination.
36. As a customer, I want asymmetrical and double-basin models represented correctly, so that their geometry and ordered basin quantities match the selected layout.
37. As a customer, I want the five pages to appear in the agreed order, so that configuration follows a predictable sequence.
38. As a customer, I want to revisit earlier pages without losing compatible choices, so that I can refine my design.
39. As a customer, I want the summary to show my composition, finishes, patterns, panels, and countertop choices, so that I can review the configured product.
40. As a customer, I want accurate cabinet, panel, countertop, and basin prices, so that I can assess the cost of my configuration.
41. As a customer, I want incomplete pricing distinguished from a complete total, so that missing prices are not mistaken for free components.
42. As a customer, I want to save a Tricot configuration, so that I can return to it later.
43. As a customer, I want a restored configuration to retain Tricot identity and cabinet order, so that it opens as the same product I saved.
44. As a customer, I want restored patterns, groove colors, panels, and basin choices reapplied correctly, so that the scene and summary match my saved selections.
45. As a customer, I want undo and redo to preserve valid Tricot configuration states, so that I can safely compare edits.
46. As a customer, I want a clear error if required collection data cannot load, so that I understand why configuration cannot proceed.
47. As a collection maintainer, I want a separate Tricot package, so that its data can evolve independently.
48. As a collection maintainer, I want the master model list and SKU workbook retained as traceable sources, so that future changes can be verified.
49. As a collection maintainer, I want source names normalized through explicit aliases, so that spelling differences do not produce missing options or incorrect SKUs.
50. As a collection maintainer, I want shared API catalogs restricted to the Tricot range, so that another collection's options are not exposed accidentally.
51. As a collection maintainer, I want manifest references and profile source identities to agree, so that the rules use the intended API data.
52. As a collection maintainer, I want a validated Tricot cabinet table, so that Urban dimensions and handle restrictions cannot leak into the builder.
53. As a collection maintainer, I want reusable pattern and panel contracts, so that the integration fits the existing collection architecture.
54. As a collection maintainer, I want unknown product rules recorded as explicit dependencies, so that implementation does not invent supported combinations.
55. As a 3D/product contributor, I want a precise preset and scene handoff contract, so that I can provide all data required by the configurator.
56. As a 3D/product contributor, I want model compositions checked against source filters and module dimensions, so that inconsistent preset data is caught before release.
57. As a tester, I want source-backed SKU examples and expected prices, so that cabinet and panel pricing can be verified independently of the UI.
58. As a tester, I want incompatible material/pattern combinations rejected even when the API returns a price, so that price resolution cannot bypass product validation.
59. As a tester, I want integration coverage across loader, UI, state, runtime, and persistence, so that connected behavior is verified.
60. As a tester, I want both Tricot flows checked in the real scene after delivery, so that automated adapter tests are supported by visual acceptance.
61. As a project maintainer, I want existing collections and saved configurations to retain their current behavior, so that adding Tricot does not cause regressions.
62. As a reviewer, I want preparation and full customer acceptance distinguished, so that incomplete scene or preset inputs are not presented as a completed integration.

## Implementation Decisions

- The application collection identity is `tricot`, with display label Tricot. The source ProductID is `TRICOT`; the cabinet pricing series is `TRIC`. These identifiers serve different purposes and must remain distinct.
- Both prebuilt and custom flows are in scope. They use the agreed five-page sequence and a shared product profile, compatibility rules, and pricing contract.
- The agreed implementation modules are the Tricot collection package, product compatibility rules, runtime bindings, and SKU/pricing integration. Unit, integration, and eventual browser checks cover these modules.
- Reuse the existing collection loader and validation, profile-driven rules, generic field rendering, scoped state, runtime translator, and collection SKU/pricing builders. Extend their data contracts only where Tricot requires additional behavior.
- A source converter, if introduced, must expose a pure catalog normalization operation that can be tested independently. Production loading consumes packaged data and declared API sources, without requiring access to a developer's downloaded spreadsheet.
- The collection package contains a manifest, preset data, UI schema, product profile, runtime bindings, SKU profile, and required images. Derive navigation from the UI schema; a separate navigation dataset is unnecessary unless an existing consumer requires it.
- The Tricot SKU profile is the source of its SKU codes. The legacy cabinet mapping dictionaries alone cannot describe the full Tricot contract and must not become a second independent copy of those codes.
- Register Tricot through the existing collection mechanism. Keep application startup, URL identity, source validation, and collection-specific error handling consistent with other collections.
- Stage incomplete data for development and review, but do not expose guessed compositions, substitute another collection's scene products, or claim complete customer readiness before the acceptance dependencies are met.

### Catalog and profile contract

- Parse the master as a quoted, tab-delimited table using header names. The supplied file has 185 data rows, 19 columns, and nine source attributes.
- Preserve the 42 Model values, display labels, source ordering, Conceptsize ranges, and style metadata. Map source filters to the existing preset filter vocabulary; Conceptsize values are size buckets rather than cabinet module widths.
- Assign stable preset identifiers and retain a traceable mapping to source Model values. Similar names and identical filters must not collapse distinct models.
- Declare semantic attributes, scopes, allowed values or external sources, aliases, reset behavior, rule dependencies, persistence, and runtime decisions in the collection contracts.
- The cabinet color range is 20 matte lacquer colors and three wood veneers: Noce Canaletto 933, Rovere Oro 932, and Rovere Termocotto 931. Material codes are LACM and WDV respectively.
- The groove color range is the 20 master matte lacquer colors. The source attribute Handle Color is displayed as Handle Groove Color; runtime mapping follows the delivered scene contract.
- Preserve the five pattern identities and explicitly normalize Cannette/Cannete. Pattern SKU tokens are CAN, TWLL, GES, SAT, and LOD.
- The countertop range has 71 colors: two Solid Surface, 14 HPL, 15 Porcelain, 20 Glass MT, and 20 Glass GL. The ten source basin values are LB440, LB175, LB575, LB856, VA023, VA024, LV890, LV892, VA002, and VA005.
- Class and Tricot share the ten basin values. Their Glass countertop spellings differ: Class prefixes 40 values with G, while Tricot does not. Resolve those aliases explicitly within the countertop material context.
- If an external catalog contains a broader range, apply a Tricot allowlist while preserving material, color-code, texture, and swatch metadata. Referencing a shared catalog group alone does not establish collection membership.
- Use existing semantic attributes when their meaning and scope fit. If Cabinet Pattern requires a distinct attribute rather than the current drawer fluting attribute, carry it through commands, scoped state, persistence, replay, pricing, and summary. Do not rename a source field without checking its downstream meaning.

### Product rules and DataTables

- Support Sink Base widths of 60, 80, 100, and 120 cm; Side Cabinet widths of 40, 60, 80, 100, and 120 cm. All three drawer styles use height 40 cm and depth 52 cm.
- Represent one external drawer, two external drawers, and one external drawer with an inner drawer as distinct styles. Preserve existing semantic drawer aliases where applicable; the pricing tokens are 1DW, 2DW, and 1DWID.
- Enforce pattern/material compatibility in product validation: Loden requires LACM; Cannette, Twill, Gessato, and Satin require WDV.
- Extend the shared pattern rule contract to express eligibility per option. The current single eligible-material list cannot enforce different materials for different patterns.
- Preserve compatible selections after a parent change. Resolve incompatible selections using the existing command and field reset/selection mechanisms, with Tricot-approved defaults or deterministic profile order. If no valid selection exists, report an unavailable state and prevent invalid runtime or pricing operations.
- The user owns DataTable comparison, creation or copying, and publication in the API. The integration consumes the delivered IDs and verifies their schemas and semantics.
- USH cabinet table 439 is unsuitable without changes: it contains heights 50/53/56 cm, depths 46/50.5 cm, and Urban-specific dimensions and handle rules. The Tricot cabinet source must match the confirmed module catalog and construction.
- The user supplied final cabinet table 592 and countertop table 593 on 2026-10-07. Consume these Tricot tables, not candidate tables 577/578. Table 592 uses `Sink-Cabinet` for the semantic Side Cabinet and `forced_height_cm` for all drawer styles. Its `60:1DWID` exclusion prevents integrated basins on 60 cm Sink Bases with inner drawers.
- Table 593 supplies five thicknesses (1/2, 3/4, 3-1/8, 4, 4-3/4), material-specific basins and widths/depths. VA023 requires at least 80 cm and thickness 3-1/8. Compatibility approval does not replace verification of shared GB pricing mappings. Preserve table notes as evidence, including their outstanding thick-top/glass-hole confirmations; do not invent features from those notes.
- Keep manifest API references, product-profile source references, and matrix column adapters consistent. Pricing matrix identifiers must not be used as cabinet compatibility table identifiers.
- Panels belong to Accessories and inherit the cabinet's color/material. Each active side adds 1 cm to the countertop width (both sides add 2 cm), using the existing shared calculation. Do not translate Yes/No into Urban groove variants without actual Canvas bindings. The user confirmed the full panel SKU is `VAN-TRIC-SP-.8W-15.7H-20.5D-CAB-{material}-{color}`. Count actual active left/right sides, not an assumed pair; missing or contradictory activation readback prevents a complete panel price. A scene-committed countertop length is already final and must not receive a second offset.
- Do not mix two-drawer modules with one-drawer modules; one drawer with an inner drawer belongs to the one-drawer family.
- Obtain composition mixing, countertop compatibility, length limits, scope decisions, and required/default selection rules from the designated product owner where supplied sources do not establish them. Unknown rules must not silently become unrestricted behavior.

### Preset and scene handoff

The user confirmed that their 3D/product team owns scene preparation and the composition data for all 42 presets. The configurator team owns integration of those delivered inputs.

| Required input                           | Owner                   | Acceptance requirement                                                                                                                              |
| ---------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preset compositions                      | 3D/product team         | One mapping per source Model value; ordered module types, dimensions, drawer styles, quantities, basin positions, and initial product configuration |
| Preset and option images                 | 3D/product team         | Traceable model/pattern/basin images with usable references and the right visual identity                                                           |
| Scene products and assets                | 3D/product team         | Placeable Tricot products and materials that support the approved module catalog and appearance                                                     |
| Scene API contract                       | 3D/product team         | Product type identifiers, accepted keys and values, units, targets, reset and ordering constraints, and configuration readback behavior             |
| Product decisions and defaults           | Product team            | Panel topology and pricing inputs, allowed composition mixing, required selections, valid initial colors/pattern/basin, and approved default preset |
| Configurator catalog and DataTables      | User/API owner          | Final IDs, option metadata, column mappings, and reviewed Tricot compatibility rules                                                                |
| Shared countertop/basin pricing evidence | User/product/API owners | Confirmed shared SKU mappings, thickness/material distinctions, and price-resolution evidence for the supported range                               |

- Do not derive preset module layouts from model names, nominal widths, or another collection's presets. Model suffixes distinguish layouts that the master does not describe.
- Validate supplied compositions against the module catalog, drawer styles, basin counts, filter tags, and approved composition constraints. Any width discrepancy must be reconciled with nominal product naming and panel geometry.
- Declare runtime translations for every relevant UI/core attribute, including dimensions, drawers, colors, pattern, panels, countertop, and basins. Use the existing runtime port and composition operations.
- Use bound mappings for visual choices. A state-only decision is appropriate only for attributes that intentionally have no visual effect. Missing scene support must remain an explicit dependency or unsupported action.
- Define attribute targets and operation order from the real scene contract. Do not assume Mako or Urban targets and keys apply to Tricot.
- Saving and restoring must retain collection identity, cabinet order, semantic selections, panel state, and basin associations. Reapply values through the normal runtime translator after loading the same collection.

### SKU and pricing contract

- Use the existing collection cabinet builder with a Tricot config block ordered as cabinet type, drawer style, and pattern. Cabinet material/color and handle groove material/color are separate CAB and HDL elements.
- Do not introduce a Handle Style token into the config block: the supplied Tricot grammar does not contain one.
- Build cabinet dimension tokens in inches with the established one-decimal conversion. Source cabinet construction remains in centimeters. Keep the workbook's centimeter curation rows distinct from its inch pricing rows.
- Support a dedicated Tricot side-panel SKU contract in the shared SKU schema and pricing line builder. The existing side-panel contract supports only Urban pricing delegation and cannot describe Tricot's own panel SKU.
- Use the source panel dimension tokens and confirmed material selection; resolve physical dimensions, color inheritance, and quantities through handoff. Verify the complete panel spelling with the pricing API before treating its suffix as final.
- Countertop and basin pricing uses the shared GB contract documented by the workbook's Class references. Reuse existing GB builders and mappings where verified; do not delegate these products to Urban pricing by default.
- Preserve distinctions between display thickness, matrix thickness tokens, physical units, and SKU thickness tokens. A color named Matte White 8cm does not alone establish its complete pricing contract.
- Build validated order lines with explicit component identity and quantity. Panels, basins, and other supported parts must not be omitted from a complete total.
- Use pricing resolution after product validation. The audited API returned a price for a WDV/Loden request even though the source restricts Loden to matte lacquer; that response must not make the configuration valid.
- Represent unresolved required pricing inputs or null prices as explicit gaps. A partial price must not be presented as the confirmed total, and missing parts must not count as zero-priced components.
- The accessory worksheet refers to Class pricing; that reference does not establish a Tricot UI feature catalog. Add only features covered by the agreed flow and approved product handoff.

### Delivery sequence and acceptance

| Stage                            | Deliverable                                                                              | Completion condition                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1. Establish inputs              | Source inventories, confirmed ownership, and handoff requirements                        | Known data separated from required external inputs                     |
| 2. Prepare collection data       | Normalized catalogs, five-page UI, preset identity mapping, and SKU profile              | Source-backed data validates without production assumptions            |
| 3. Extend shared behavior        | Pattern eligibility and own side-panel SKU/pricing support; aliases/allowlists as needed | Public behavior verified independently of a real scene                 |
| 4. Integrate delivered resources | Final API references, all preset compositions, images, runtime bindings, and defaults    | Package and handoff contracts pass validation                          |
| 5. Verify connected flows        | Prebuilt/custom UI, commands, state, persistence, summary, and prices                    | Integration tests and required code checks pass                        |
| 6. Accept the real product       | Browser and visual checks using the delivered Tricot scene                               | Both flows work with valid compositions and complete supported pricing |

- Full acceptance requires all 42 presets to have approved, nonempty, placeable compositions and usable images.
- Both flows must expose the agreed page order and the approved Tricot catalogs, reject invalid combinations, and preserve collection identity.
- Visual selections must affect the intended Tricot scene products. Save/restore and undo/redo must reproduce the approved configuration.
- Required pricing components must resolve with the expected SKU grammar, quantities, and totals. Outstanding product or pricing gaps block claims of full acceptance for affected configurations.
- Existing collections, application default behavior, and legacy saved configurations must pass relevant regression checks.

## Testing Decisions

- The user approved unit tests for product rules and SKU builders, integration tests for loading, UI → state → runtime and save/restore, and browser checks of both flows after scene delivery.
- Good tests assert external behavior: accepted and rejected configurations, visible options, generated SKUs and quantities, translated scene operations, persisted values, and displayed readiness or pricing gaps. Avoid tests that merely repeat internal implementation structure.
- Use existing collection contract tests, Mako preset composition tests, runtime-binding tests, placed-cabinet rule tests, generic field tests, collection SKU/pricing tests, and save/restore tests as prior art.
- Test the source converter, if introduced, with quoted tab-delimited input, named headers, model ordering, duplicates, empty values, aliases, and distinct models sharing the same filter tags.
- Test package validation through the real collection loader: collection identity, safe references, source failures, profile/UI/runtime agreement, final API calls, and consistent source IDs.
- Test all 42 preset identities and, after handoff, their ordered compositions, valid dimensions, drawer styles, basin counts, images, and source filter consistency. Use supplied expected layouts as independent evidence.
- Test cabinet widths separately for SB and SC, all three drawer styles, and the fixed 40/52 cm height/depth contract. Confirm that Urban dimensions and handle restrictions are not introduced.
- Test all five patterns against both cabinet material families. Validate the allowed combinations and reject the others through commands, not only through disabled UI options.
- Test a material change with compatible and incompatible existing patterns, deterministic replacement or clearing, unavailable states, and replay after restoration.
- Test aliases for Cannette/Cannete and all affected Glass colors, including preservation of material, texture, color-code, and SKU metadata.
- Test external catalog allowlists so Tricot cannot expose unrelated variants from a shared configurator.
- Test side-panel activation, removal, quantities, inheritance, geometry effects, runtime operations, and pricing against the delivered product contract. Do not encode assumed quantities as expectations.
- Test countertop material/thickness/basin contexts, VA023 minimum width, thick-top behavior where approved, and dependent selection resets. Validate Tricot's range against the selected table rather than assuming every shared row is supported.
- Test source-backed cabinet SKU examples, including WDV/TWLL and LACM/LOD, inner drawers, dimension rounding, CAB/HDL color elements, and missing required inputs. Cover the 135 priced cabinet combinations with traceable fixtures where practical.
- Test the own side-panel SKU and WDV/LACM price lines, including zero selected panels and the approved quantity semantics.
- Test pricing gaps for null prices, missing material codes, missing panel rules, and unresolved required shared pricing inputs. Reject product-invalid combinations even if a mocked resolver supplies a price.
- Test both flows' page sequence, section ordering, back navigation, preset application, and shared rule behavior through rendered UI and configuration commands.
- Test runtime product placement, configuration targets, reset/order constraints, state readback, and errors with the existing runtime test port. Repeat visual acceptance with the real scene after delivery.
- Test save/restore, undo/redo, cabinet ordering, basin associations, Tricot-specific attributes, and collection identity. Existing saved configurations without Tricot identity must preserve their established behavior.
- Browser acceptance covers a single-module preset, distinct numbered layouts, an inner-drawer preset, asymmetry, double basins, material/pattern changes, panels, a custom composition, accurate summary, and save/restore in both flows.
- Run TypeScript validation, applicable lint, relevant tests, and production build for implementation. Broaden regression coverage for changes to shared contracts and complete final required checks without presenting pre-existing failures as new Tricot regressions.
- API pricing checks are evidence of current integration behavior, not mandatory network dependencies of unit tests. Record request cases and expected workbook values separately from mocked deterministic checks.

## Out of Scope

- Creating or authoring the Tricot 3D scene, meshes, materials, or scene scripts; these are owned by the user's 3D/product team. Integrating their delivered products is in scope.
- Inventing the composition, basin positions, or initial appearance of the 42 presets. The integration consumes approved layouts and resources from that team.
- Creating, copying, or publishing API DataTables on the user's behalf. The user owns that workflow and provides the final sources.
- Integrating Urban Freestanding or any other new collection as part of this Tricot work.
- Replacing the collection architecture or introducing a separate Tricot rule engine.
- Adding unconfirmed Tricot accessory, vessel, handle-style, leg, or faucet-hole UI features beyond the agreed pages and approved product requirements.
- Redesigning shared checkout, quoting, swatch ordering, or pricing infrastructure beyond the changes needed to support Tricot's agreed behavior.
- Using copied Urban/Mako/Class compositions, arbitrary API identifiers, fabricated defaults, or pricing fallbacks to disguise missing Tricot inputs.
- Repairing unrelated Class pricing failures as part of Tricot implementation unless a shared change requires addressing them.
- Deployment or external publication as part of this PRD deliverable.

## Further Notes

- Dated notes below preserve the requirements and handoff history. The sole maintained list of current external questions is [open-questions.uk.md](tricot-integration/open-questions.uk.md); later receipts supersede earlier missing-input statements.
- This PRD is written in English as requested. The user confirmed the frontend/external-team responsibility split, both flows, five-page grouping, implementation modules, and test coverage.
- The source master is [Hasting-Master-File-[_Tricot Vanity_] (2).csv](</Users/a123/Downloads/Hasting-Master-File-[_Tricot Vanity_] (2).csv>). It is byte-identical to the Tricot master in the local review repository and was confirmed by the user as the preset list.
- The supplied SKU source is [Tricot Vanities - SKUs + Pricing.xlsx](</Users/a123/Downloads/Tricot Vanities - SKUs + Pricing.xlsx>). All six worksheets, comments, hyperlinks, and embedded images were inspected. CabinetPricing contains 135 cabinet rows and one panel row.
- The [integration audit](tricot-integration.audit.md) records source details, workbook cell references, architecture findings, live checks, and the pre-existing test baseline. Local review repository branch: `analysis/products-data`, inspected commit `c45df78`; configurator code inspected at `dca2fc64`.
- The originally linked Google SKU sheet could not be read directly; the user's XLSX supplied the required cabinet data. The Tricot workbook's countertop, basin, and accessory sheets refer to a separate Class workbook rather than containing those price rows themselves.
- Shared source references extracted from the workbook are [Class CountertopPricing](https://docs.google.com/spreadsheets/d/1ZmGk1OcPASzAH_uC4HR6JRh89qH8gid0gJla33nq6GM/edit?gid=1405440096), [Class Basin StylePricing](https://docs.google.com/spreadsheets/d/1ZmGk1OcPASzAH_uC4HR6JRh89qH8gid0gJla33nq6GM/edit?gid=2023763518), and [Class AccessoriesPricing](https://docs.google.com/spreadsheets/d/1ZmGk1OcPASzAH_uC4HR6JRh89qH8gid0gJla33nq6GM/edit?gid=269769622). Their external contents were not retrieved during the audit.
- Live checks on 2026-10-06 confirmed existing configurators 4/9 and DataTables 438/439/577/578. Configurator 9 is named for Mako and is also referenced by the current Class package; no Tricot configurator ID was approved. Class currently uses countertop table 578, while Mako uses 577.
- Verified full cabinet examples are `VAN-TRIC-SC/1DW/TWLL-15.7W-15.7H-20.5D-CAB-WDV-933-HDL-LACM-412` at 2014 and `VAN-TRIC-SC/1DWID/LOD-47.2W-15.7H-20.5D-CAB-LACM-413-HDL-LACM-413` at 3097. These match the supplied workbook.
- The panel base is `VAN-TRIC-SP-.8W-15.7H-20.5D`; audited requests with CAB-WDV-933 and CAB-LACM-400 suffixes resolved to 984 and 941 respectively. The full suffix and physical panel behavior still require the final contract.
- Historical workbook screenshots show null WDV and divider prices. The audited valid examples resolved successfully, including `VAN-GBDIV-MTL-3.9W-2H-16.9D` at 170. This does not establish a Tricot divider feature or verify the entire price list.
- A deliberately incompatible WDV/Loden request returned 3045, confirming that pricing success cannot replace material/pattern validation. A lacquer/CAN request returned null. Pricing matrix 556 and color map 495 are pricing metadata, not the missing Tricot cabinet compatibility source.
- Before implementation begins, the audit baseline passed TypeScript validation. Four selected test suites had 92 passing tests and one existing Class default-price failure out of 93 tests. Full-suite, lint, build, and real Tricot browser validation were not performed during requirements work.
- Handoff update — 2026-10-07: the delivered [composition CSV](https://docs.google.com/spreadsheets/d/1DiHGU4nn4c9e_FZKZZirxPREMGXaUUZwAaapggesgx0/edit) provides all 42 recipes / 88 ordered modules and basin associations. Archive it in the collection package. Defaults come from its explicit rows: Rovere Oro 932 / Cannette / Nero 433 MT / no panels / Matte White / LB440. This does not select a default model or invent physical offsets.
- Downloaded 41 exact 300×300 model thumbnails from the supplied public 2D configurator. Its thumbnail URL for `Tricot 79 2DW 1_70` returns HTTP 404. Preserve that recipe, mark its image pending and request a PNG or corrected link; do not substitute another layout. Source asset IDs are public Threekit references, not Canvas module IDs.
- Final 592/593 source references and response fixtures are delivered. Actual Canvas module IDs and attribute bindings remain pending until the 3D team finishes its models. Remaining activation dependencies are that runtime contract, the one pending image, verified shared GB pricing mappings and real-scene acceptance. Remote configurator identity/metadata are required if a remote option catalog is used.
- Follow-up approval — 2026-10-07: the user supplied both Monosnap screenshots directly and confirmed the CAB material/color suffix. The Accessories image is an Urban layout reference, not approval to add its groove-specific panels, Dividers or Towel Bar to Tricot. The preset-default screenshot agrees with the archived CSV. Panel price spelling, inheritance and per-active-side quantity/width policy are now declared in production data; actual visual panel activation remains gated by missing Canvas bindings. The user will supply the remaining model PNG later.
- Partial cabinet runtime handoff — 2026-10-07: real Tricot sink/side product types, cm dimensions, drawer tokens and exact cabinet/groove material fields are supplied and integrated. All 20 matte lacquer assets are verified in staging afd76fa6; the three source wood-veneer materials are absent and remain pending. Do not replace CSV defaults with scene fallback defaults or expand catalogs from the GL API example. Tricot opts into composition/restore preflight and explicit per-value runtime gaps. Remaining pattern/panel/countertop/basin contracts, metadata, GB pricing and one PNG are separated in `tricot-integration/open-questions.uk.md`. Full activation and real-scene acceptance remain pending.
