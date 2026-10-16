## What to build

AFK. Replace the Upper/Lower radio-style panel switcher with a controlled Base UI Tabs flow while preserving all countertop behavior. The completed slice provides semantic tabs, immediate keyboard activation, independently stateful Upper and Lower panels, deterministic fallback when Lower becomes unavailable, and the existing color-change, swatch-order, error, and processing contracts.

## Acceptance criteria

- [x] The selector uses Base UI Tabs primitives and exposes a tab list named `Countertop level`, two tabs named `Upper` and `Lower`, and their related tab panels.
- [x] Upper is active on first render and its existing child controls remain the default content.
- [x] Selecting Lower exposes the lower countertop color controls; selecting Upper exposes the original Upper controls.
- [x] Left and Right Arrow move focus and immediately activate the adjacent tab, including wrapping between the two options.
- [x] Both tab panels remain mounted during ordinary Upper/Lower switches, and user-selected filters in each color panel survive a round trip to the other panel.
- [x] When the lower field is unavailable, no tab list is rendered and the existing Upper controls remain available.
- [x] If Lower is active when the lower field becomes unavailable, the selected level resets to Upper and stays Upper if the lower field later becomes available again.
- [x] Upper selections continue to use the existing Upper handler, while Lower selections use only the existing lower-color handler.
- [x] The existing swatch-order action, Lower error alert, and observable processing behavior remain unchanged.
- [x] Decorative content does not alter the accessible names of the Upper and Lower tabs.
- [x] Tests assert public roles, names, focus, visible content, retained state, callback routing, availability fallback, errors, and processing behavior without coupling to Base UI internals.
- [x] Focused tests and TypeScript validation pass, with no new lint failures in changed code.

## Blocked by

None - can start immediately
