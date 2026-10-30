# Faucet Details hints for Class, Mako, Lame, Tricot (2026-10-29)

Change: `hints` on the `FaucetHolesAmount` field of `sections["faucet-holes-amount"]` in `public/collections/{class,mako,lame,tricot}/ui.json`, word for word as Urban Standard Height's: 1 → "Faucet hole placement to be specified at time of order."; 2 and 3 → "Faucet hole placement and spacing to be specified at time of order.". Client comment "Select Faucet Details Step" (pasted by the user; source document and revision unknown; backlog BV2-142 points to gdoc-1QB6Rx).

Browser: Firefox DevTools MCP (own profile), local dev `localhost:5173`, uncommitted tree. Chrome was not run: the Chrome DevTools MCP was not attached to this session and every new connection needs the user's approval. The step was opened by its direct link `/prebuilt/faucet-holes?collectionId=<id>`; Summary was not opened (it auto-saves to the backend; hints do not reach pricing).

| Collection | 0 | 1 | 2 | 3 | Evidence |
|---|---|---|---|---|---|
| Class | no hint | placement | placement and spacing | placement and spacing | `class-fresh/` |
| Mako | no hint | placement | placement and spacing | placement and spacing | `mako-*` |
| Lame | no hint | placement | placement and spacing | placement and spacing | `lame-*` |
| Tricot | no hint | placement | placement and spacing | placement and spacing | `tricot-*` |
| Urban Standard Height (baseline, unchanged) | no hint | placement | placement and spacing | placement and spacing | `urban-standard-height-fresh/` |

The hint is drawn under the swatches in the step's hint colour (`tricot-41-value-1.png`, `class-fresh/class-42-value-2.png`), as in the client's USH picture.

Scenarios: `docs/ai/qa/scenarios/tc/LOCAL-FAUCET-hints.json` (Class, Mako, Lame, Tricot, USH in one tab), `LOCAL-FAUCET-hints-class.json`, `LOCAL-FAUCET-hints-urban-standard-height.json` (fresh session each).

Notes:
- The interactive walkthrough opens on the first load of a Firefox session; Skip or Close sends the page to `/prebuilt/model`, so the fresh-session scenarios open the step link again. In the one-tab run the Class rows are invalid (the walkthrough covered the swatches, clicks did not land); Class was rerun in `class-fresh/`.
- One-tab run, USH opened right after Tricot: the step started with a hint already shown, and the clicks showed the hint of another value (`urban-standard-height-41-value-1.png`: 3 selected after clicking 1). Not seen in a fresh session (`urban-standard-height-fresh/`). Cause not investigated; USH `ui.json` was not changed.
- Console: no errors for Class, Mako, Lame, Tricot; USH shows PlayCanvas fragment-shader compile errors (`vNormalW` undeclared), scene-owned.
- Custom flow not run in the browser: the same `FieldsStepPage` and section serve `/custom/faucet-holes` (`CollectionStepRoutes.test.tsx`).
