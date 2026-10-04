# Developer A — Active collection contract integration

## Problem Statement

The application can resolve and load an active collection, and separate teams have already added a collection-defined UI schema, a semantic ProductProfile, and PlayCanvas runtime bindings. These datasets are still parallel assets rather than one active-collection contract: the production manifest does not declare the UI schema or runtime bindings, the collection loader does not load or cross-check them, and downstream code can only use them through direct imports.

This gap prevents the intended A → B → C → I flow from being verified through one source of truth. It also leaves two versions of navigation, delays binding errors until a user action, and allows collection-specific data already copied into Redux to survive while another collection is loading or has failed. Synthetic profiles currently prove only parts of data independence and do not exercise the merged UI, ProductProfile, and runtime-binding contracts together.

Developer A needs to compose the delivered B, C, and I contracts into `useActiveCollection()`, prove that collection switches cannot leak USH data, and publish an accurate migration status for the next developers. The result must remain within the established ownership boundaries: A owns collection identity, source loading, assembly, and aggregate diagnostics; B owns the UI description and rendering; C owns configuration state and commands; I owns bindings and scene execution.

## Solution

Extend the collection manifest so a collection can declare its customization schema and runtime bindings as local sources. Load and validate those sources through the existing collection pipeline, then expose their source-shaped and consumer-ready forms from the active collection data.

The customization schema becomes the authoritative source for collection flows, steps, sections, and navigation. Existing consumers may continue to receive the legacy navigation shape during migration, but that shape is derived from or strictly checked against the customization schema rather than edited independently.

Cross-check the manifest, ProductProfile, customization schema, and runtime bindings before the collection reaches `ready`. Structural parse failures, collection identity mismatches, duplicate bindings, missing required bindings, missing mapped values, and missing product-type mappings block readiness with actionable diagnostics. Orphan bindings remain visible as warnings because they do not prevent a supported user action. Diagnostics retain their originating dataset and data path and are aggregated by the collection domain without duplicating the validators owned by B, C, or I.

Required runtime attributes are derived from collection data: all ProductProfile attributes, all customization fields, and the existing semantic attributes that C can send without a visible field. A does not add scene mappings or business rules. Runtime bindings require a ProductProfile so their option and product-type coverage can be checked before use.

Collection transitions must isolate state. While a newly selected collection is resolving, loading, or in error, consumers must not receive the previous collection as current. The narrow Redux bridge integration must clear or replace collection-derived state instead of retaining catalogs, defaults, or options from the previous collection. A owns the active-collection lifecycle contract; the bridge change is coordinated with C's state ownership and does not redesign configuration state.

Upgrade the two injected test profiles so each supplies a complete ProductProfile, customization schema, and runtime-binding set through the same loader used by USH. `fixture-ui` demonstrates an extra finish and UI field with a valid mapping. `fixture-rules` demonstrates changed product rules while retaining the shared application pipeline. Neither fixture enters the production registry or makes USH remote requests.

Finally, publish a versioned migration-status update that records the merged B/C/I foundations, the exact production consumers still using hardcoded USH data or direct scene calls, the owner of each remaining migration, and the evidence required to close A09. This PRD completes A07 and the Developer A portion of A08, and prepares A09 without claiming downstream acceptance work that remains owned by B, C, D, or I.

## User Stories

