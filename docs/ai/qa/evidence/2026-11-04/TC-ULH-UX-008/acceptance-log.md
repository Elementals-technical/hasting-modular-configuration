# TC-ULH-UX-008 / TC-ULH-CAB-009-POS: acceptance log, 2026-11-04

- **Client item:** `gdoc-1QB6Rx-dev-feedback#C63`.
- **Controller:** Chrome DevTools MCP (`chrome-devtools-mcp` 1.12.0, `--autoConnect`), Chrome 156, a new agent tab closed at the end, viewport 1920x873.
- **Scenario:** `docs/ai/qa/scenarios/tc/LOCAL-C63-sink-landing.json`, one fresh run; step outputs and screenshots in `mcp-chrome/`.
- **Build:** `localhost:5173`, HEAD `58a2b2c6` plus the uncommitted fix. "Before the fix" comes from a Playwright run on the same configuration, on HEAD `51f78ae5`.
- **Writes:** `write-guard.js` as `initScript`; `window.__blockedWrites` stayed empty. Summary was not opened.
- **Configuration:** `/custom?configId=15268&collectionId=urban-low-height`: Sink Base and Side Cabinet at 60 cm, 5⅛″ top of 1.717 m, Fenix Prisma 50 (`min_sb_cm` 60).
- **Driving the scene:** mouse events dispatched on the scene canvas for the lift and the drops; no scene setter is called. A cabinet is selected through the select tool; menu items are clicked in the DOM.

## Results

| Case | Before the fix | With the fix (`mcp-chrome/`) |
|---|---|---|
| Width menu of the Sink Base before the lift | 23.6–47.2″ | 23.6–47.2″ (`02`) |
| Lift by mouse | not run | SB becomes SC at 60 cm, top hosts the basin, the session closes (`03`, `04`) |
| Width menu of the new Side Cabinet | 9.8–47.2″ | 9.8, 13.8, 19.7, 23.6–47.2″ (`05`) |
| Prisma 50, SC 19.7″, drop on `fits` | SB at 50 cm, no message | no landing; pose and length as before the drag; message; same on a second drop (`06`, `07`, `08`) |
| Prisma 50, SC 19.7″, drop at the standard pose | SB at 50 cm | no landing; pose and length as before the drag; message (`09`) |
| Prisma 50, SC 9.8″, Position ▸ Standard | SB at 25 cm, no message | no landing; pose and custom length back; pose valid; message (`10`, `11`) |
| Width menu after that refusal | not run | 9.8–47.2″, so the cabinet can be widened (`12`) |
| SC 9.8″, top held at the standard pose | "A cabinet is inside the sink trap clearance zone…" | "The basin needs one cabinet wide enough for it."; Apply off (`13`, `14`) |
| Same, released | not run | no landing, no message; the scene takes the top back near its drag start (`15`) |
| Prisma 50, SC 23.6″, drop on `fits` | SB at 60 cm | SB at 60 cm, same basin; width menu 23.6–47.2″ (`16`, `17`, `18`) |
| Fenix Cover 50 (minimum 70 cm), SC 23.6″, drop on `fits` | not run | no landing; message "Current 60 cm (23.6"), minimum 70 cm (27.6")" (`22`) |
| Same, SC 27.6″ | not run | SB at 70 cm, keeps `Top_HPL/Fenix_Cover_Gres` (`24`) |

Message on a refused landing, title "Sink": `Not available for current sink base width. Current 50 cm (19.7"), minimum 60 cm (23.6").`

## Observed

- **Scene, not caused by the fix:** it announces a landing on one cabinet only once at an exact pose (`_landingAnnounced`, reset only when the sink's owner is the cabinet). In the two runs above with a drop exactly centred after an earlier refusal, no `sink-landing` came, and the top waited for Apply, which landed it (`16`, `24`). A pointer drop off that exact pose is announced again.
- **Undo after a landing** also took back the SC resize made before it. An exported copy of HEAD without the fix does the same.
- **Console:** one React warning, two children with the key `/HastingCabinetsParametrization/index.html?v=041`: `key={playCanvasSrc}` on siblings in `PlayCanvasIntegration`, from `734eb5f0` (2026-10-28), not changed here. Firefox shows the same.

## Firefox

Firefox 147 has no `evaluate_script` on this MCP, so the scene cannot be driven there. `LOCAL-C63-firefox.json` proves only that the build loads the configuration (`mcp-firefox/`). No TC of this log ran in Firefox.

## Not verified

- SKU, price and Summary.
- Urban Duplex in the browser; its rule is covered by a unit test on table 595.
- Save and restore, the client's recordings.
- Same handle and colours of the Side Cabinet after a lift.
