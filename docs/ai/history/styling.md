---
trigger: Creating or editing *.scss files, class names or inline styles in components.
reader: An agent or developer styling UI.
authoritative:
  - src/shared/assets/styles/index.scss
  - src/shared/assets/styles/variables.scss
  - src/entities/collection/ui/CollectionReadinessGate.module.scss
---

# Styling

- **Colocated modules** (observed, not enforced). Component styles are SCSS Modules next to the component: `ComponentName.module.scss` beside `ComponentName.tsx`.
  - Import the module as `s` and use `className={s.name}`.
  - Example: `src/entities/collection/ui/CollectionReadinessGate.tsx:15`.
- **Global styles** live only in `src/shared/assets/styles/`. `index.scss` is imported once in `src/main.tsx:10` and pulls in `variables.scss` and `global.scss`. Don't add global stylesheets for component styling.
- **Conditional classes:** `clsx`.
- **Tokens:** CSS custom properties in `src/shared/assets/styles/variables.scss`. Use an existing property when one matches.
  - Not decided: most modules still use literal hex colors. Don't mass-replace them as a side task.
- **Responsive:** `@media` in the module. Some components branch in JS (`matchMedia`, `innerWidth`); follow the component you are editing.
- **Inline `style`:** only for values computed at runtime — colors from data, virtualized rows, positions from the scene. Static layout belongs in the module; the repeated static inline flex blocks are legacy.

## Examples

- `src/entities/collection/ui/CollectionReadinessGate.tsx`
- `src/entities/collection/ui/CollectionReadinessGate.module.scss`
