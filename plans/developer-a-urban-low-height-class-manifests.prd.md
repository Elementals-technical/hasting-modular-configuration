# Developer A — Urban Low Height and Class collection manifests

## Problem Statement

The application currently registers only Urban Standard Height as a production collection. Product-analysis material for Urban Low Height and Class now exists in the `analysis/products-data` branch of the review repository, but the application has no manifests or collection packages for either product. A URL with either collection ID is therefore rejected as unknown, and the UI cannot load collection-specific navigation or data.

The available inputs are sufficient to identify both products and describe a substantial part of their 2D option catalogs. Urban Low Height includes 59 model labels, cabinet and countertop palettes, basin-style associations, and a separate documented cabinet SKU analysis. Class includes 44 model labels and collection-specific cabinet, side, frame, countertop, and basin option groups. The product owner confirmed that both collections use Configurator `4`, Countertop DataTable `438`, and Cabinet DataTable `439`, the same remote sources as Urban Standard Height. The inputs still do not provide approved defaults, complete preset BOMs and images, Urban Low Height PlayCanvas product types, complete runtime mappings, or a complete pricing contract.

The current runtime manifest requires a `defaults` object, and the current ProductProfile contract requires numeric source references. Inventing values, copying Urban Standard Height values, or interpreting partial model rows as approved presets would make a collection appear more complete than its source data permits. Registering an empty package without explicit UI behavior would technically reach `ready` while rendering a misleading or unusable experience.

Developer A needs to add honest, independently loadable Urban Low Height and Class packages. Each package must resolve through the existing collection registry and loader, enter `ready` only for the data it actually declares, preserve the collection ID through UI navigation, and present a clear collection-specific shell or empty state without requesting Urban Standard Height sources. Missing production inputs must remain explicit and must not be replaced by fallback data.

## Solution

Create separate collection packages for Urban Low Height and Class and register the confirmed application IDs `urban-low-height` and `class`. Source identifiers such as `USTD` and `CLSV` remain provenance values and are not treated as application collection IDs.

Each package receives a valid manifest and a collection-specific customization schema derived from confirmed 2D categories and existing application routes. The schemas define the steps that the current UI can enter safely and omit unsupported collection features instead of inheriting the Urban Standard Height schema. Collection labels and navigation must make it observable in the browser which package is active.

The first delivery is a partial launch backed by the confirmed shared remote sources. Both manifests declare Configurator `4`, Countertop DataTable `438`, and Cabinet DataTable `439`. Presets and `defaultPresetId` are omitted because the source does not contain approved preset BOMs and images; the existing collection-specific empty state is used. Manifest defaults remain an empty object until approved values arrive. ProductProfile may be omitted until its required rule data can be represented without borrowing Urban Standard Height semantics. Runtime bindings are explicitly omitted in this phase. Any local option data that is included must be normalized from the supplied tab-separated master files through a deterministic, validated transformation rather than copied by hand or imported directly from the review repository at runtime.

The loader continues to treat omitted sources as absent. A declared source remains mandatory: if a manifest names a file, that file must load and validate, and cross-contract identity checks must pass. The new packages must not contain Urban Standard Height remote IDs, defaults, presets, runtime mappings, SKU mappings, or option values unless the supplied product documents explicitly establish that the value is shared.

The UI launch acceptance for this PRD means that `/prebuilt?collectionId=urban-low-height` and `/prebuilt?collectionId=class` resolve to their collection-defined entry route, load the three approved shared remote sources, remain on the selected collection while navigating, and render a deliberate collection-specific view or empty state without an unknown-collection error. It does not mean that cabinet placement, PlayCanvas updates, Save/restore, pricing, or checkout are production-ready.

Record a readiness handoff next to the implementation. It must distinguish packaged facts from missing inputs and name the owners needed to progress ProductProfile, UI rendering, runtime bindings, presets, and pricing. When the missing data arrives, it should be possible to extend each manifest by adding sources without adding collection-ID branches to application code.

## User Stories

