# Empty filters left out (2026-10-30)

Request (user): the Look filter sometimes comes empty; hide an empty filter, universally. Live configurators name no Look for many fields (Tricot cabinet / groove / vessel, Lame, Mako, Class handle / leg / frame, every Urban vessel); UFS vessel names no Color either. Before: an empty filter still showed its button, whose menu never opened.

Change: `FilterItem` (every filter row: colour grids, full mode, USH countertop, model page) renders nothing when it offers nothing but All and holds no value; `FilterSelection` names its wrapper (`data-filter`); the three colour rows keep Price at the end by name (`[data-filter="Price"] { margin-inline-start: auto }`) instead of growing their third filter; `FilterRow` hides itself when every filter of it is left out (`:empty`).

Local dev `localhost:5173` (working tree), Chrome through `mcp-smoke.mjs --serve`, write-guard; no writes. Scenario `docs/ai/qa/scenarios/tc/LOCAL-empty-filters.json`. Distances in px from the row's left edge / to its right edge (row padding 20).

| Row | Filters | Price to the right edge |
|---|---|---|
| Tricot Cabinet Color (no Look in the data) | Material, Color, Price | 20 |
| Tricot Handle Groove Color | Material, Color, Price | 20 |
| Tricot Cabinet Color, full mode | Material, Color, Price | 20 |
| Tricot Countertop Color (23 colours with a Look) | Material, Color, Look, Price | 20 |
| USH Countertop Color (`MaterialFilterRow`) | Material, Color, Look, Price | 20 |

Console: one `[error] Failed to compile fragment shader` while the USH page loaded (PlayCanvas WebGL; the filters do not reach the scene); not investigated. A row with every filter empty does not occur in the live data, so `FilterRow:empty` was not seen in the browser.
