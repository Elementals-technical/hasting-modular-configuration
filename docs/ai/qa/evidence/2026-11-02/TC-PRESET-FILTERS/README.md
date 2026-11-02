# Model filters built from the collection's presets (2026-11-02)

Tickets T-3 (Tricot), C-15 (Class), ULH-4: the Size and Style filters of the model page offered values with no model. Only the ticket titles were available.

Cause: `ModelPage.tsx` held one literal list of 8 sizes and 7 styles for every collection; the presets only filtered the cards. A value without a model, or a pair of values without one, showed "No preset compositions available for <collection>", the message meant for a collection with no presets.

Change: `src/entities/product/lib/presetFilters.ts`. `buildPresetFilterOptions` offers the values the collection's presets have and disables one that leaves no model with the other filter; `matchesPresetFilters` is the one rule of a match, also used for the cards. Decisions (user): values come from `presets.json`, not `ui.json`; a value empty with the other filter is disabled, without a hint.

Firefox (own profile), read-only, Summary not opened. Before: p98qb `index-BJOaxqLf.js`. After: local dev. Scenarios: `docs/ai/qa/scenarios/tc/LOCAL-PRESET-filters-*.json`.

| Folder | Size | Style | Result |
|---|---|---|---|
| `before-p98qb-*` | all 8 | all 7 | Multi-level (Tricot), 2 Drawer (Class, ULH), 24–29″ + Double Basin (Tricot): no model, the message above |
| `after-local-tricot` | no 90″+ | no Open Shelving, Multi-level | with 24–29″: 2 Drawer, Double Basin, Asymmetrical disabled (screenshot); Clear All brings the whole grid back, the model in the scene stays |
| `after-local-class` | no 90″+ | no 2 Drawer, Open Shelving, Multi-level | as expected |
| `after-local-ulh` | all 8 | no 2 Drawer | as expected |
| `after-local-urban-duplex` | all 8 | all 7 | control, unchanged |

Not verified: Chrome (the DevTools connection was not approved in time); 90″+ selected in the browser before the change (the click landed on a card under the list); clicking a disabled option in the browser (`FilterSelection` sets `disabled`); mobile layout; Mako, Lame, USH and Urban Freestanding in the browser (covered by the tests over every `presets.json`); deployed builds. The card count after Clear All was read from the screenshot, not counted: `get_page_text` returned empty files for some steps.