1. As a configurator visitor, I want Urban Low Height to be a recognized collection, so that its URL does not fail as unknown.
2. As a configurator visitor, I want Class to be a recognized collection, so that its URL does not fail as unknown.
3. As a configurator visitor, I want the active collection name to be observable in the UI, so that I can tell which product I am viewing.
4. As a configurator visitor, I want navigation to preserve `collectionId`, so that moving between steps does not silently return me to Urban Standard Height.
5. As a configurator visitor, I want the collection entry URL to redirect to the first step declared by that collection, so that entry behavior comes from collection data.
6. As a configurator visitor, I want unavailable preset data to produce a clear empty state, so that partial source data is not presented as a load failure.
7. As a configurator visitor, I want unavailable configuration features to be omitted or disabled, so that the UI does not offer unsupported actions.
8. As a configurator visitor, I want a partial collection to avoid showing Urban Standard Height values, so that I cannot mistake fallback content for product data.
9. As a configurator visitor, I want switching between Urban Standard Height, Urban Low Height, and Class to clear collection-derived state, so that options do not leak between products.
10. As a collection maintainer, I want one folder per collection, so that each package can evolve independently.
11. As a collection maintainer, I want the manifest ID to match the registry entry and local data identity, so that copied files cannot be assigned to the wrong collection.
12. As a collection maintainer, I want source product identifiers preserved as provenance, so that `USTD` and `CLSV` remain traceable without becoming unverified application IDs.
13. As a collection maintainer, I want all collection paths to be safe relative JSON references, so that packages cannot load arbitrary files.
14. As a collection maintainer, I want both manifests to use the explicitly approved shared remote IDs, so that source selection is reviewable and consistent.
15. As a collection maintainer, I want every declared local file validated, so that a broken package fails before a user interacts with it.
16. As a collection maintainer, I want missing files to block `ready`, so that a manifest cannot promise data that is absent.
17. As a collection maintainer, I want collection-specific UI schemas, so that Urban Low Height and Class do not inherit Urban Standard Height sections by accident.
18. As a collection maintainer, I want the UI schema to use only application routes that currently exist, so that collection navigation cannot lead to a missing page.
19. As a collection maintainer, I want the 2D master files transformed deterministically, so that future source revisions produce reviewable changes.
20. As a collection maintainer, I want duplicate or empty source values rejected or reported, so that option catalogs do not silently contain malformed entries.
21. As a collection maintainer, I want source ordering preserved where the source declares ordering, so that the UI matches the supplied catalog.
22. As a collection maintainer, I want unresolved source conflicts recorded, so that an inference does not become a hidden product decision.
23. As a Developer B consumer, I want each collection's navigation available through the active collection API, so that UI components do not branch on collection ID.
24. As a Developer B consumer, I want a deliberate no-presets state, so that the prebuilt screen can remain usable while preset BOMs are unavailable.
25. As a Developer C consumer, I want missing ProductProfile data represented as absent, so that state and rules do not use Urban Standard Height values.
26. As a Developer C consumer, I want approved defaults supplied before they initialize configuration state, so that analysis examples are not treated as defaults.
27. As a Developer I consumer, I want runtime bindings omitted until the supplied product types and attributes have complete scene mappings, so that a collection cannot claim scene support based on partial API documentation.
28. As a Developer I consumer, I want unsupported runtime actions to return not-ready or unsupported, so that partial launch cannot mutate the wrong scene.
29. As a Developer D consumer, I want pricing and SKU data excluded from readiness claims, so that incomplete price sources cannot produce customer-facing totals.
30. As a tester, I want both new IDs resolved through the real registry and loader, so that tests cover the same contract used by the browser.
31. As a tester, I want both manifests to reach `ready` using only their declared local sources, so that the partial launch is executable.
32. As a tester, I want remote loader spies to receive exactly Configurator `4`, Countertop DataTable `438`, and Cabinet DataTable `439` for both packages, so that the approved shared-source decision is executable.
33. As a tester, I want the loaded package to contain no copied USH presets, defaults, ProductProfile, runtime bindings, or SKU mappings while loading only the explicitly approved shared remote catalogs, so that isolation is measurable.
34. As a tester, I want browser routing to retain each new `collectionId`, so that navigation regressions are caught.
35. As a tester, I want an invalid local file or identity mismatch to produce `error`, so that the new packages do not weaken validation.
36. As a project maintainer, I want Urban Standard Height behavior unchanged, so that registering new collections does not alter the default product.
37. As a project maintainer, I want the production default collection to remain Urban Standard Height, so that existing links without `collectionId` remain compatible.
38. As a project maintainer, I want no direct runtime dependency on the review repository, so that application builds remain reproducible.
39. As a project maintainer, I want copied or generated artifacts to record their source branch and source file, so that later updates can be audited.
40. As a project maintainer, I want a readiness matrix for each new collection, so that the team knows exactly what data still blocks presets, custom configuration, scene execution, Save/restore, and pricing.
41. As a product owner, I want unresolved local IDs, defaults, model compositions, and source IDs called out explicitly, so that I can provide the missing decisions.
42. As a product owner, I want no source row promoted to a supported feature without evidence, so that the application does not invent product behavior.
43. As a reviewer, I want the work split into independently reviewable issues, so that registry, packages, UI launch, and handoff can be assessed separately.
44. As a reviewer, I want each issue committed independently, so that changes can be reviewed or reverted in small units.
45. As a reviewer, I want TypeScript, relevant tests, changed-file lint, the complete test suite, and production build evidence, so that the new registrations are safe to merge.

