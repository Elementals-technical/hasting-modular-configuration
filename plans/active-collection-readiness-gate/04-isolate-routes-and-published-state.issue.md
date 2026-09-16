## What to build

Apply collection readiness only to the routes and shared state that form a configurator session. Keep Restore free to resolve saved metadata before choosing a collection and keep AR download independent. Ensure Redux collection data and runtime bindings follow raw lifecycle state and are cleared whenever no ready collection is available, while gated product consumers receive only ready data.

## Acceptance criteria

- [ ] Prebuilt and Custom routes run beneath the collection provider and readiness gate.
- [ ] Restore and AR download routes mount without waiting for collection resolution.
- [ ] Restore enters the gated configurator only after it has determined the saved collection destination.
- [ ] The Redux lifecycle bridge publishes ready collection data and clears active identity, profile, and cabinet catalog otherwise.
- [ ] The runtime lifecycle bridge publishes ready bindings and clears its cache otherwise and on teardown.
- [ ] Retry loading, initial errors, and provider teardown cannot leave stale collection data or bindings published.
- [ ] Focused router and bridge tests, TypeScript validation, and linting pass.

## Blocked by

- Blocked by #plans/active-collection-readiness-gate/01-establish-fixed-session-ready-access.issue.md
