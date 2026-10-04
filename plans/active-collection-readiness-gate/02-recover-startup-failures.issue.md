## What to build

Provide a complete recovery path when the initial collection cannot open the configurator. Render a full-screen safe error state for resolution, loading, validation, and missing-configurator capability failures. Let the user retry the captured session without reloading the page, or explicitly start a new default-collection session through full-page navigation when a known different default is available.

## Acceptance criteria

- [x] Collection errors and missing-configurator capability errors block the complete configurator shell.
- [x] Error copy identifies the affected collection where useful without exposing raw causes, payloads, or stack traces.
- [x] Retry reruns the complete collection pipeline for the same captured identity without browser reload.
- [x] Retry prevents duplicate attempts and stale responses cannot replace the latest result.
- [x] Open default collection appears only for an explicit identity that differs from a known registry default.
- [x] Open default collection performs full-page navigation, removes only `collectionId`, and preserves the route and all other query parameters.
- [x] Registry loading failures and failures of the current default do not offer a redundant default action.
- [x] Focused tests, TypeScript validation, and linting pass.

## Blocked by

- Blocked by #plans/active-collection-readiness-gate/01-establish-fixed-session-ready-access.issue.md
