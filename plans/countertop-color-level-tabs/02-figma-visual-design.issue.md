## What to build

AFK. Apply the approved Hastings visual design to the Base UI Upper/Lower tabs as a complete responsive segmented control. Add the exact Figma diagram assets through the existing SVGR pipeline, render the active state with an animated Base UI indicator, and verify the finished selector against the supplied desktop and isolated-component references without changing the color panels themselves.

## Acceptance criteria

- [x] Exact Upper and Lower diagram SVGs are exported from the approved Figma component, stored as project-owned widget assets, and imported through the existing `?react` SVGR convention.
- [x] Runtime rendering does not depend on temporary Figma asset URLs, approximate Lucide icons, inline duplicated paths, or CSS recreations of the diagrams.
- [x] Both diagrams render at 48 by 24 pixels, retain their designed geometry and colors, and are hidden from assistive technology and keyboard focus.
- [x] The selector fills the available container width, remains 40 pixels high, and divides its two tabs into equal halves without narrow-screen overflow.
- [x] The outer control uses a white background, a one-pixel `#E5E6EA` border, fully rounded pill geometry, and clipped contents.
- [x] Labels and diagrams are centered in each tab with a 12-pixel gap; labels use Poppins at 14 pixels with a 20-pixel line height and `#282828` text.
- [x] Inactive labels use regular weight and the active label uses medium weight.
- [x] A Base UI Tabs Indicator provides the `#F1EBE6` active pill behind the tab content and aligns exactly with the active half.
- [x] The indicator animates between tabs using a 180-millisecond ease-out transition, while the color panels themselves switch without slide or fade animation.
- [x] Indicator movement is disabled under `prefers-reduced-motion: reduce`.
- [x] Only inactive tabs receive the approved subtle neutral hover feedback.
- [x] Keyboard focus uses the project's standard focus-ring variables and remains clearly visible without introducing a countertop-specific focus treatment.
- [x] Browser comparison against Figma nodes `3431:9848` and `3431:9926` confirms height, proportions, border, active fill, typography, spacing, diagram dimensions, and optical alignment.
- [x] Browser verification at a narrow sidebar or mobile width confirms equal tabs, readable labels, intact diagrams, and no clipping or horizontal overflow.
- [x] The focused tests, TypeScript validation, changed-code linting, and production build pass; any unrelated pre-existing failures are reported separately.

## Blocked by

- Blocked by #plans/countertop-color-level-tabs/01-base-ui-tab-behavior.issue.md
