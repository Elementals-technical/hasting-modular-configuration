# Collection-driven configurator and countertop consumers

## Problem Statement

The active-collection loader already resolves the manifest, loads the declared configurator and DataTable sources, validates them, and publishes normalized catalogs before the configurator shell mounts. Despite that boundary, fifteen production consumers still call the configurator endpoint with hardcoded ID `4`, and four of those consumers also call countertop DataTable `438` directly. A legacy cabinet-matrix fallback also embeds `439` even though source identity belongs to the collection manifest.

These duplicate calls preserve Urban Standard Height assumptions inside pages, summaries, shared hooks, PlayCanvas integration, and cross-cutting UI. They bypass the collection contract, make a component appear collection-aware while it still reads global data, and prevent a future collection from declaring different remote source IDs. They also expose request loading states beneath a readiness gate that has already finished loading the same data.

Developers need one source of truth for collection-owned remote data. Product consumers should read the ready active collection, shared transformations should accept normalized collection catalogs, and repository checks should prevent the known hardcoded IDs and direct collection-source query hooks from returning to production code.

## Solution

Migrate every production consumer of the hardcoded configurator request to the ready active-collection catalog. Components that need configurator option groups select `catalog.configurator.groups` through `useActiveCollection`. The shell readiness contract already guarantees this catalog, so consumers do not add loading, undefined, or lifecycle fallbacks.

Migrate direct countertop DataTable consumers to the normalized `catalog.countertops` contract through the existing collection countertop-rule hook. The countertop catalog remains optional in the general collection model; consumers preserve their existing empty-rule behavior when a collection does not declare that feature. A declared countertop source still has to load and validate before the collection becomes ready.

Change shared configurator transformations to consume option groups rather than the raw endpoint envelope. This keeps raw API response ownership inside the collection loader and gives pages, summary, swatch, pricing, and SKU resolution a stable catalog-facing interface. Preserve product behavior, filtering, SKU selection, configuration commands, save payloads, and PlayCanvas execution semantics.

Remove the remaining literal cabinet DataTable ID from the legacy matrix fallback. The fallback needs only column mappings; source identity continues to come from the manifest or ProductProfile and is not invented by parser code.

Add focused behavior tests around group-based adapters and collection selectors, update affected component tests to provide ready collection data, and add a repository-level architectural guard that rejects production use of the collection-owned direct query hooks and the known IDs. Finish with full TypeScript, test, lint, build, and browser verification for all registered collections, then publish the next migration-status handoff.

## User Stories

1. As a configurator visitor, I want every screen to use the collection selected at session startup, so that options cannot come from another collection.
2. As a configurator visitor, I want Model options to use the active collection catalog, so that preset initialization resolves collection-specific SKUs.
3. As a configurator visitor, I want Cabinet colors and handle finishes to use the active collection catalog, so that unavailable options are not borrowed from USH.
4. As a configurator visitor, I want Countertop colors, materials, and constraints to use active collection data, so that the UI and rules agree.
5. As a configurator visitor, I want Accessories and faucet-related options to use active collection data, so that later collections can supply different catalogs.
6. As a configurator visitor, I want Summary values and swatches to use the same catalog as the configuration flow, so that review data matches earlier choices.
7. As a configurator visitor, I want price inputs to derive from the active collection catalog, so that SKU candidates do not come from a global configurator.
8. As a configurator visitor, I want PlayCanvas-supporting lookups to use active collection data, so that scene decisions cannot depend on a hardcoded catalog.
9. As a configurator visitor, I want collection data loaded once at startup, so that pages do not repeat the same remote requests.
10. As a configurator visitor, I want the collection loading screen to remain the only loading boundary for required configurator data, so that page content does not flash a second loading state.
11. As a configurator visitor, I want a declared source failure to stop at the readiness gate, so that a page never silently fetches a global fallback.
12. As a configurator visitor, I want an undeclared optional countertop source to remain absent, so that the application does not fabricate DataTable `438` for another product.
13. As a frontend developer, I want configurator groups available through `useActiveCollection`, so that I do not import the configurator API hook in product components.
14. As a frontend developer, I want countertop rules available through the collection hook contract, so that I do not know a DataTable ID.
15. As a frontend developer, I want shared helpers to accept normalized group data, so that they do not depend on an API response envelope.
16. As a frontend developer, I want ready consumers to avoid request-state checks, so that loading policy remains centralized.
17. As a frontend developer, I want summary and pricing code to share the same catalog shape as pages, so that collection behavior is consistent across flows.
18. As a collection maintainer, I want remote source IDs declared only in collection data, so that changing an ID does not require a source-code search.
19. As a collection maintainer, I want different collections to be able to declare different configurator and countertop IDs, so that collection packages remain independent.
20. As a collection maintainer, I want optional catalogs to stay optional in the base manifest, so that test and non-countertop packages remain valid.
21. As a collection maintainer, I want a missing declared source to remain a blocking load error, so that incomplete remote data cannot reach consumers.
22. As a rule developer, I want countertop consumers to use the loader's normalized rules, so that parsing is performed once and has one contract.
23. As a rule developer, I want cabinet fallback mappings to contain mappings rather than a fake source ID, so that parser metadata does not claim manifest ownership.
24. As a PlayCanvas developer, I want the integration to receive option groups from ready collection data, so that it cannot start with the wrong remote payload.
25. As a pricing developer, I want collection option metadata to feed SKU lookup without a second query, so that price calculations use session-consistent data.
26. As a test author, I want adapters tested against normalized groups, so that endpoint-envelope removal does not change filtering behavior.
27. As a test author, I want consumers tested with ready collection providers, so that tests represent production composition.
28. As a project maintainer, I want a source scan to fail when Configurator `4`, DataTable `438`, DataTable `439`, or the collection-owned direct query hooks return to production consumers.
29. As a project maintainer, I want every migration slice to remain buildable and reviewable, so that regressions are isolated by commit.
30. As a reviewer, I want browser evidence for USH, Urban Low Height, and Class, so that removing page queries does not break registered collections.
31. As a reviewer, I want unknown collection and immutable-session behavior to remain unchanged, so that data-consumer migration does not weaken readiness guarantees.
32. As a reviewer, I want the migration handoff to distinguish catalog consumption from remaining product completeness work, so that missing profiles, bindings, SKU mappings, and pricing are still visible.

