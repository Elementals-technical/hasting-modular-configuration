## What to build

Establish the catalog-facing contracts used by every later migration slice. Make shared configurator transformations and SKU lookup operate on normalized option groups, keep countertop rules behind the active-collection hook, remove the unused hardcoded cabinet-table identity from the legacy fallback, and add focused tests that prove behavior is unchanged.

## Acceptance criteria

- [x] Shared configurator adapters accept normalized collection option groups without requiring a raw endpoint envelope.
- [x] Countertop-rule access reads the active collection catalog and preserves safe empty behavior for an absent optional catalog.
- [x] Countertop SKU resolution accepts normalized collection option groups.
- [x] The legacy cabinet fallback contains only required column mappings and no hardcoded DataTable identity.
- [x] Existing manifest and ProductProfile-owned source identity remains unchanged.
- [x] Focused adapter, rule, and loader tests pass.
- [x] TypeScript validation and changed-file linting pass.

## Blocked by

None - can start immediately
