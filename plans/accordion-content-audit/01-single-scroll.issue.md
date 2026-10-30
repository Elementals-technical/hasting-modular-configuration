## What to build

AFK. Resolve audit findings 1, 2 and 6: fit the configurator accordion into the available step-content height, keep every section header visible, and scroll only the expanded section's content. When less than 80px remains for content after reserving header heights, allow the outer step-content panel to scroll. The document stays within the viewport in both modes. Full Mode owns its modal-content scroll. Flat, grouped and cabinet-style grids take their natural height; short or empty lists do not reserve an arbitrary minimum height. Preserve Base UI panel animations, filters and material previews.

## Acceptance criteria

- [x] Desktop, tablet and phone option lists have only one active vertical scroll container.
- [x] With sufficient space, every accordion header stays visible while the expanded content scrolls.
- [x] Very short viewports use outer step-content scrolling without adding document scrolling.
- [x] Resizing and changing the number of sections updates scroll ownership and resets the outer scroll when returning to the contained layout.
- [x] Opening, closing and switching sections keeps the Base UI height animation; reduced motion remains supported.
- [x] Flat and grouped Full Mode lists scroll through modal content; their last option is reachable.
- [x] Short lists and the leading None option have no fixed 185px minimum height.
- [x] Opening, filtering and resizing lists preserves viewport height, canvas and footer.

## Blocked by

None - can start immediately.

## Validation

Chrome: 54 combinations across nine viewports, three section counts and two open-section positions; 18 flat, grouped and cabinet-style grid combinations across six viewports; last-card reachability; frame-by-frame opening and closing; switching sections; resizing from a scrolled short viewport; changes to preceding content; natural short-panel height; reduced motion; outer scrolling on pages without an accordion. Full Mode, natural None height and empty loading grids were verified in the preceding audit fix. Five adaptive-layout tests cover height reservation, resize fallback, section changes, header resizing, cleanup and use outside the configurator.
