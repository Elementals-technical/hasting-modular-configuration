## What to build

Make collection lifecycle transitions isolate collection-derived configuration state. Starting from a populated collection, resolving or loading another collection, receiving an error, or reaching a collection without an optional catalog must remove the previous collection's profile, defaults, options, and normalized catalog instead of retaining them. Keep the change limited to the active-collection/Redux bridge contract owned jointly by A and C.

## Acceptance criteria

- [ ] A previous ready collection is not treated as current during a later resolving, loading, or error state.
- [ ] The Redux bridge clears the active collection identity, ProductProfile-derived state, and cabinet catalog when active collection data is unavailable.
- [ ] A newly ready collection replaces collection-derived defaults and options rather than merging them over values from the previous collection.
- [ ] A ready collection without an optional cabinet catalog clears the previous cabinet catalog.
- [ ] Regression tests begin with populated USH state and cover ready-to-loading, ready-to-error, and ready-to-collection-with-omitted-source transitions.
- [ ] Configuration commands and Save/restore semantics remain unchanged.
- [ ] Relevant tests, TypeScript validation, and changed-file linting pass.

## Blocked by

- Blocked by #plans/developer-a-active-collection-integration/01-load-customization-contract.issue.md

