## What to build

Migrate the Custom Cabinet Colors, Countertop, Accessories, and Faucet Holes flow from direct configurator and countertop requests to the ready active-collection catalogs. Preserve material mapping, option filtering, SKU candidates, rule decisions, and visible UI while removing duplicate loading and parsing work.

## Acceptance criteria

- [x] Every targeted Custom page selects configurator groups through the ready active-collection API.
- [x] Custom countertop and faucet-hole rules come from the normalized collection catalog rather than DataTable `438`.
- [x] Duplicate per-page countertop parsing is removed.
- [x] Page-level loading flags for the already-loaded configurator source are removed.
- [x] No targeted Custom file imports or calls the direct configurator or countertop DataTable query hooks.
- [x] Existing focused page and rule tests pass with ready collection providers.
- [x] TypeScript validation and changed-file linting pass.

## Blocked by

- Blocked by #plans/collection-driven-data-consumers/01-establish-normalized-consumer-contracts.issue.md
