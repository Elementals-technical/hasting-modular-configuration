---
trigger: Adding a file or module, importing across slices or layers, touching the store, listeners or backend API, deciding where a type lives.
reader: An agent or developer placing or importing code.
authoritative:
  - tsconfig.app.json
  - src/app/store/index.ts
  - src/app/store/reducer.ts
  - src/app/store/optionsListener.ts
  - src/shared/hooks/store/redux.ts
  - src/shared/api/baseApi.ts
  - src/entities/collection/index.ts
---

# Architecture

## Layout

- FSD layers under `src/`, from high to low: `app` → `pages` → `widgets` → `features` → `entities` → `shared`.
- `src/utils/` sits outside the layers. It holds mostly the PlayCanvas wrappers; treat it like `shared`.
- `@/` is the alias for `src/` (`tsconfig.app.json:10-13`). Inside a slice, use relative imports.
- Entry chain: `src/main.tsx` → `src/app/App.tsx` → `src/app/router/routerConfig.tsx`.

## Imports between slices

Observed in code, not enforced:

- When a slice has an `index.ts`, that file is its public API. Other slices import from `@/<layer>/<slice>`, not from its internals. Rationale: `src/entities/collection/index.ts:20-25`.
- Slices without an `index.ts` are imported by file path — for example `src/entities/product/`, `src/entities/history/`, `src/features/configurator-rule-core/`. Don't add an index as a side task.
- Proposed, not decided: don't add new layer-root barrels (`@/entities`, `@/features`, `@/widgets`, `@/pages`). There is no rule for `@/shared`.
- `src/entities/collection/index.ts` lists its re-exports by name, one section per owner, so a name collision becomes a compile error. Keep adding exports that way.
- Tests may import internals and fixtures of any slice.

## Layer direction

Observed, not enforced:

- Lower layers don't import higher ones. Two exceptions are allowed:
  - `import type { RootState, AppDispatch } from "@/app/store"` from any layer;
  - importing the `store` value, in tests only.
- Existing violations are legacy: `shared` importing `entities`, and `entities` importing `features` (e.g. `src/entities/product/model/store/slice.ts:7-11`). Don't add new ones.

## State

- There is one RTK store (`src/app/store/index.ts`). UI slices live under `rootStateUI` (`src/app/store/reducer.ts`); RTK Query lives under `api`.
- Components use `useAppSelector` / `useAppDispatch` from `src/shared/hooks/store/redux.ts`. Production code has no raw `useSelector`.
- Cross-slice reactions live in the listener middleware (`src/app/store/optionsListener.ts`).
- Proposed, not decided: type new listeners with `startListening.withTypes<RootState, AppDispatch>()`, which RTK 2.11 supports, instead of casting `getState()`.

## Backend API

- Each entity injects its endpoints into `baseApi` (`src/shared/api/baseApi.ts`) from `src/entities/<slice>/api/`, split into `<slice>Api.ts`, `routes.ts` and `types.ts`.
- Response types are hand-written. Check them against real responses or the frozen fixtures, never guess.

## Where a type lives

Search in these places before creating a type; don't duplicate an existing shape.

- Backend responses → `src/entities/<slice>/api/types.ts`.
- Collection documents → `docs/ai/collection-contracts.md`.
- Store → `RootState` / `AppDispatch`, imported type-only from `@/app/store`.
- UI-only view models → next to the component, or in the slice's `model/`.

## Components

Observed, not enforced: arrow function components with props typed on the parameter, `export const X = ({ a }: Props) => …`.

## Ownership

Code comments and tests name owners (`src/entities/collection/index.ts:1`, `src/entities/collection/__tests__/collectionConsumerBoundary.test.ts:42-43`):

- A — collection loading;
- B — pages and the UI schema;
- C — product profile, state and commands;
- D — pricing;
- I — scene and runtime bindings.

Keep the owner comments when editing those sections.

## Examples

- `src/entities/countertop/api/countertopApi.ts` and its msw test `src/entities/countertop/api/__tests__/countertopApi.test.ts`
- `src/entities/configuration/model/store/slice.ts`
- `src/entities/history/model/store/slice.ts`
- `src/shared/hooks/store/redux.ts`

## Don't copy

- The `getState()` casts in `src/app/store/optionsListener.ts`.
- `src/entities/product/model/store/slice.ts` — it imports from features.
