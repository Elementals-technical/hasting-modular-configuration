# Active collection readiness gate and consumer contract

## Problem Statement

The configurator has one active-collection loader, but every consumer still receives the full `resolving` / `loading` / `ready` / `error` lifecycle union. Pages, navigation helpers, restore integration, Redux bridges, and PlayCanvas integration therefore repeat readiness checks before reading collection data. This spreads lifecycle policy throughout the application, encourages inconsistent fallbacks, and allows large parts of the configurator shell to mount before the collection required by that session is usable.

The repeated checks also weaken the intended contract. A component can silently return an empty list or `undefined` while collection loading has actually failed, so the user sees an incomplete configurator instead of a controlled error. A collection may be structurally ready while lacking the configurator catalog required by this product shell. There is no single boundary that distinguishes a generally valid collection package from a collection that can run this configurator.

Collection identity has also been treated as a reactive URL input. The actual product rule is stricter: a collection is selected once when a configurator session starts and cannot change while that session is running. Allowing the provider to react to arbitrary search-string changes creates unnecessary reloads and risks a mismatch between URL identity, Redux state, runtime bindings, and the PlayCanvas scene.

Developers need a ready-only active-collection API that is safe to use without local lifecycle checks. Users need a full-screen loading state while the initial collection is resolving, a controlled recovery screen when loading fails, and protection from accidentally running one collection under another collection's URL.

## Solution

Introduce a configurator-level collection readiness gate. The gate is the only product boundary that converts the collection loader lifecycle into loading, ready, or error UI. It fully replaces the configurator shell until the initial collection is loaded, validated, and contains the configurator catalog required by the shell. The Home shell, Player, sidebars, flow pages, and their requests do not mount before this condition is satisfied.

Separate lifecycle access from ready-data access. Infrastructure code uses a state-oriented hook to observe resolution, loading, ready, and error states. Product consumers use `useActiveCollection`, which is only valid beneath the readiness gate and returns ready collection data rather than a lifecycle union. The hook supports an optional typed selector so consumers can request a nested catalog directly. Calling it outside the ready-data provider is treated as an application composition error.

Keep remote source declarations optional in the general manifest contract. A package can remain valid without a configurator source for tests or a materially different product. The configurator shell adds its own capability requirement and exposes a refined ready type in which the configurator catalog is guaranteed. Other catalogs remain optional unless their own feature contract requires them. A declared source that fails to load remains a collection loading error; an undeclared optional source is not fabricated.

Treat collection identity as immutable session input. The provider captures the initial presence and value of `collectionId` when the configurator shell mounts. Changes to unrelated query parameters do not reload collection data. Any client-side appearance, removal, or value change of `collectionId` after startup blocks the shell with a controlled session-identity error. Restarting with another identity requires full-page navigation and therefore creates a new configurator session.

Provide full-screen recovery UI. Retry reruns the complete collection pipeline for the same captured session identity without reloading the page. When an explicit non-default collection failed and the registry is available, the user may start a new session with the registry default; this performs full-page navigation to the same route and query string with only `collectionId` removed. A session-identity mismatch offers a full-page restart using the current URL. Technical causes remain available for diagnostics but are not rendered as raw API responses, stack traces, or exception objects.

Apply the provider and readiness gate only to the Prebuilt and Custom configurator routes. Restore must remain able to load saved metadata and determine the collection before entering the gated shell. AR download remains independent of collection data. Lifecycle bridges continue to observe raw state so they can clear Redux collection data and runtime caches whenever ready data is unavailable; all ordinary production consumers migrate to the ready-only hook.

## User Stories

