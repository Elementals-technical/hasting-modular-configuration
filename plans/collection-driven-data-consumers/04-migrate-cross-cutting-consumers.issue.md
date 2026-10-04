## What to build

Migrate both summaries, pricing, swatch ordering, the cabinet-style sidebar, and PlayCanvas integration to normalized active-collection configurator groups and countertop rules. Preserve all derived SKU maps, swatch output, price inputs, quick-editor behavior, and scene-supporting lookups.

## Acceptance criteria

- [x] Both summary flows use active-collection groups and normalized countertop rules.
- [x] Pricing SKU maps derive from active-collection groups without a direct configurator request.
- [x] Swatch mapping accepts active-collection groups and retains existing visible-material behavior.
- [x] Sidebar and PlayCanvas integration use active-collection groups without direct query hooks.
- [x] No targeted cross-cutting file imports or calls the direct collection-source query hooks.
- [x] Existing summary, pricing, swatch, sidebar, and PlayCanvas-focused tests pass.
- [x] TypeScript validation and changed-file linting pass.

## Blocked by

- Blocked by #plans/collection-driven-data-consumers/01-establish-normalized-consumer-contracts.issue.md
