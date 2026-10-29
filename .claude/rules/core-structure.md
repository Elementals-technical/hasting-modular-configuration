---
paths:
  - "src/**"
---

# Core structure rules

## Layers

- Layers, top to bottom: `app` (router, store), `pages` (one folder per screen), `widgets` (composite blocks), `features` (user capabilities and their logic), `entities` (domain data, slices, RTK endpoints), `shared` (UI kit, hooks, lib, api, config, assets).
- Never add an import from a higher layer to a module that has none, and give a new module imports from its own layer and below only. `import type { RootState, AppDispatch } from "@/app/store"` is fine anywhere. Why: the upward imports that exist stay, but no module starts a new one.
- Another slice of the same layer may be imported, through its root `index.ts` when it has one.
- `src/utils/` takes only iframe wrappers under `utils/functions/playcanvas/`; a new helper goes to `shared/lib/` or the owning slice's `lib/`.

## Placement

- Inside a slice: components in `ui/`, non-React logic in `lib/`, state and the slice's shared types in `model/`, a Redux slice in `model/store/`, RTK Query only in `entities/<x>/api/`. Keep hooks where the slice already keeps them.
- A new screen is `pages/<screen>/<Screen>Page.tsx` exporting `<Screen>Page`, re-exported from `pages/index.ts` and mapped in `app/router/stepScreens.tsx`.
- Declare a type in the module that uses it; only a slice's shared contracts go to `model/types.ts` (`api/types.ts` for an endpoint). No `*.types.ts` files, no `types/` folders.
- Read configuration as `import.meta.env.VITE_*`, only in `shared/` modules.
- Production code never imports from a `__tests__` folder.

## Naming

- Slice folders are camelCase in `features`, `entities` and `pages`, PascalCase in `widgets` and for component folders in `shared/ui`.
- Components are `PascalCase.tsx` named after their export, hooks `useX.ts` (`.tsx` only with JSX), every other module camelCase `.ts`.

## Imports and exports

- Cross a slice or layer with the `@/` alias, stay relative inside a slice, and write specifiers without `.ts`/`.tsx`.
- Order imports as packages, then `@/…`, then relative, with a blank line between the groups; a component's `import s from "./X.module.scss"` comes last.
- Import a type-only binding through its own `import type` statement, not an inline `type` specifier.
- Named exports only, never `export default`.
- A feature slice other slices import has a root `index.ts` of named re-exports (`export { x } from`, `export type { T } from`), never `export *`; add what a consumer needs there instead of importing past it. Why: an explicit list turns a name collision into a compile error. Example: `src/features/configurationCommands/index.ts`.

## Product and scene boundaries

- Never branch on a literal collection id, and never write a RenderAdmin configurator or DataTable id in code: read the fact from the active collection's package. Lists of steps, fields, options and handle ids come from the collection, never a local list. Enforced by: `src/entities/collection/__tests__/collectionConsumerBoundary.test.ts` (ids 4, 438, 439).
- Read collection data in React through `useActiveCollection(selector)`; the lifecycle hooks are for the readiness gate and `CollectionStateBridge` only. Production code never imports or fetches `public/collections` JSON itself.
- Change a configuration value only through `@/features/configurationCommands`. Direct scene calls (`setConfigBatch(`, `setConfig(`, `addProduct(`, `removeProduct(`, `swapProducts(` and kin) belong under `utils/functions/playcanvas/`, `features/playCanvasAdapter/`, `features/configuratorApi/` and `features/dividers/adapter/` only, and a command-owned product setter is dispatched only from `features/configurationCommands/lib/commitChange.ts`. Enforced by: `collectionConsumerBoundary.test.ts`, which pins the remaining exceptions with exact counts: never add one, and lower the count in the change that removes one.
- A rule or command explains a refusal with a stable `namespace.camelCase` reason code whose text is in the USH `product-profile.json` `messages` (a `change.*` code: in every production profile); a component shows it through `useReasonText()` and keeps no phrase of its own. Enforced by: `reasonCodesHaveMessages.test.ts`, `uiReasonCodes.test.ts`.
