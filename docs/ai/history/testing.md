---
trigger: Writing, changing or fixing a test; choosing a test environment; migrating a file out of a boundary-test list.
reader: An agent or developer working on tests.
authoritative:
  - vitest.config.ts
  - src/entities/collection/__tests__/fixtures/README.md
  - src/entities/collection/__tests__/fixtures/renderWithFixtureCollection.tsx
  - src/entities/countertop/api/__tests__/countertopApi.test.ts
  - src/features/playCanvasAdapter/index.ts
  - src/entities/collection/__tests__/collectionConsumerBoundary.test.ts
---

# Testing

## Setup

- Vitest runs only `src/**/__tests__/**/*.test.{ts,tsx}` (`vitest.config.ts:13`).
- The default environment is `node`. DOM tests start with `// @vitest-environment jsdom`.
- Integration tests use the real `store` and reset its slices in `beforeEach` (e.g. `src/entities/collection/__tests__/fixtureUiStateIntegration.test.tsx:53-55`).

## Helpers

- Rendering with a synthetic collection: `renderWithFixtureCollection` (`src/entities/collection/__tests__/fixtures/renderWithFixtureCollection.tsx`). The fixtures are described in `src/entities/collection/__tests__/fixtures/README.md`.
- Backend API: msw, as in `src/entities/countertop/api/__tests__/countertopApi.test.ts`.
- Scene: the stand-ins `createTestRuntimePort`, `createTestSceneReader` and `createTestSceneRestorer` from `@/features/playCanvasAdapter`.

## Boundary tests with pending lists

- Source-scanning tests such as `src/entities/collection/__tests__/collectionConsumerBoundary.test.ts` keep lists of files that still break a rule.
- A list only shrinks. When you migrate a file, remove it from its list in the same change; the test fails if a clean file stays listed.

## Examples

- `src/entities/collection/__tests__/fixtures/renderWithFixtureCollection.tsx`
- `src/entities/collection/__tests__/fixtureUiStateIntegration.test.tsx`
- `src/entities/countertop/api/__tests__/countertopApi.test.ts`
- `src/entities/collection/__tests__/collectionConsumerBoundary.test.ts`
