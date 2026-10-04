## What to build

Protect an active configurator session from client-side collection identity drift. Compare subsequent URLs with the exact startup identity representation and replace the shell with a controlled error if the parameter appears, disappears, becomes empty, or changes value. Let the user intentionally restart through full-page navigation using the current URL.

## Acceptance criteria

- [x] An explicit startup identity must remain present with the same value throughout the session.
- [x] An implicit-default startup identity must remain absent throughout the session.
- [x] Adding, removing, emptying, or changing `collectionId` blocks the configurator without hot-switching collection data.
- [x] The mismatch screen explains that collection identity cannot change during an active session.
- [x] Restart configurator performs full-page navigation using the current URL.
- [x] Unrelated query-parameter and pathname changes remain supported and do not trigger a mismatch.
- [x] Focused tests, TypeScript validation, and linting pass.

## Blocked by

- Blocked by #plans/active-collection-readiness-gate/01-establish-fixed-session-ready-access.issue.md
- Blocked by #plans/active-collection-readiness-gate/02-recover-startup-failures.issue.md