## Implementation Decisions

- The ready active-collection provider remains the only production source for collection-owned configurator, countertop, and cabinet remote data beneath the configurator shell.
- Product consumers select configurator option groups from the guaranteed configurator catalog through the ready-data hook.
- Product consumers do not read raw remote collection sources when an equivalent normalized catalog exists.
- Shared configurator transformations accept normalized option groups as their public input. Raw endpoint envelopes remain internal to the loader and API layer.
- Countertop pages and helpers consume the normalized countertop-rule catalog. They do not parse the raw DataTable in each component.
- The existing countertop-rule hook remains the concise access point for optional countertop rules and preserves an empty list for an absent optional catalog.
- Required configurator request-loading flags are removed from gated pages because required remote loading completes before those pages mount.
- No component starts a fallback request when an optional collection catalog is absent.
- Configurator option metadata, variant visibility, SKU candidates, swatch mapping, and material normalization retain their current behavior.
- Summary, pricing, Player, sidebars, swatch ordering, and both flow families migrate within the same effort.
- The cabinet matrix fallback retains legacy column mappings needed by partial collections, but no longer carries a hardcoded DataTable identity that its parser does not use.
- ProductProfile remains the authoritative source for collection-specific legacy cabinet mapping when present.
- The manifest schemas, registry identities, readiness gate, immutable session contract, runtime commands, Save payloads, and pricing endpoint contracts do not change.
- An architectural source guard covers production directories and allows direct query hooks only inside the collection remote loader and their API definitions/tests.
- The migration-status document is advanced after implementation and links back to earlier versions.
- Work is committed as sequential vertical slices after a planning commit on the dedicated feature branch.

## Testing Decisions

- Tests verify observable catalog behavior, option mapping, rule selection, rendered states, and absence of duplicate requests rather than implementation call order.
- Shared adapter tests pass normalized configurator groups and verify material filtering, labels, values, metadata, SKU candidates, and synthetic countertop options.
- Countertop behavior tests use normalized collection rules and cover an absent optional catalog.
- A ready collection test provider supplies configurator groups and countertop rules to affected component tests.
- Existing page tests are updated where mocks currently replace direct API hooks.
- Loader tests continue to prove that manifest-declared IDs drive remote requests and that normalized catalogs are assembled once.
- A repository-level source test scans production TypeScript for hardcoded collection source IDs and prohibited direct collection-source query hooks, with explicit infrastructure exclusions.
- The source guard distinguishes collection-owned source IDs from unrelated numeric values and from generic API definitions that legitimately accept dynamic IDs.
- Focused tests and TypeScript validation run after every issue.
- Changed-file linting must introduce no new errors. Repository-wide baseline failures are recorded accurately.
- The final suite includes all Vitest tests and the production build on Node 22.18 or a compatible newer version.
- Browser smoke covers implicit and explicit USH, Urban Low Height, Class, unknown collection recovery, and session identity mismatch.
- Browser network inspection or an executable equivalent verifies that migrated pages do not initiate their own hardcoded configurator or countertop requests after the gate opens.

## Out of Scope

- Changing the data or IDs currently declared by registered collection manifests.
- Adding missing ProductProfile, presets, runtime bindings, cabinet SKU mappings, or collection-specific pricing to Urban Low Height or Class.
- Making countertop data mandatory in the general manifest or shell readiness type.
- Reworking product rules, confirmation flows, runtime bindings, PlayCanvas commands, Save payload semantics, or price-service APIs.
- Removing the generic configurator and DataTable RTK Query endpoints; the collection loader still uses them with manifest-owned references.
- Redesigning countertop, cabinet, accessories, faucet, summary, swatch, or pricing user interfaces.
- Introducing hot collection switching or changing immutable session identity behavior.
- Resolving unrelated repository-wide lint debt.

## Further Notes

- The current three production manifests intentionally point to the same remote IDs. The migration is still required because shared values today do not guarantee shared values for future collections.
- `catalog.configurator` is a normalized group catalog rather than the original API envelope. Consumers should depend on its semantic data, not reconstruct the envelope.
- `catalog.countertops` is already parsed during collection loading. Parsing DataTable rows again inside pages would create two rule contracts and is removed.
- Data readiness and feature completeness remain separate. Passing the readiness gate proves that the shell's required configurator data exists; it does not prove that every optional collection capability has production content.
