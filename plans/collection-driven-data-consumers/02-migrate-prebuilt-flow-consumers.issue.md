## What to build

Migrate the Prebuilt Model, Cabinet, Countertop, Accessories, and Faucet flow from direct configurator and countertop requests to the ready active-collection catalogs. Preserve option filtering, SKU resolution, rule behavior, navigation, and visible UI while removing redundant page-level request loading states.

## Acceptance criteria

- [ ] Every targeted Prebuilt page selects configurator groups through the ready active-collection API.
- [ ] Prebuilt countertop rules come from the normalized collection catalog rather than DataTable `438`.
- [ ] Model SKU resolution uses normalized collection groups.
- [ ] Page-level loading flags for the already-loaded configurator source are removed.
- [ ] No targeted Prebuilt file imports or calls the direct configurator or countertop DataTable query hooks.
- [ ] Existing focused page and rule tests pass with ready collection providers.
- [ ] TypeScript validation and changed-file linting pass.

## Blocked by

- Blocked by #plans/collection-driven-data-consumers/01-establish-normalized-consumer-contracts.issue.md
