## What to build

AFK. Resolve audit findings 1, 2 and 6: every configurator option list scrolls through the step-content panel, and Full Mode scrolls through its modal content. Flat, grouped and cabinet-style grids take their natural height at every breakpoint. Short or empty lists do not reserve an arbitrary minimum height. Keep the configurator within the viewport and preserve panel animations, filters and material previews.

## Acceptance criteria

- [x] Desktop, tablet and phone option lists have only one active vertical scroll container.
- [x] Flat and grouped Full Mode lists scroll through modal content; their last option is reachable.
- [x] Short lists and the leading None option have no fixed 185px minimum height.
- [x] Opening, filtering and resizing lists preserves viewport height, canvas and footer.

## Blocked by

None - can start immediately.

## Validation

Chrome: 18 combinations across six viewports and three grids; grouped and flat Full Mode; last-card reachability; natural None height; empty loading and loaded grids.
