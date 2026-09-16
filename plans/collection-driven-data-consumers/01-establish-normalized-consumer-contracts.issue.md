## What to build

Establish the catalog-facing contracts used by every later migration slice. Make shared configurator transformations and SKU lookup operate on normalized option groups, keep countertop rules behind the active-collection hook, remove the unused hardcoded cabinet-table identity from the legacy fallback, and add focused tests that prove behavior is unchanged.

## Acceptance criteria

- [ ] Shared configurator adapters accept normalized collection option groups without requiring a raw endpoint envelope.
- [ ] Countertop-rule access reads the active collection catalog and preserves safe empty behavior for an absent optional catalog.
- [ ] Countertop SKU resolution accepts normalized collection option groups.
- [ ] The legacy cabinet fallback contains only required column mappings and no hardcoded DataTable identity.
- [ ] Existing manifest and ProductProfile-owned source identity remains unchanged.
- [ ] Focused adapter, rule, and loader tests pass.
- [ ] TypeScript validation and changed-file linting pass.

## Blocked by

None - can start immediately