1. As a configurator visitor, I want the selected collection to provide its complete UI, product, and scene-mapping data as one unit, so that I do not see behavior assembled from different collections.
2. As a configurator visitor, I want an invalid collection package to fail before I interact with a field, so that a click cannot discover a missing scene mapping too late.
3. As a configurator visitor, I want navigation to match the steps defined for the active collection, so that labels, order, and destinations cannot drift between configuration files.
4. As a configurator visitor, I want a collection change to remove the previous collection's defaults and options immediately, so that USH data does not appear in another collection.
5. As a configurator visitor, I want an unknown or broken collection to remain an explicit error, so that the application does not silently continue with the last successful collection.
6. As a Developer B consumer, I want the validated customization schema available from the active collection, so that pages and components do not import a collection JSON file directly.
7. As a Developer B consumer, I want navigation derived from the same customization schema, so that there is one editable definition of the two flows.
8. As a Developer B consumer, I want invalid step, section, route, or control references rejected during collection loading, so that rendering receives a coherent schema.
9. As a Developer C consumer, I want ProductProfile identity checked against the manifest identity, so that rules and defaults belong to the active collection.
10. As a Developer C consumer, I want collection-derived Redux state cleared during collection transitions and errors, so that commands cannot read stale profile data.
11. As a Developer C consumer, I want the active collection to expose validated runtime bindings, so that command orchestration can use the same mapping set as scene execution.
12. As a Developer I consumer, I want runtime bindings loaded from the active collection manifest, so that the runtime adapter does not import USH mappings directly.
13. As a Developer I consumer, I want every UI and ProductProfile attribute to have a bound or explicitly unbound runtime entry, so that unsupported behavior is intentional and reviewable.
14. As a Developer I consumer, I want mapped ProductProfile values checked against scene patches, so that all selectable closed-catalog values have defined translations.
15. As a Developer I consumer, I want cabinet product types checked against runtime product-type mappings, so that placement does not discover a missing type at execution time.
16. As a downstream developer, I want one typed active-collection result containing customization and runtime contracts, so that feature code does not select files by collection ID.
17. As a downstream developer, I want both original validated source data and assembled catalog data available, so that failures can be diagnosed without reparsing assets.
18. As a downstream developer, I want warnings separated from blocking errors, so that unused mappings remain visible without preventing valid collection loading.
19. As a downstream developer, I want diagnostics to include a stable code, severity, dataset, path where available, and readable message, so that logs and future UI can present useful evidence.
20. As a collection maintainer, I want all local source paths declared in the manifest, so that adding or changing a dataset does not require an application-code import.
21. As a collection maintainer, I want collection IDs cross-checked across manifest, ProductProfile, customization, and bindings, so that copied files cannot be assigned to the wrong package unnoticed.
22. As a collection maintainer, I want missing optional datasets represented as absent, so that materially different collections are not forced to fabricate USH data.
23. As a collection maintainer, I want runtime bindings that are declared to require enough semantic data for validation, so that partial packages do not bypass contract checks.
24. As a collection maintainer, I want UI navigation to be generated or checked deterministically, so that the legacy navigation file cannot diverge silently.
25. As a test author, I want the USH package loaded through manifest references for UI and runtime bindings, so that tests exercise the production composition path.
26. As a test author, I want malformed customization input to fail with its originating path, so that fixture failures identify the broken entry.
27. As a test author, I want malformed runtime-binding input to fail with its originating path, so that fixture failures identify the broken mapping.
28. As a test author, I want identity mismatches between collection datasets rejected, so that accidental cross-collection copies are covered by regression tests.
29. As a test author, I want missing binding and missing mapped-value cases rejected before `ready`, so that the safety guarantee is executable.
30. As a test author, I want orphan bindings reported as warnings, so that safe migration leftovers are observable without becoming false blockers.
31. As a test author, I want a ready USH collection followed by loading or error to clear collection-derived Redux data, so that the real transition order is covered.
32. As a test author, I want switching to a collection without an optional catalog to remove the previous catalog, so that absence is not treated as permission to retain old data.
33. As a test author, I want `fixture-ui` to add `test-finish` and map `TestGrooveFinish` to `HandleGrooveColor`, so that a data-only UI difference reaches the runtime contract.
34. As a test author, I want `fixture-rules` to expose different rule inputs through its ProductProfile, so that rule independence is verified without production IDs.
35. As a test author, I want both synthetic profiles to avoid configurator and table requests for USH, so that source isolation is measurable.
36. As a project maintainer, I want production registry contents unchanged by synthetic fixtures, so that test IDs cannot be selected by users.
37. As a project maintainer, I want each independently merged issue to leave a demoable, tested path, so that reviewers can assess behavior in small commits.
38. As a project maintainer, I want the migration status updated after the integration, so that B, C, D, and I know which consumers remain and who owns them.
39. As Developer A, I want A07 acceptance tied to active-collection loading and diagnostics, so that scene execution and UI rendering work are not incorrectly claimed as complete.
40. As Developer A, I want A08 acceptance tied to complete synthetic collection packages, so that modularity is demonstrated with data differences rather than only type-level contracts.
41. As Developer A, I want A09 to distinguish implemented foundations from production consumer migrations, so that project status remains accurate.
42. As a reviewer, I want tests to prove public behavior through the loader, provider, and bridge seams, so that refactoring internal helpers does not invalidate useful tests.
43. As a reviewer, I want the current USH catalog counts, defaults, and remote IDs preserved, so that contract composition does not change established product behavior.
44. As a reviewer, I want no new collection-specific branching in the loader, so that the next real collection can use the same descriptor-driven path.
45. As a reviewer, I want the build, TypeScript checks, relevant tests, and changed-file linting to pass, so that each issue is safe to merge.