1. As a configurator visitor, I want to see a clear loading screen while my collection is being prepared, so that I do not interact with a partially initialized configurator.
2. As a configurator visitor, I want the Player, sidebars, and flow pages to appear only after collection data is ready, so that they cannot issue requests or render options against incomplete data.
3. As a configurator visitor, I want a controlled error screen when collection resolution fails, so that a broken or unknown collection does not look like an empty configurator.
4. As a configurator visitor, I want a controlled error when the selected collection lacks the configurator catalog required by this application, so that unsupported packages cannot open an unusable shell.
5. As a configurator visitor, I want to retry a transient failure without reloading the browser page, so that I can recover without losing the current entry URL.
6. As a configurator visitor, I want retry to use the same collection identity, so that recovery cannot silently change the product family.
7. As a configurator visitor, I want retry to ignore stale responses from earlier attempts, so that a slower request cannot replace the latest result.
8. As a configurator visitor with an invalid explicit collection, I want an option to open the registry default collection, so that I have an intentional recovery path.
9. As a configurator visitor, I want opening the default collection from an error to start a fresh browser session, so that no state from the failed identity survives.
10. As a configurator visitor, I want the default-collection action to preserve the current route and unrelated query parameters, so that recovery retains relevant launch context.
11. As a configurator visitor already using the default collection, I do not want a recovery action that simply repeats the same failing navigation, so that the error UI remains meaningful.
12. As a configurator visitor, I want safe error copy rather than raw technical details, so that internal responses and stack traces are not exposed.
13. As a configurator visitor, I want the requested collection ID or label visible in useful error copy, so that I can identify which launch failed.
14. As a configurator visitor, I want a collection to remain fixed for the lifetime of my configurator session, so that all state and scene behavior belong to one product family.
15. As a configurator visitor, I want an accidental client-side collection-ID change to block the configurator, so that the URL cannot claim a different collection from the loaded data.
16. As a configurator visitor, I want a restart action after a session-identity mismatch, so that I can intentionally start a fresh session from the current URL.
17. As a configurator visitor, I want changes to configuration, host, preset, or other query parameters to leave the active collection loaded, so that ordinary navigation does not restart the application.
18. As a visitor restoring a saved configuration, I want restore routing to resolve saved metadata before entering the collection gate, so that the saved collection chooses the session.
19. As an AR download visitor, I want downloads to remain independent of collection loading, so that collection API availability cannot block the file redirect.
20. As a frontend developer, I want one readiness gate to own product loading and error behavior, so that pages do not invent local lifecycle fallbacks.
21. As a frontend developer, I want `useActiveCollection` to return ready collection data, so that normal consumers do not repeat status checks.
22. As a frontend developer, I want `useActiveCollection` to accept a typed selector, so that a consumer can obtain one nested catalog with concise and inferred types.
23. As a frontend developer, I want an unselected `useActiveCollection` call to return the complete ready collection, so that consumers needing several datasets still have a simple API.
24. As a frontend developer, I want a clear invariant failure when the ready-only hook is used outside its provider, so that composition mistakes are detected during development.
25. As an infrastructure developer, I want a separate lifecycle-state hook, so that the gate and bridges can respond to loading and errors without exposing that burden to product components.
26. As a TypeScript consumer, I want the ready-shell collection type to guarantee the configurator catalog, so that I do not replace status checks with `undefined` checks.
27. As a collection maintainer, I want configurator sources to remain optional in the general manifest schema, so that test and non-configurator collection packages remain valid.
28. As a collection maintainer, I want every declared source to load and validate before general collection readiness, so that the gate never receives fabricated source data.
29. As a collection maintainer, I want optional presets, profiles, runtime bindings, cabinet catalogs, and countertop catalogs to remain representable as absent, so that partial packages are not forced to invent data.
30. As a Redux consumer, I want collection-derived state cleared whenever ready collection data is unavailable, so that commands cannot read stale data after a failure or teardown.
31. As a runtime consumer, I want active bindings cleared whenever ready collection data is unavailable, so that scene operations cannot use mappings from an unavailable session.
32. As a UI developer, I want collection navigation and customization hooks to receive ready data, so that loading errors cannot be mistaken for empty navigation.
33. As a restore developer, I want restore integration to consume the ready collection without implementing its own lifecycle fallback, so that restore starts only after the gate opens.
34. As a PlayCanvas developer, I want integration components to consume ready collection data, so that scene setup cannot start against a resolving package.
35. As a project maintainer, I want production consumers migrated away from active-collection status checks, so that the new boundary is applied consistently.
36. As a project maintainer, I want lifecycle checks to remain only in the gate, lifecycle bridges, provider internals, and infrastructure tests, so that legitimate state handling is not removed mechanically.
37. As a project maintainer, I want every implementation issue to leave the branch buildable and testable, so that the work can be reviewed through separate commits.
38. As a project maintainer, I want existing manifest fixtures without remote sources to keep proving optional-source behavior, so that shell requirements do not leak into the data foundation.
39. As a test author, I want loading and error tests to prove that configurator children are not mounted, so that the gate's user-visible guarantee is executable.
40. As a test author, I want selector tests to verify full-data and selected-data behavior, so that the public hook contract is protected.
41. As a test author, I want retry tests to prove that the same identity is retried and stale attempts cannot win, so that recovery is deterministic.
42. As a test author, I want route tests to prove that restore and AR download bypass the gate, so that unrelated flows remain available.
43. As a test author, I want session tests to distinguish explicit identity, implicit default identity, and changed identity, so that the fixed-session rule is unambiguous.
44. As a reviewer, I want unknown collection, remote failure, missing configurator capability, and session mismatch to produce distinct controlled outcomes, so that failures can be diagnosed accurately.
45. As a reviewer, I want default USH, Urban Low Height, and Class to pass browser smoke checks through the same gate, so that the change works for all registered production collections.