## Implementation Decisions

- Work continues on a dedicated branch created from the current integration branch and is committed once per approved issue.
- The confirmed application collection IDs are `urban-low-height` and `class`.
- Urban Standard Height remains the registry default.
- Both manifests declare the approved shared sources: Configurator `4`, Countertop DataTable `438`, and Cabinet DataTable `439`.
- The manifests contain only confirmed data. Defaults, presets, ProductProfile semantics, runtime bindings, SKU mappings, and pricing data are not copied from Urban Standard Height merely because the remote source IDs are shared.
- An empty manifest defaults object means that this partial package initializes no manifest-level configuration defaults; the readiness handoff states that approved defaults are still missing.
- Each collection receives its own customization schema. It uses existing routes and only the steps that can render a truthful partial state.
- Navigation is derived from the customization schema rather than maintained as a second independently edited definition.
- A visible collection identity or development-facing collection status is added at the shared UI boundary if the existing UI provides no observable way to distinguish the active package.
- Supplied master files are treated as tab-separated source data even though they use a `.csv` extension.
- Any transformation of source catalogs is isolated behind a deterministic converter with typed output and source diagnostics.
- The converter does not treat model labels as presets because ordered product BOMs, images, quantities, positions, and defaults are missing.
- Urban Low Height's source `ProductID=USTD` is preserved only as provenance and flagged as unresolved.
- Class's source `ProductID=CLSV` is preserved only as provenance until the external/runtime identity is confirmed.
- ProductProfile is not declared unless the implementation can represent its required rule data without borrowing Urban Standard Height behavior. The numeric source IDs themselves are now known.
- Runtime bindings are not declared in this phase. The known Class product type and field names are recorded for later I-owned mapping work, but they do not constitute a complete binding table.
- The legacy runtime-binding cache must not receive a request for a binding file that the active manifest does not declare. If necessary, its bridge is changed to read the loaded catalog rather than constructing a fixed path.
- Missing data is exposed through documentation and deliberate empty/unsupported UI behavior. Console-only errors are insufficient acceptance evidence.
- The new packages do not add collection-ID conditionals to page or loader code.
- If the shared endpoints expose rows for several products, collection-specific filtering or normalization must be based on confirmed source identity rather than collection-ID conditionals or USH fallback behavior.

## Testing Decisions

- Tests assert public behavior through registry resolution, collection loading, active-provider state, navigation, and rendered empty states rather than private helper calls.
- Manifest contract tests cover both new registry entries, ID parity, safe references, and preservation of Urban Standard Height as default.
- Loader integration tests load each package through its manifest and assert `ready`, collection-specific customization, absence of blocking diagnostics, and the exact approved remote calls.
- Isolation tests assert that neither package exposes copied Urban Standard Height presets, defaults, ProductProfile, runtime bindings, or SKU mappings; remote catalogs must come only from the explicitly approved shared source calls.
- Negative tests cover identity mismatch, a declared missing file, and malformed collection-specific UI input.
- Routing tests start at each collection's flow URL and assert the declared entry route and preservation of `collectionId` across navigation.
- UI tests assert an observable collection label or status and a clear no-presets/unsupported state for data that is intentionally absent.
- Existing fixture and active-collection tests are prior art for source maps, remote spies, lifecycle transitions, and isolation assertions.
- Urban Standard Height regression tests continue to verify its manifest, presets, defaults, source IDs, and default resolution.
- The source converter, if introduced, is tested with representative ordered rows, duplicates, empty values, tab-separated parsing, and unresolved provenance identifiers.
- Validation runs on Node 22 where required by the existing Vite/Vitest toolchain.
- Each implementation issue runs relevant tests, TypeScript validation, and lint for changed files. The final issue runs the complete suite and production build and records any repository-wide pre-existing lint baseline accurately.
- Browser acceptance covers both collection URLs, successful shared DataTable/Configurator requests, initial redirect, navigation, deliberate empty states, and switching back to Urban Standard Height without leaked state.

