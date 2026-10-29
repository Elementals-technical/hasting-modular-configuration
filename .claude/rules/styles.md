---
paths:
  - "src/**/*.scss"
  - "src/**/*.css"
---

# Style rules

## Modules

- Style a component with one colocated `<Component>.module.scss` named after it; global CSS enters only through `src/shared/assets/styles/index.scss`. Each sheet is self-contained, since Vite injects nothing, and Sass stays plain CSS with nesting: no mixins, functions or `@import`.
- Class names are camelCase and flat. No BEM: a variant or state is a sibling class (`.active`, `.primary`) toggled from TSX or looked up as `s[variant]`.
- Use `&` for pseudo-classes, pseudo-elements and compound states, and nest at most three levels deep.
- A component's own custom property is declared on its own class, in kebab-case, named after the feature.

## Values

- A colour that has a token in `src/shared/assets/styles/variables.scss` is written as `var(--token)`; any other colour is a hex literal. The font follows suit: Poppins is applied globally, and a module that sets `font-family` uses `var(--font-family-base)`.
- Lengths and font sizes are `px`; `font-weight` is numeric.
- A `z-index` is a literal from the existing bands: up to 8 for local stacking, 20–50 for player and canvas layers, 99–301 for dropdowns and popups, 1000–1100 for menus over the scene, 2000 for the tutorial, 9999 for full-screen loaders.

## Responsive

- Write desktop-first `max-width` queries with literal px in the module that needs them: 1024 for the stacked layout, 767 for phones, 430 for small phones.
- Gate hover effects on selectable cards with `@media (hover: hover) and (pointer: fine)`.
- Size a popup frame as `width: min(<W>px, calc(100vw - 32px)); max-height: calc(100vh - 32px);`.

## Coupled names

- `global.scss` and `App.scss` match hashed class names by substring (`popupWrapper`, `centerContent`, `rightContent`, `title`, the summary page's classes), and four tests import module class names: renaming one of those classes means updating its matches in the same change.
- `HomePage.module.scss` styles the layout's children by position: keep `HomePage`'s child order.
