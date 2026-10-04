## What to build

Upgrade the injected `fixture-ui` collection into a complete local collection package that travels through the same manifest, ProductProfile, customization, runtime-binding, provider, and state-isolation path as USH. Its additional `test-finish` option and `TestGrooveFinish` field must resolve to the expected `HandleGrooveColor` scene patch without loading any USH remote source.

## Acceptance criteria

- [x] `fixture-ui` provides a manifest, ProductProfile, customization schema, and runtime bindings through test injection.
- [x] Its customization schema exposes the additional test finish field and option through active collection data.
- [x] Its runtime binding resolves `TestGrooveFinish` to the expected `HandleGrooveColor` scene key or patch.
- [x] Loading and switching to the fixture does not retain USH defaults, catalogs, options, or diagnostics.
- [x] Loading the fixture makes no configurator or DataTable request using USH IDs.
- [x] The synthetic fixture remains absent from the production registry.
- [x] Relevant tests, TypeScript validation, and changed-file linting pass.

## Blocked by

- Blocked by #plans/developer-a-active-collection-integration/02-load-runtime-bindings-and-diagnostics.issue.md
- Blocked by #plans/developer-a-active-collection-integration/03-isolate-collection-state-transitions.issue.md
