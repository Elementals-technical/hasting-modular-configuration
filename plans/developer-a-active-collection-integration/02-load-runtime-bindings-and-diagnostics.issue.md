## What to build

Load runtime bindings through the collection manifest, compose their existing parser and validator with ProductProfile and customization data, and expose the validated set from the active collection. Convert structural and cross-contract findings into collection diagnostics with stable code, severity, dataset, path, and message. Blocking findings prevent readiness; orphan bindings remain visible as warnings on ready data.

## Acceptance criteria

- [ ] The manifest contract supports an optional local runtime-bindings reference, and the USH manifest declares its existing bindings dataset.
- [ ] Loaded source data and assembled catalog data expose the validated runtime binding set.
- [ ] Manifest, ProductProfile, customization, and runtime-binding collection identities are cross-checked.
- [ ] Required runtime attributes include ProductProfile attributes, customization fields, and established nonvisual command attributes.
- [ ] Declared runtime bindings without a valid ProductProfile fail before the collection becomes ready.
- [ ] Structural failures, duplicate or missing bindings, missing mapped values, and missing product types become blocking collection diagnostics.
- [ ] Orphan bindings are returned as warning diagnostics without blocking a valid collection.
- [ ] Relevant tests, TypeScript validation, and changed-file linting pass.

## Blocked by

- Blocked by #plans/developer-a-active-collection-integration/01-load-customization-contract.issue.md

