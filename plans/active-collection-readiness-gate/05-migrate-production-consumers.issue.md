## What to build

Complete the ready-only contract migration across production UI, navigation, restore, and PlayCanvas consumers. Replace local active-collection lifecycle checks with full-data or selector access beneath the gate, preserve feature-specific handling for genuinely optional catalogs, and remove temporary compatibility APIs once every consumer compiles against the final `useActiveCollection` contract.

## Acceptance criteria

- [x] UI pages and navigation/customization hooks consume ready collection data without collection lifecycle checks.
- [x] Restore consumers obtain the ready collection identity and optional runtime bindings without lifecycle fallbacks.
- [x] PlayCanvas integration consumes ready collection data or selectors without lifecycle fallbacks.
- [x] Infrastructure checks remain only in the provider, readiness gate, lifecycle bridges, and their tests.
- [x] Unrelated status unions, including scene readiness, remain unchanged.
- [x] The final public `useActiveCollection` supports full-data and selector forms and no temporary migration export remains.
- [x] Consumer tests use ready-data providers when lifecycle behavior is outside their responsibility.
- [x] A repository search confirms that production consumers no longer inspect active-collection status outside the approved infrastructure boundary.
- [x] Focused tests, TypeScript validation, and linting pass.

## Blocked by

- Blocked by #plans/active-collection-readiness-gate/01-establish-fixed-session-ready-access.issue.md
- Blocked by #plans/active-collection-readiness-gate/03-block-session-identity-drift.issue.md
- Blocked by #plans/active-collection-readiness-gate/04-isolate-routes-and-published-state.issue.md
