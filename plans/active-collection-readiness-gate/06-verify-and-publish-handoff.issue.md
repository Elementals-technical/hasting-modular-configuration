## What to build

Verify the final readiness boundary through registered production collections and publish the updated consumer handoff. Record the new lifecycle and ready-only contracts, link them to the existing collection migration status, identify any remaining unrelated collection work accurately, and provide reproducible automated and browser evidence without claiming unsupported collection capabilities.

## Acceptance criteria

- [x] Full relevant tests, repository TypeScript validation, linting, and production build results are recorded accurately.
- [x] Browser smoke verification covers implicit default USH, explicit USH, Urban Low Height, Class, unknown identity, retry, default recovery, and session identity mismatch.
- [x] The migration handoff explains the lifecycle-state API, ready-only selector API, shell capability requirement, and immutable session identity.
- [x] The handoff links to Collection data migration status v1 and preserves the distinction between data readiness and feature completeness.
- [x] Remaining missing presets, profiles, bindings, SKU mappings, pricing data, or browser acceptance are not reported as completed.
- [x] The PRD and all issue acceptance checklists reflect the implemented and validated result.
- [x] The final branch contains one reviewable commit per implemented issue after the planning commit.

## Blocked by

- Blocked by #plans/active-collection-readiness-gate/02-recover-startup-failures.issue.md
- Blocked by #plans/active-collection-readiness-gate/03-block-session-identity-drift.issue.md
- Blocked by #plans/active-collection-readiness-gate/04-isolate-routes-and-published-state.issue.md
- Blocked by #plans/active-collection-readiness-gate/05-migrate-production-consumers.issue.md
