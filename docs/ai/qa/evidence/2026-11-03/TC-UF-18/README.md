# UF-18: two Towel Bar colours have no Preview (2026-11-03)

Ticket: title only, "UF: два кольори Towel Bar без Preview" (from the user; the body was not available, not found in the repository or the Drive connector). No client rule covers Preview; the expected behaviour is taken from the ticket title and the other three colours.

Status: diagnosed, not fixed. No application code changed.

## Cause

Frontend. `ProductOptionsGrid` gives a card its Preview button only if `isMaterial`, which reads `metadata.materials`, `metadata.colors` or `metadata.hex`. `buildTowelBarColorOptions` (`src/widgets/AccessoriesSections/lib/towelBarColorOptions.ts`) passes only `image`, `value`, `hex`. Metallizzato Copper M7 MT and Metallizzato Creta M6 MT have a picture and no hex in the configurators, so they are not `isMaterial`. The modal itself handles a picture.

Not a regression of the 2026-09-23 refactor: the option has the same shape in `25d3490f^` and in `c5591c3e` (2026-02-18), the commit that added Preview.

## Evidence

Browser: Chrome 156 headless, temporary profile (Playwright `channel: "chrome"`, software WebGL), `repro.cjs`. Every non-GET request is blocked (none was attempted); Summary not opened. Flow: prebuilt, first preset, Accessories, Towel Bar, Left.

| Run | Bundle | Viewport | Copper M7 / Creta M6 | Bianco / Carbone / Nero |
|---|---|---|---|---|
| `staging-uf-desktop` | `index-CctCEjO9.js` | 1600x900 | no Preview | Preview |
| `staging-uf-mobile` | `index-CctCEjO9.js` | 390x844 | no Preview, title shown | Preview, title hidden |
| `p98qb-uf-desktop` | `index-DjzzkwH3.js` | 1600x900 | no Preview | Preview |
| `staging-ush-desktop` | `index-CctCEjO9.js` | 1600x900 | no Preview | Preview |
| `staging-ulh-desktop` | `index-CctCEjO9.js` | 1600x900 | no Preview | Preview |
| `staging-ud-desktop` | `index-CctCEjO9.js` | 1600x900 | no Preview | Preview |

The pictures of both colours load in the card (`imageLoaded: true`; both URLs answer 200 `image/jpeg`). Screenshots: `staging-uf-desktop/02-hover-nero.png` (button on hover), `03-hover-copper.png` (none), `04-preview-nero-modal.png`, `staging-uf-mobile/01-towel-colours.png`.

Live data 2026-11-03, `GET /configurators/{11,13,4}?view=full&serialize=true`: the five towel bar variants have the same metadata in all three: hex for 0B, 43, 03; `image` only for M6, M7. Fixtures `configurator-11.json` and `configurator-13.json` match.

`component-check.txt`: a temporary test (removed; the tree stayed clean) rendered `ProductOptionsGrid` with `buildTowelBarColorOptions` on those live answers. As is: no button for the two colours in all three configurators. Control, the same options with `metadata.materials` added: all five have the button, and the Copper modal shows its picture. `npx vitest run`: 4 passed.

## Side effect of the same cause

`isMaterial` also sets `.materialOption`, which hides the title at 768 px and below. On mobile only the two metallics show a title, so the rows look uneven.

## Not checked

- Custom flow in the browser: it uses the same `useAccessoriesSections` (code only).
- Firefox: the Accessories accordion did not finish opening in the Firefox DevTools MCP window (DOM expanded, panel still closed on screen), the swatch click had no effect; no result from it.
- A fix in the browser: no fix was applied.
