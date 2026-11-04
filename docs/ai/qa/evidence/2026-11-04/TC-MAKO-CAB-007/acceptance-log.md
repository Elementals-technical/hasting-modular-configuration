# TC-MAKO-CAB-007: acceptance log, 2026-11-04

- **Client rule:** `R-MAKO-CAB-007`, `K-CTML-006` (G50 comes in Metal only).
- **Commit under test:** `d3d65a25` on `phase2/ui-fixes`, clean tree, scene export v102 (staging has v105).
- **Controller:** Chrome DevTools MCP (`chrome-devtools-mcp` 1.12.0, `--autoConnect`), Chrome 156, a new agent tab closed at the end of each scenario, viewport 1920x873. Firefox DevTools MCP 0.10.7 for the field only.
- **Target:** `localhost:5173`, Vite dev server of this checkout.
- **Writes:** `write-guard.js` as `initScript` in Chrome. `window.__blockedWrites` stayed empty except on Summary, where the automatic save (two POST `/modular/configurations/store`) was blocked. Nothing reached the backend from Chrome. Firefox has no guard and did not open Summary.
- **Driving the scene:** a cabinet is placed by a pointer sequence dispatched on the scene's `.ap-plus-btn`, and selected through the select tool. Menu clicks are DOM clicks. Scene values come from `ConfiguratorAPI.getConfig`; SKUs from an XHR recorder in the init script. `cabinets.getState` answers `UNSUPPORTED` on Mako.

## Results

| Case | Result | Evidence (`mcp-chrome/`) |
|---|---|---|
| G50 placed as the first cabinet | `HandleStyle` G50, `HandleColor` Silver, `…SB/2DW/G50-…-HDL-MTL-SLV`, $5,371 | `placement/02`, `03` |
| Handle Color with G50 | Metal: Gold, Silver; Silver selected; Material: Show all, Metal; Price: Show all, Standard $ | `placement/04`, `05` |
| Same, full mode | Gold, Silver; Material: Show all, Metal | `placement/06` |
| Gold, then Undo | `…HDL-MTL-GLD`, total unchanged; Undo back to Silver | `placement/07`, `08` |
| Side Cabinet joins a G50 + Gold composition | G50 + Gold on both, `…SC/2DW/G50-…-HDL-MTL-GLD`, $8,813 | `placement/09` |
| G50 to G57 through the player menu | popup, Confirm; G57 keeps Gold or Silver; field back to 22 | `placement/11`, `13`, `lacquer-switch/03`, `04` |
| G57 + Nebbia 402 under the Lacquered MT filter | 20 swatches, filter survives the pick, `…HDL-LACM-402` | `lacquer-switch/05` |
| G50 from that state, Cancel | nothing changes, no price request | `lacquer-switch/07` |
| G50 from that state, Confirm | both cabinets G50 + Silver; field Gold, Silver; filter reset, grid not empty | `lacquer-switch/08`, `09` |
| Undo, one step | G57 + Nebbia on both, 22 swatches, Nebbia selected | `lacquer-switch/10` |
| Redo | G50 + Silver on both | `lacquer-switch/11` |
| The same switch through the style sidebar | popup, Confirm; G50 + Silver on both | `lacquer-switch/12` |
| Third cabinet after that | G50 + Silver, not Nebbia (the stale config of the task card) | `lacquer-switch/13`, `14` |
| Select a cabinet, then the field | still Gold, Silver | `lacquer-switch/15`, `customize/09` |
| Model 20, Switch to Custom Mode, G50 | Antracite gives way to Silver on SB 60 and SB 80; Undo and Redo | `customize/04`–`11` |
| Prebuilt player menu | no Handle Style item; the handle changes only after Switch to Custom Mode | `prebuilt/04` |
| One-drawer G50, Duplicate | G50 + Silver, `…SB/1DW/G50-…-HDL-MTL-SLV`; the copy holds the same | `edges/11`, `12`, `13` |
| Every cabinet deleted, placed again | G50 gives Silver; G57 gives Antracite with 22 swatches | `edges/14`, `15`, `16` |
| Summary, G50 + Gold | gold long handles in the scene, line `G50`, `…$2,702`, total $5,371 | `summary/02`, `03` |
| Any `G50 … HDL-LACM` SKU requested | none, in every run | `lacquer-switch/08`, `13` |

Firefox, the same checkout: G50 chosen with nothing placed shows Metal: Gold, Silver, Material: Show all, Metal, Price: Show all, Standard $ (`mcp-firefox/g50-*`). G57 on model 20 shows 22; Silver requests `…G57-…-HDL-MTL-SLV` on both cabinets (`mcp-firefox/g57-*`). Firefox MCP cannot click inside the scene iframe, so nothing was placed there.

Controls (`mcp-chrome/controls/`): a Material filter survives picking a colour in Lame Handle Color (22 swatches, no Handle Style in the menu), Class Cabinet Color, Class Countertop Color and Tricot Cabinet Color. Opening another section of the accordion drops the filter, because a closed section unmounts its field.

## Prices

Repeating the app's GET returned 2702 for `SB/2DW/G50…HDL-MTL-SLV`, `…HDL-MTL-GLD` and `SB/2DW/G57…HDL-LACM-400`, 1679 for `SB/1DW/G50…SLV`, 2655 for `SC/2DW/G50…GLD`, each through `VAN/matrix`. This is what the API answers, not an oracle comparison: SKU and price stay `BLOCKED` against `docs/ai/hastings/sku-price-oracle-map.md`. The task card calls Silver "the only G50 colour with a recorded price"; that holds for the fixture, and the live API prices Gold too.

## Observed, not asserted

- The confirmation says only "The handle style will be updated for all drawer cabinets." A lacquered colour turns Silver without being named. Recorded as a decision in the task card; wording stays with `K-CTML-006`.
- Browser Back from custom G50 to the model step gives G57 + Silver: the model puts its own handle back and the colour stays. SKU, field and scene agree, and the pair is allowed (`back/03`, `05`).
- Summary has no handle colour line, for G50 at least; `HandleColor` does not appear in either Summary page and this branch does not change them (`summary/03`).
- `[Summary Share] Failed to generate configuration link` on Summary comes from the blocked save.

## Not run

Restore of a saved G50 + lacquered configuration (excluded by the task card; needs a stored configuration), Save, mobile and tablet viewports, the scene in Firefox, scene v105, G50 length by width (`R-MAKO-CAB-008`), real pointer input on the scene.
