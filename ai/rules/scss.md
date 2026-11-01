---
paths:
  - "src/**/*.scss"
---

# Styling conventions

> Read when: Styling in the Hastings Modular UI — SCSS Modules next to components, global styles, CSS custom properties, conditional classes, inline styles, no CSS-in-JS. Read when creating or editing *.scss files or component classNames and styles.

- **[observed] Colocated modules.** Component styles are SCSS Modules next to the component: `ComponentName.module.scss` beside `ComponentName.tsx`.
  - Import as `import s from "./ComponentName.module.scss";`, use as `className={s.name}`.
  - Example: `src/entities/collection/ui/CollectionReadinessGate.tsx`.
- **Global styles** live in `src/shared/assets/styles/`: `index.scss`, imported once in `src/main.tsx`, pulls in `variables.scss` and `global.scss`. `src/app/App.scss` holds the global print rules for the summary print clone. Don't add global stylesheets for component styling.
- **No CSS-in-JS.** styled-components, emotion and MUI `sx` are not in the project; don't introduce them.
- **Tokens:** CSS custom properties in `src/shared/assets/styles/variables.scss` (`--text-color-base`, `--border-main-color`, …).
  - Use an existing property when one matches.
  - **[needs decision]** Most modules use literal hex colors. Don't mass-replace them as a side task.
- **Conditional classes** — **[needs decision]** `clsx` is installed and used in some components; most components build the class string with a template literal. Follow the component you are editing.
- **Responsive:** `@media` in the module. Some components branch in JS (`matchMedia`, `innerWidth`); follow the component you are editing.
- **Inline `style={{ … }}`:** only for values computed at runtime — colors from data, virtualized rows, positions from the scene. Static layout goes into the module; repeated static inline flex blocks are legacy.
- **Icons — [enforced by review]** interface icons come from `lucide-react` through `src/shared/ui/AppIcon/AppIcon.tsx` (React) or `createSceneIcon` (controls the scene creates outside React). No inline SVG paths, CSS shapes or text glyphs for actions; no local SVG icon files; never import the whole Lucide catalog at runtime.
  - Stroke is a rendered-pixel contract, applied with `nonScalingStroke` via the shared CSS tokens: displayed size ≥ 20px → 1.5px; < 20px → 1.25px; every Player control in its compact mode (≤ 1024px) → 1px. The configurator navigation header keeps the standard rule even inside the Player shell.
  - Exceptions (kept as they are): Hastings logos, brand artwork, illustrations with embedded text, scene geometry (outlines, dimension lines, drag polygons).
  - Keep hover circles and hit areas in the control's styles, not in the icon; icon-only controls keep an accessible name, decorative icons stay `aria-hidden`.
  - Decision record: `docs/records/plans/2026-10-12-svg-icon-unification.prd.md`.