## Implementation Decisions

- The work is performed on a dedicated Developer A integration branch and committed once per approved issue.
- The collection manifest gains optional local references for a customization schema and runtime bindings.
- The production USH manifest declares both existing assets; direct JSON imports remain only in tests specifically testing the owning parser in isolation.
- The loaded collection contract exposes customization and runtime bindings in both local sources and the assembled catalog.
- The customization schema is the authoritative source for flows, step order, labels, sections, and routes.
- The legacy navigation catalog remains a compatibility result during migration and is derived from the customization schema or rejected when an independently supplied legacy file differs.
- Pure customization parsing and validation must be callable from the collection domain without an entity-to-feature dependency. Existing feature exports remain compatible for Developer B.
- Existing ProductProfile and runtime-binding parsers remain owned by C and I. Developer A composes their results and does not create competing schemas.
- Dataset identity is checked against the resolved manifest identity for ProductProfile, customization, and runtime bindings.
- Runtime binding validation receives the union of ProductProfile attributes, customization-field attributes, and the established nonvisual semantic command attributes.
- A runtime-bindings source requires a valid ProductProfile. Customization may load without bindings for a collection that has no scene-changing fields, but declared bindings never bypass semantic validation.
- Structural and cross-contract failures prevent the collection from reaching `ready` and use the existing collection error channel.
- Aggregate diagnostics use stable code, severity, dataset, optional data path, and message fields. Original validator diagnostics remain available as causes for debugging.
- Runtime collection mismatches, duplicate bindings, missing bindings, missing mapped values, and missing product types are errors. Orphan bindings are warnings.
- Warnings are returned with ready collection data. They do not require a user-facing warning interface in this scope.
- Source loading remains parallel where inputs are independent. Cross-source validation runs after the required inputs have loaded.
- Active-collection state remains the authority for collection lifecycle. A prior ready result is not current during a later resolving, loading, or error state.
- The Redux bridge is adjusted only enough to clear or replace collection-derived data at lifecycle boundaries. Configuration command design and Redux ownership remain with Developer C.
- A collection that omits an optional catalog clears the prior catalog instead of retaining it.
- Profile initialization for a newly ready collection cannot merge omitted values over a previous collection's product options.
- `fixture-ui` and `fixture-rules` are injected test collections with complete local contracts and no production-registry entries.
- `fixture-ui` contains the specified extra finish and valid runtime translation. `fixture-rules` contains changed rule data and the mappings required by its declared UI.
- Existing USH remote IDs, defaults, preset identity, preset counts, and normalized catalog behavior are preserved.
- The migration status is versioned rather than rewriting historical v1 evidence. It records merged foundations, remaining consumers, owners, and verification state.
- Production page migration, command wiring, runtime execution wiring, pricing integration, and real Mako/Class onboarding remain owned by their assigned developers.

## Testing Decisions

