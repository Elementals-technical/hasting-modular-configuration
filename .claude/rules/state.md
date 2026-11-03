---
paths:
  - "src/app/store/**"
  - "src/**/model/store/**"
  - "src/**/model/selectors.ts"
  - "src/shared/hooks/store/**"
---

# State rules

## Slices

- A slice lives in `<slice>/model/store/slice.ts` with `selectors.ts` beside it, and is registered once in `src/app/store/reducer.ts` under `rootStateUI`, keyed by its `name`.
- Write `const xSlice = createSlice({ name: "x", initialState, reducers: { … } })` with a local `type XState` annotating `initialState`. Don't export the slice: export its actions by destructuring `xSlice.actions`, and the reducer as `xReducer`.
- A reducer is a method that mutates the Immer draft, typed `action: PayloadAction<T>` and named verb-first (`setX`, `resetX`, `recordX`); a reset returns the initial state.
- No `prepare`, `extraReducers`, `createAsyncThunk`, `createEntityAdapter`, `createAction` or thunks. A reaction across slices is a listener registered in `src/app/store/optionsListener.ts`, or a command that dispatches several actions.
- A reducer can't read another slice, so the data it needs is copied into its own slice by a bridge or a command. Example: `src/entities/configuration/ui/CollectionStateBridge.tsx`.

## Selectors

- A plain reader is `export const getX = (state: RootState) => state.rootStateUI.x…` in `selectors.ts`; a derived value is a `createSelector` named `selectX`.
- Memoize every selector that builds an object or array, and fall back to module-level constants (`NO_X`), never a fresh `[]` or `{}`. Why: a new reference re-runs every effect that depends on it, the summary autosave included.
- A selector that takes an argument, `(state, arg)`, serves non-React callers through `getState()`; a hook selects stable inputs and derives from them.
- Read the active product profile with `getActiveProductProfile`, never `product.activeProfile`.

## Ownership

- An attribute's value has one writer, the command layer. A new field in `ProductState.productOptions` needs, in the same change: an `ATTRIBUTE_OWNERSHIP` entry (`src/entities/configuration/model/ownership.ts`); a `COMMITTERS` entry in `src/features/configurationCommands/lib/commitChange.ts`, with its setter added to `COMMITTED_SETTERS` in `collectionConsumerBoundary.test.ts`; mirrors in `SceneSnapshot.productOptions` (`src/entities/history/model/store/slice.ts`) and in `ConfigurationUiState` (`src/features/saveConfiguration/lib/buildConfigurationMetadata.ts`) with `selectConfigurationUiState`. Enforced by: `ownership.test.ts`, `collectionConsumerBoundary.test.ts`, `commandAttributesRoundtrip.test.ts`.

## Outside Redux

- The active collection lives in React context; `CollectionStateBridge` alone copies it into Redux for reducers and non-React code.
- A high-frequency runtime value (overlay frames, live sizes) lives in a module-level store read with `useSyncExternalStore`, not in Redux or React state.
- `sessionStorage` holds per-session UX flags; `localStorage` is for debug tooling only.
