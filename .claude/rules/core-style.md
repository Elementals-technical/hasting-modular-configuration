---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# Core style rules

## Types

- Declare object shapes, unions, props and function types with `type`; `interface` only to augment `Window` inside `declare global`. Extend by intersection: `type A = B & { … }`.
- Type names are PascalCase with no `I`/`T` prefix and no `I` suffix; a props type is `<Component>Props`; a generic parameter is `T`.
- A closed set is a string-literal union with kebab-case members. When the values are needed at runtime, declare an `as const` object or array and derive the type with `(typeof X)[keyof typeof X]` or `(typeof X)[number]`.
- No `any` and no `@ts-ignore`: take `unknown` and narrow it with a type guard (`value is T`). Enforced by: `@typescript-eslint/no-explicit-any`, `@typescript-eslint/ban-ts-comment`.
- `null` is an explicit "no value", `?:` a key that may be absent, `x?: T | null` both. Default with `?.` and `??`, not `&&` and `||`; compare with `===`.
- Express immutability in types (`readonly T[]`, `Readonly<…>`, `as const`), not with `Object.freeze`.

## Naming

- Module-level immutable constants are UPPER_SNAKE; mutable module state and a slice's `initialState` stay camelCase.
- Name booleans and predicate functions as questions: `is*`, `has*`, `should*`, `can*`.
- Prefix a deliberately unused parameter with `_`.

## Functions and failures

- Write a module-level function as `export const name = (…) => …`; a `function` declaration only for overloads.
- A loader or client boundary throws a typed `Error` subclass carrying a `code` (`CollectionDataError`, `ConfiguratorError`); commands, parsers and scene ports return a discriminated union (`{ ok }`, `{ status }`) instead of throwing.
- Catch only at a boundary: iframe wrappers, loaders, storage and I/O helpers, UI event handlers. Pure logic doesn't catch. A catch that swallows says why in a comment; an unused error is a bare `catch {`.
- Log only with `console.warn` or `console.error`, the message starting with a `"[Tag]"` literal or the module's `LOG_PREFIX`. No `console.log` in committed code.

## Units and money

- Dimensions are plain numbers: cm on the flat scene API, in product configs and in cabinet dimensions; metres on the namespaced `ConfiguratorAPI`; inches for countertop lengths in the UI and `ui.json`. Put the unit in the name wherever it isn't obvious: `widthCm`, `lengthM`, `limitsIn`, `offsetPx`, `delayMs`.
- Convert numbers with `cmToInch`/`inchToCm` from `src/utils/units.ts`; a SKU size token comes from `cmToInches` in `src/shared/lib/sku/cmToInches.ts`.
- Prices are plain dollar numbers, formatted only for display, with `formatSummaryPrice` from `src/shared/lib/pricing/summaryLinePrice.ts`.

## Comments

- Comments are English: `/** … */` on a declaration, a field or a module's purpose, `//` inside a body. Say why, which constraint, or what a non-obvious value means, never what the line does. Delete a comment your change makes untrue.
- Never cite a planning ID, a task card or a document the reader can't open; state the constraint itself.

## Formatting

- Format with Prettier per `.prettierrc`. Before editing an existing file run `npx prettier --check <file>`: if it passes, run `npx prettier --write <file>` after your edit; if it fails, format your own lines by hand and leave the rest of the file as it is. Format a new file with `--write`.
