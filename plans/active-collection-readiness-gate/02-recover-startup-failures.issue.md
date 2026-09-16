## What to build

Provide a complete recovery path when the initial collection cannot open the configurator. Render a full-screen safe error state for resolution, loading, validation, and missing-configurator capability failures. Let the user retry the captured session without reloading the page, or explicitly start a new default-collection session through full-page navigation when a known different default is available.

## Acceptance criteria

- [ ] Collection errors and missing-configurator capability errors block the complete configurator shell.
- [ ] Error copy identifies the affected collection where useful without exposing raw causes, payloads, or stack traces.
- [ ] Retry reruns the complete collection pipeline for the same captured identity without browser reload.
- [ ] Retry prevents duplicate attempts and stale responses cannot replace the latest result.
- [ ] Open default collection appears only for an explicit identity that differs from a known registry default.
- [ ] Open default collection performs full-page navigation, removes only `collectionId`, and preserves the route and all other query parameters.
- [ ] Registry loading failures and failures of the current default do not offer a redundant default action.
- [ ] Focused tests, TypeScript validation, and linting pass.

## Blocked by

- Blocked by #plans/active-collection-readiness-gate/01-establish-fixed-session-ready-access.issue.md
