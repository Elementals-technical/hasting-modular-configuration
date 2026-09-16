## What to build

Enforce the collection-owned source boundary across production code, validate all registered collections in the browser, and publish the final migration handoff. The repository should make regressions visible without banning generic API infrastructure or dynamic IDs used for unrelated requests.

## Acceptance criteria

- [ ] A source-level architectural test rejects production hardcodes for Configurator `4`, DataTable `438`, and DataTable `439` in collection-owned consumers.
- [ ] The guard rejects direct configurator and countertop DataTable query hooks outside approved API and collection-loader infrastructure.
- [ ] Production source contains no migrated hardcoded collection source IDs or prohibited direct query-hook consumers.
- [ ] Full tests, TypeScript validation, changed-file linting, repository lint, and production build results are recorded accurately.
- [ ] Browser smoke covers implicit and explicit USH, Urban Low Height, Class, unknown recovery, and session identity mismatch.
- [ ] Verification confirms migrated pages do not issue duplicate hardcoded configurator or countertop requests after readiness.
- [ ] Migration status v4 links to v3 and records remaining partial-collection and PlayCanvas/pricing limitations accurately.
- [ ] The PRD and every issue checklist reflect the implemented result.
- [ ] The branch contains a planning commit followed by one reviewable commit for each implementation issue.

## Blocked by

- Blocked by #plans/collection-driven-data-consumers/02-migrate-prebuilt-flow-consumers.issue.md
- Blocked by #plans/collection-driven-data-consumers/03-migrate-custom-flow-consumers.issue.md
- Blocked by #plans/collection-driven-data-consumers/04-migrate-cross-cutting-consumers.issue.md
