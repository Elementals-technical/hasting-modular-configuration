# TC-COUNTERTOP-WIDTH-REASON: acceptance log, 2026-11-05

- **Request:** a colour or basin tile refused for the Sink Base width says the width it would need, as the USH Vessel tile does. Wording and scope chosen by the user: `countertop.sinkBaseBelowMin`, colours and basins. The client has not confirmed the wording.
- **Build:** `localhost:5173`, HEAD `4e9ece4b` plus the uncommitted change, scene export v102 (staging has v105).
- **Controller:** Chrome DevTools MCP 1.12.0, Chrome 156, a new agent tab closed at the end of each scenario. The window changed between runs: 1920x907, 1920x873, 2000x869.
- **Scenarios:** `docs/ai/qa/scenarios/tc/LOCAL-WIDTH-REASON-class-tricot-ud.json`, `LOCAL-WIDTH-REASON-ush-ulh-mako.json`, `LOCAL-WIDTH-REASON-full-mode.json`.
- **Writes:** `write-guard.js` as `initScript`; `window.__blockedWrites` stayed empty in every scenario. Summary was not opened.
- **Driving:** cabinets placed by a pointer sequence on the scene's `.ap-plus-btn`, menu and swatch clicks are DOM clicks. Most hints are read after mouse events dispatched on the tile; three were checked by a real hover through the MCP `hover` tool, with a screenshot.

## Results

Text A: `Not available for current sink base width. Current 60 cm (23.6"), minimum 80 cm (31.5").`
Text B: `Not available for current sink base width. Current 60 cm (23.6"), minimum 70 cm (27.6").`

| Case | Before | Now | Evidence (`mcp-chrome/`) |
|---|---|---|---|
| Class SB 60, Matte White 8cm | `Not available for current cabinet width` | Text A, real hover; Matte White stays on | `class-tricot-ud/02`, `03` |
| Class SB 80 | available | available | `class-tricot-ud/08` |
| Class, Matte White 8cm + VA023 on SB 80, then SB 60 | colour refused, generic | colour and VA023 tiles say Text A; VA023 stays on both, as the task card of `58a2b2c6` sets aside | `class-tricot-ud/08` |
| Undo of that SB 60 | not compared | SB 80, colour and VA023 available | `class-tricot-ud/09` |
| Tricot SB 60, Matte White 8cm | `Not available for current cabinet width` | Text A | `class-tricot-ud/13` |
| Urban Duplex SB 60, HPL Strip 48 and Cover 50 | `This option is not available for the current selection.` by code and profile, not read from the screen | Text B, real hover on Cover; Prisma stays on | `class-tricot-ud/17`, `19` |
| Urban Duplex SB 60, Vessel | minimum 80 cm | unchanged | `class-tricot-ud/17` |
| USH SB 60, depth 19.9″, Glass and Mineralmarmo colours | `Not available for selected configuration` | Text B | `ush-ulh-mako/02` |
| USH, same, Material filter Glass | `Not available for current cabinet width` by code, not read from the screen | Text B | `ush-ulh-mako/02` |
| USH SB 60, HPL Strip 48 and Cover 50 | `Not available for selected configuration` | Text B, real hover on Strip at the right edge, not clipped; Prisma stays on | `ush-ulh-mako/04`, `06` |
| USH SB 60, depth 18.1″, Glass (refused for depth) | `Not available for selected configuration` | unchanged | `ush-ulh-mako/10` |
| Urban Low Height SB 60, Fenix Cover 50 | no width | Text B, from the rule's text: the profile has no message | `ush-ulh-mako/12` |
| Urban Low Height SB 60, colours | none refused | none refused: live configurator 10 has no glass | `ush-ulh-mako/12` |
| Mako SB 60 | nothing refused | nothing refused | `ush-ulh-mako/16` |
| C63, `LOCAL-C63-sink-landing.json` | see 2026-11-04 | same refusals and landings; the lift ends at 0.281 m, not 0.274, with the window size | `c63-control/` |

"Before" comes from the headless Chrome look of 2026-11-04, from the MCP runs of that day where they read the text, and otherwise from the code as noted.

## Full mode: the hint is not visible

In the Countertop Color full mode the tile has the right text in the DOM, but a real hover shows nothing (`full-mode/03`, `04`). Measured in headless Chrome with a real hover: the hint's element has `z-index: 3` from `.optionHint`, the popup's wrapper `z-index: 200`, and `elementFromPoint` at the hint's centre returns the tile's title below it. So in full mode every refused tile hides its reason, whatever the text. The value dates from `ecceea80` (2025-12-03) and this change does not touch it. Not fixed: owner frontend, the user decides.

## Not changed, by the plan

- A colour's refusal for the total length or the depth keeps its text on every screen; on USH those still read `Not available for selected configuration`, because that screen passes them without a code.
- Vessel basins under a refused style.

## Not run

Syntesi's exact sizes in the browser (live Sink Base widths match its list; unit test only), Urban Freestanding, Summary, Firefox, mobile and tablet, scene v105, real pointer input on the scene.
