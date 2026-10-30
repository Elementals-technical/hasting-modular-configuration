## What to build

Establish the successful end-to-end startup path for one immutable configurator session. Capture the initial collection identity once, load it independently of unrelated query-string changes, withhold the configurator shell while loading, and expose the successful result through separate lifecycle and ready-data APIs. The ready-data API must support both full collection access and a typed selector while guaranteeing the configurator catalog required by the shell.

## Acceptance criteria

- [x] The configurator session captures the initial presence and value of `collectionId` and does not reload when unrelated query parameters change.
- [x] Infrastructure can observe the complete collection lifecycle through a state-oriented hook.
- [x] A successful collection with a configurator catalog is published through a ready-only provider beneath the readiness gate.
- [x] The configurator shell and its children do not mount during resolving or loading.
- [x] Ready consumers can obtain either the complete refined collection or a typed selected value.
- [x] The refined ready type guarantees the configurator catalog while other optional catalogs remain optional.
- [x] Calling the ready-only hook outside its provider produces a descriptive invariant error.
- [x] The general manifest schema and source-free test fixtures remain valid.
- [x] Focused tests, TypeScript validation, and linting pass.

## Blocked by

None - can start immediately