## Implementation Decisions

- This PRD supersedes the earlier decisions that the collection provider must always expose product children and reactively switch collections after client-side URL changes. It does not replace the loader, validation, optional-source, registry, or collection-package contracts established by earlier PRDs.
- The active collection is immutable session input. The initial presence and raw value of the collection query parameter are captured when the gated configurator session mounts.
- Explicit, implicit-default, empty, and invalid collection identities remain distinct. Internal navigation must preserve the initial identity representation, not merely resolve to the same effective collection.
- A client-side appearance, disappearance, or value change of the collection query parameter after session start is a blocking session-identity error. The application does not hot-switch collection data.
- Starting another collection session uses full-page navigation. This applies to the default-collection recovery action and the restart action after an identity mismatch.
- Retry is not a new session. It reruns registry resolution, manifest loading, declared local sources, declared remote sources, validation, normalization, and assembly for the captured identity without full-page reload.
- Retry cancels or supersedes the previous attempt, disables duplicate submission while loading, and preserves stale-response protection.
- The provider's load cycle depends on captured identity and an explicit retry trigger. It does not depend on the entire location search string.
- Lifecycle state and ready collection data are exposed through separate contexts and hooks.
- The lifecycle hook returns the resolving, loading, ready, or error state for infrastructure consumers.
- The ready-data hook returns a refined loaded-collection result and accepts an optional generic selector. Selector support is an ergonomic typed access API and does not claim independent context-selector render optimization.
- Calling the ready-data hook outside the ready provider throws a descriptive invariant error.
- The general loaded-collection type continues to model optional sources. A shell-specific refined type guarantees the configurator catalog after the readiness capability check.
- The general manifest schema continues to allow an absent remote configurator reference. The shell capability check does not mutate the manifest or introduce a duplicate capability flag.
- The shell requires only the configurator catalog globally. Other catalogs remain optional, and feature-specific availability continues to follow their owning contracts.
- Failure of an explicitly declared source remains a collection error. Absence of an optional undeclared source is not itself a loader error.
- The full-screen gate replaces the complete configurator shell during resolving, loading, and errors. Player, navigation, pages, and page-level requests are not mounted behind it.
- Loading UI uses the application's visual language and communicates that collection data is loading. No artificial minimum loading duration is required.
- Error UI maps known failure classes to safe user-facing messages. Raw causes, stack traces, payloads, and internal response bodies are excluded from rendered output.
- Retry is available for recoverable loading failures. The default-collection action is available only when a known registry default differs from the explicit requested identity. A registry-loading failure cannot offer an unknown default.
- The default-collection action preserves the current pathname and all query parameters except the collection identity.
- A session-identity mismatch offers a restart action that performs full-page navigation using the current URL.
- The collection provider, readiness gate, and ready-data provider wrap only the Prebuilt and Custom configurator route trees.
- Restore and AR download routes remain outside the collection provider and gate. Restore enters the gated tree only after determining its destination and saved collection identity.
- Redux and runtime lifecycle bridges remain mounted where they can observe raw lifecycle state. They clear their published collection data and caches whenever ready data is unavailable and publish only the current ready result.
- Production pages, navigation hooks, customization hooks, restore consumers, and PlayCanvas consumers migrate to ready-only access. Unrelated status unions such as scene readiness are not part of this migration.
- Infrastructure state checks remain explicit in the provider, readiness gate, Redux bridge, runtime bridge, and their tests.
- The public API migration is staged so each issue can be committed with a passing TypeScript build. Temporary compatibility exports may exist between issues but must be removed in the final integration slice.
- Work is divided by the established A, B, C, and I ownership boundaries for review clarity, although the current implementation effort will complete every approved issue on the same feature branch.
- The migration status documentation is updated after consumer migration to describe the new ready-only contract and remaining unrelated collection work.

