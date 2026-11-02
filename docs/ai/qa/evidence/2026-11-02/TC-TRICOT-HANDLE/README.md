# One-value Handle selector in the builder (2026-11-02)

Client feedback (dev-feedback image63, R-TRICOT-CAB-005, same rule R-LAME-CAB-003): a product with one handle has no handle choice.

Cause: `RightCabinetStyleSidebar` hid the selector only with no handles, and `handleRule` returns the collection's whole catalog, so one handle drew a selector with one value. `playerMenuCatalog` required only that the attribute exists.

Fix: `selectHasChoice(profile, attributeId)` in `productProfileSelectors.ts`, read by the sidebar (selector and picture) and by the player menu (`requiresChoice` on `handle-style`). `handlesDisabled` is unchanged, so the cabinet still records its handle for the SKU.

Chrome 156, own tabs, write-guard + no-cache, 0 blocked writes, Summary not opened. Custom flow on the default model, reached through Create Your Own. Scenarios: `docs/ai/qa/scenarios/tc/LOCAL-HANDLE-choice-*.json`.

| Folder | Panel | Details menu |
|---|---|---|
| `before-p98qb-tricot` (`index-BJOaxqLf.js`) | Width, Depth, Handle, picture | Cabinet Style, Handle Style > Upper Groove, Cabinet Pattern, Accessories |
| `after-local-tricot` | Width, Depth | Cabinet Style, Cabinet Pattern, Accessories |
| `after-local-lame` | Width, Depth | Cabinet Style, Accessories |
| `after-local-urban-duplex` | Width, Depth, Height, Lateral Panel | Cabinet Style, Lateral Panel, Accessories |
| `after-local-ush-control` | Width, Depth, Handle, picture | Cabinet Style, Handle Style > 3 handles, Accessories |

Tricot: `Handle` stays `UG`; SKU `VAN-TRIC-SB/1DW/SAT-23.6W-15.7H-20.5D-CAB-WDV-932-HDL-LACM-407` and $8,216 are the same before and after.

Not verified: deployed builds (no fix yet), mobile layout, prebuilt flow's menu (its Details has no Handle Style in the code), Firefox, choosing a handle in the USH browser run (covered by `heightSelection.test.tsx` for ULH).
