---
paths:
  - "src/**/*.tsx"
---

# Component rules

## Declaration

- Write a component as `export const Name = ({ a, b = 1 }: NameProps) => { … }`: an arrow const with props destructured in the signature and their defaults there. No `React.FC`, no `defaultProps`, no `memo`.
- Declare `type NameProps` just above the component and export it only when another module needs it.
- Import React members by name (`import { useState } from "react"`, `import type { ReactNode } from "react"`); never `import React`.
- One exported component per file; file-local helper components may sit beside it.

## State, data and navigation

- Read Redux with `useAppSelector(namedSelector)` and `useAppDispatch()` from `@/shared/hooks/store/redux`, never react-redux's own hooks and never an inline selector lambda. Read imperatively inside a callback with `useStore<RootState>()`.
- Navigate inside the configurator with `useCollectionNavigate` or `useStepNavigate` from `@/features/collectionCustomization`, never react-router's `useNavigate`: they keep `collectionId` and the rest of the query.
- Wait for the scene with `usePlayCanvasReady()`.

## Styling

- Style through the colocated module: `import s from "./Name.module.scss"`, `className={s.root}`. Compose conditional classes with `clsx` (`import clsx from "clsx"`), never by interpolating a value that can be `undefined` or `false` into a template string. Look a variant up as `s[variant]`.
- Inline `style` carries runtime values only: geometry from scene anchors, data colours and images. Static layout belongs in the module.

## JSX

- Show or hide with `{cond && <X />}`, use a ternary only between two branches, and return early for a guard state. Fragments are `<>…</>`.
- Key list items by a domain id, never the array index.
- A raw `<button>` always has `type="button"`. A standard action button is `BaseButton` from `@/shared`; a custom-shaped control may stay a raw button.
- Name callback props `onX` and local handlers `handleX`. Mark a fire-and-forget promise with `void`.

## Effects

- An effect that subscribes (a DOM listener, a scene `.on(…)`, an interval or timeout) returns its teardown.
- An async effect ignores a stale result through a local flag its cleanup sets.