## Testing Decisions

- Tests assert visible lifecycle and public-hook behavior rather than private context structure or helper call order.
- Provider tests cover initial implicit identity, initial explicit identity, unknown and empty identity, successful readiness, source failure, retry, cancellation, and stale-response protection.
- Retry tests prove that the captured identity remains unchanged and that a later attempt wins over an earlier unresolved attempt.
- Gate tests assert that configurator children are absent during resolving, loading, collection errors, and missing-configurator capability errors, then appear only with refined ready data.
- Error-state tests cover safe messages and the availability of Retry, Open default collection, and Restart configurator for their respective conditions.
- Navigation tests verify that Open default collection and Restart configurator use full-page navigation with the required query preservation policy.
- Session identity tests cover adding, removing, emptying, and changing the collection query parameter after startup, including the difference between an implicit default session and an explicit default identity.
- Query stability tests prove that unrelated search-parameter changes do not rerun collection loading or unmount the ready shell.
- Hook tests cover no-selector access, selector access, inferred selected values, optional non-shell catalogs, guaranteed configurator access, and the outside-provider invariant.
- Router tests prove that the Prebuilt and Custom trees are gated while Restore and AR download can mount without collection readiness.
- Bridge tests begin with published collection data and verify cleanup during initial failure, retry loading, gate teardown, and provider unmount, with no retained profile, cabinet catalog, active ID, or runtime bindings.
- Consumer tests are updated to provide ready collection data rather than fabricating lifecycle branches when the component does not own lifecycle behavior.
- Existing fixture tests without remote sources continue to pass against the general loader contract and are not forced through the product shell gate.
- A repository search verifies that production consumers no longer inspect active-collection status outside the approved infrastructure boundary.
- Each issue runs its focused tests, TypeScript validation, and linting. Repository-wide TypeScript and lint commands run as required by the implementation workflow; unrelated pre-existing failures are reported accurately and no new changed-file failures are accepted.
- The final integration runs the complete relevant test suite and production build.
- Manual browser smoke checks cover implicit default USH, explicit USH, Urban Low Height, Class, unknown identity, declared-source failure, Retry, Open default collection, and a simulated client-side identity mismatch.

## Out of Scope

- Adding an in-application collection selector or supporting hot collection switching.
- Confirming unsaved changes before switching collections, because collection switching is not a supported session action.
- Making configurator, DataTable, ProductProfile, presets, runtime bindings, or any other source globally mandatory in the base manifest schema.
- Inventing missing presets, defaults, ProductProfile data, runtime bindings, SKU mappings, or pricing data for partial collection packages.
- Adding capability flags that duplicate source presence.
- Changing product rules, configuration command semantics, Save payloads, pricing calculations, scene mappings, or PlayCanvas execution behavior.
- Redesigning Restore or AR download behavior beyond moving them outside the collection gate.
- Providing field-level or route-level capability gates for every optional catalog.
- Introducing a context-selector dependency or promising fine-grained render suppression from the selector overload.
- Automatically falling back from a broken known collection to the default collection without an explicit user action.
- Displaying raw diagnostics, API payloads, stack traces, or exception causes in the user interface.
- Refactoring unrelated loading indicators, error pages, router structure, or existing repository-wide lint failures.

## Further Notes

- This work intentionally moves product lifecycle policy from every consumer to one composition boundary. The general collection domain remains capable of loading partial and test packages outside that shell.
- A collection can be valid according to its manifest and still be unsuitable for this configurator shell. The refined ready type represents suitability only after the gate's capability check.
- The fixed-session rule aligns URL identity, loaded catalogs, Redux state, runtime bindings, and the PlayCanvas scene. Treating identity changes as an error is safer than either silently ignoring the URL or attempting a partial hot switch.
- Explicit user recovery to the default collection is not silent fallback. It starts a new session and makes the identity decision visible through navigation.
- The selector form is intended to support concise calls such as selecting the configurator catalog while retaining a full-data form for multi-catalog consumers.
- The final migration should leave collection lifecycle knowledge in a small infrastructure surface. Product consumers should reason about ready collection content and feature-specific optional data, not loader states.