- Tests assert observable contracts: manifest acceptance, requested source URLs, loader output, diagnostics, active lifecycle state, Redux-visible collection isolation, and fixture behavior. They do not assert private helper calls.
- Unit tests cover manifest parsing, customization parsing, navigation derivation or parity checks, runtime parser composition, cross-dataset identity checks, required-attribute collection, issue severity mapping, and aggregate diagnostics.
- Collection-loader integration tests load the USH local contract from manifest references and assert customization, runtime bindings, compatibility navigation, and warnings in the assembled result.
- Negative loader tests cover missing files, invalid schemas, wrong collection IDs, missing ProductProfile for declared bindings, missing required bindings, missing mapped values, duplicate bindings, and missing product-type mappings.
- Provider tests retain existing stale-request coverage and add assertions that a previous ready collection is not exposed as current after URL identity changes.
- Bridge integration tests start from a populated USH store, then exercise resolving, loading, error, and a ready collection with omitted optional sources. The observed Redux state must contain no retained USH profile, defaults, options, or catalog.
- `fixture-ui` tests verify the extra field and option are returned through active collection data, the runtime mapping resolves to the expected scene key, and no USH remote source is requested.
- `fixture-rules` tests verify its changed rule inputs are returned through ProductProfile and no USH catalog or defaults leak into the result.
- Production-registry tests assert that synthetic fixture IDs remain absent.
- USH regression tests preserve 54 presets, 123 ordered products, default preset identity, confirmed defaults, and remote source IDs.
- Existing parser tests in the customization and runtime-binding modules remain prior art for detailed diagnostic cases; new composition tests focus on behavior across module boundaries.
- Each issue runs its directly relevant tests plus TypeScript validation and linting for changed files. The complete test suite and production build run before the final status issue is committed.
- Repository-wide lint output is recorded accurately. Existing unrelated lint failures do not authorize new failures in changed files and do not get silently reported as a passing full lint run.
- A browser smoke scenario is documented for downstream integration: active collection → UI field → validated change → runtime port → configuration state → Save payload. Completing production UI/runtime wiring remains a shared B/C/I acceptance task.

## Out of Scope

- Migrating production pages, static step arrays, preset rendering, or navigation components owned by Developer B.
- Implementing collection-driven field rendering or a new user-facing diagnostics screen.
- Changing product compatibility rules, preview/confirm/cancel behavior, Save payload semantics, Share, or restore orchestration owned by Developer C.
- Replacing all direct PlayCanvas calls or implementing runtime execution and scene-readback work owned by Developer I.
- Changing SKU generation, price calculation, or Summary price presentation owned by Developer D.
- Adding new runtime mappings that are absent from the delivered I contract.
- Defining new business attributes or ProductProfile semantics without confirmed product data.
- Adding the future UI DataTable source before its ID and row format are confirmed.
- Registering Mako or Class in production or inventing their missing API IDs, defaults, presets, palettes, runtime values, or pricing data.
- Removing legacy navigation consumers before Developer B migrates them.
- Resolving all repository-wide pre-existing lint failures.
- Claiming A09, B10, C12, I06, or D03 complete without their required downstream evidence.

## Further Notes

- The architectural direction remains consistent with the review repository: A provides collection data, B renders collection-defined UI, C validates and owns configuration state, I translates changes to the scene, and D calculates price.
- The immediate project risk is incomplete composition. UI, ProductProfile, runtime bindings, and runtime port exist, but production consumers cannot yet obtain all of them from one active-collection result.
- The source-authority policy for this scope is: manifest for source locations and remote IDs; ProductProfile for semantic product data and defaults owned by C; customization schema for layout and navigation; runtime bindings for semantic-to-scene translation.
- Overlapping legacy datasets may remain during migration, but their parity must be checked and their intended replacement documented. No new independently edited duplicate should be introduced.
- The existing ProductProfile draft label is preserved by this work. Product acceptance of that contract is a separate governance decision; the loader still validates the delivered shape before exposing it.
- The historical collection-data migration status v1 remains available as the baseline. The new status document records changes since the B, C, and I merges and links back to v1.
- Full modularity is demonstrated only when a synthetic collection difference travels through the same public contract without an USH fallback. Production completion additionally requires the B/C/I consumer migrations and their browser acceptance evidence.
