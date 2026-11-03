---
paths:
  - "src/**/__tests__/**"
  - "vitest.config.ts"
  - "scripts/*.test.mjs"
---

# Testing rules

## Placement and shape

- A test lives in a `__tests__/` folder beside the code it covers: `<Subject>.test.ts`, `.test.tsx` when it renders React, `<Subject>.<aspect>.test.tsx` to split a subject. Enforced by: `vitest.config.ts` runs nothing else, and a test elsewhere is skipped silently.
- Put a new test in the `__tests__/` folder its slice already uses: the slice root or `lib/`. Why: slices differ, and a second folder splits the slice's tests. Example: `src/features/countertopPlacement/__tests__/`.
- Import `describe`, `it`, `expect`, `vi` and the hooks from `"vitest"`; there are no globals. Every `it` sits in a `describe`; use `it`, never `test`, and `.each` for tables.
- Name an `it` as a lower-case English behaviour phrase ("keeps …", "rejects …"), never with "should".
- Assert with `toEqual`, `toBe` and `toMatchObject`; label an assertion inside a loop, `expect(value, label)`; keep inline snapshots for SKU and line lists.
- Tests type-check with the app: no `any`, no suppression comment; stub with `as unknown as T`.
- A Node-only check the app tsconfig can't type lives in `scripts/<name>.test.mjs` on `node:test`; `npm test` doesn't run it.

## Environment

- Node is the default environment. A file that renders React or touches `window`, `document` or a URL origin starts with `// @vitest-environment jsdom` on line 1.
- Render with `@testing-library/react`, query by role, text or label, fire events with `fireEvent`, and assert with core matchers: jest-dom and user-event aren't installed. Every file that renders calls `afterEach(cleanup)`, since nothing cleans up automatically without globals.
- Remove from `document.body` only the elements the test appended, never `document.body.innerHTML = ""`. Why: a hook that empties the body runs before the file's `cleanup` and breaks React's portal unmount with `NotFoundError`. Example: `src/features/countertopPlacement/__tests__/CountertopDragOverlay.test.tsx`.

## Data and doubles

- Use the real `store` and reset it in `beforeEach`; build a separate store from `rootReducer` only when the test needs isolation.
- Mock at the scene and layout boundary (`usePlayCanvasReady`, `@/utils/functions/playcanvas/*`, the accordion) and keep the logic under test real. An in-memory scene is a `createTest*` port from `@/features/playCanvasAdapter`.
- Mount under a ready collection with `renderWithFixtureCollection` (`src/entities/collection/__tests__/fixtures/`) or `renderWithUshCollection`, and stand the accordion in with the shared `vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion")`.
- Never reach the network: inject the loader's `fetchJson` and `remote`, use msw only for an RTK Query endpoint, and read RenderAdmin data from the frozen samples in `src/entities/collection/__tests__/fixtures/remote/`.
- Import shipped collection data straight from `public/collections/**`, never a copy and never through `fs`; a fixture helper parses it once and throws if it is invalid.
- Prove schema-driven behaviour against the synthetic `fixture-ui` and `fixture-rules` collections.
- Simulate a host that blocks session storage with `vi.spyOn(window, "sessionStorage", "get")`, and restore it when the test ends. Why: a spy on `Storage.prototype` does not intercept `sessionStorage` under this jsdom setup. Example: `src/features/countertopPlacement/__tests__/CountertopDragMode.test.tsx`.

## Pinned facts

- A change that alters a fact a test pins updates the pin in the same change: the direct scene calls and setter writes in `collectionConsumerBoundary.test.ts` (exact counts, only ever lowered), the production profiles in `reasonCodesHaveMessages.test.ts`, the registry in `collectionContracts.test.ts`, the shipped preset counts, and the scene export in `sceneKeysInExport.test.ts` and `sceneMaterialsInExport.test.ts`.