## Out of Scope

- Inventing or guessing pricing table, asset, mesh, or additional runtime IDs beyond the three approved shared source IDs.
- Treating Urban Low Height `ProductID=USTD` as confirmation that it uses Urban Standard Height runtime sources.
- Treating Class `ProductID=CLSV` as a confirmed external configurator or scene ID.
- Creating approved defaults from the first CSV row, analysis examples, or rule-case base scenarios.
- Converting model labels into production presets without BOMs, images, positions, quantities, and per-product configuration.
- Implementing the full Urban Low Height or Class ProductProfile and business-rule evaluator from incomplete inputs.
- Implementing PlayCanvas product types, mappings, geometry, assets, readback, or real-scene acceptance.
- Implementing SKU generation, price calculation, quote totals, or checkout for either new collection.
- Claiming Save/restore compatibility before semantic attributes, scopes, runtime mappings, and defaults are approved.
- Completing all collection-specific UI controls that are not yet supported by the shared renderer, including Class side and frame color behavior.
- Copying Urban Standard Height options, runtime mappings, presets, cabinet matrices, or pricing as temporary fallback data.
- Changing the default collection away from Urban Standard Height.

## Further Notes

- Source inputs are taken from the `analysis/products-data` branch of the review repository. Urban Low Height currently consists of a product-map document and a 379-row tab-separated master file. Class consists of two logic documents and a 317-row tab-separated master file.
- Urban Low Height confirms 59 model labels, 232 cabinet material/color rows, 61 countertop color rows, and 13 countertop/basin-style rows, but does not provide model BOMs or reliable runtime source identity. Its `ProductID=USTD` conflicts with the product name and must be resolved.
- Class confirms 44 model labels, 108 cabinet color rows, 52 cabinet-side color rows, 20 frame color rows, 71 countertop color rows, and 10 basin-style rows. It lacks an artist/runtime manifest and approved default selections.
- Both products use Configurator `4`, Countertop DataTable `438`, and Cabinet DataTable `439`. Full current API response samples are still useful to prove how records from these shared sources are partitioned by collection.
- Approved defaults must identify exact semantic values and scopes. Presets require stable IDs, images, filters, ordered product BOMs, quantities, positions, and initial product configuration.
- A supported-attribute inventory must state each attribute's semantic ID, scope, type, allowed values or source, default, required/optional status, rule dependencies, persistence behavior, and runtime mapping or explicit unsupported status.
- ProductProfile still requires collection-specific rule semantics beyond the now-known source IDs. It remains omitted until those semantics can be represented without copying the Urban Standard Height adapter and fallbacks.
- The current runtime bridge may still construct `<collectionId>/runtime-bindings.json` independently of the manifest. A partial package that omits bindings must not generate a failed request; resolving this is part of honest UI launch behavior.
- The confirmed Class runtime API can add product type `Class-side-cabinet`. Supported configuration fields currently documented are `Width` = 40/60/80/100/120, `Height` = 40/52, `Depth` = 52, `InnerDrawer` = `Disable`/`Enable`, `CabinetColor`, `CabinetSideColor`, and `FrameColor`. `addProduct` returns the cabinet ID used by later `setConfig`, `getConfig`, and removal operations. These facts are inputs to a later runtime-binding and command-integration phase; this PRD does not wire direct page calls around the runtime port.
- Full product launch requires follow-up work from B for collection-specific field rendering, C for semantic state/rules/defaults and Save/restore, I for scene assets and runtime bindings, and D for SKU/pricing.
