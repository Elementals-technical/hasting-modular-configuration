## What to build

Upgrade the injected `fixture-rules` collection into a complete local collection package whose ProductProfile changes established rule inputs while using the same manifest, customization, runtime-binding, provider, and state-isolation contracts. The fixture must demonstrate that rule data can differ without importing USH defaults, catalogs, or remote sources.

## Acceptance criteria

- [ ] `fixture-rules` provides a manifest, ProductProfile, customization schema, and runtime bindings through test injection.
- [ ] Its ProductProfile exposes the documented changed drawer/rule inputs through active collection data.
- [ ] Its declared UI attributes have bound or explicitly unbound runtime entries and pass cross-contract validation.
- [ ] Loading and switching to the fixture does not retain USH defaults, catalogs, options, or diagnostics.
- [ ] Loading the fixture makes no configurator or DataTable request using USH IDs.
- [ ] The synthetic fixture remains absent from the production registry.
- [ ] Relevant tests, TypeScript validation, and changed-file linting pass.

## Blocked by

- Blocked by #plans/developer-a-active-collection-integration/02-load-runtime-bindings-and-diagnostics.issue.md
- Blocked by #plans/developer-a-active-collection-integration/03-isolate-collection-state-transitions.issue.md

