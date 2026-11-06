# TC-CLASS-BAS-002: acceptance log, 2026-11-04

- **Client rule:** `R-CLASS-BAS-002`, with `R-USH-BAS-002`, `R-USH-BAS-007/008` for the other collections.
- **Commit under test:** `58a2b2c6` (the rules judge a composition by its narrowest Sink Base), as part of HEAD `d3d65a25`, scene export v102.
- **Controller:** Chrome DevTools MCP 1.12.0, Chrome 156, a new agent tab closed at the end of each scenario, viewport 1920x873, `localhost:5173`. Write guard on; `window.__blockedWrites` stayed empty. Summary was not opened.
- **Driving the scene:** cabinets placed through the builder and a pointer sequence on the scene's `.ap-plus-btn`. Menu and swatch clicks are DOM clicks.

## Results

| Collection, case | Result | Evidence (`mcp-chrome/`) |
|---|---|---|
| Class, SB 80 alone | Matte White 8cm on; picking it gives `Top_VA023`, the only basin, $5,283 | `class/09`, `10`, `11` |
| Class, SB 80 + SB 60, colour tried after | Matte White 8cm off, "Not available for current cabinet width"; a click changes nothing | `class/03`, `04`, `05` |
| Same, Matte White | LB440, LB175, LB575, LB856, no VA023, `Top_LB440` on both | `class/06` |
| **Class, reverse order:** Matte White 8cm + VA023 on SB 80, then SB 60 by "+" | **`Top_VA023` on both**, colour selected and shown refused, basin label greyed, `CT-GBSSTMT-VA023-3.1H`, `CT-GBSSTMT-INTG-55.1W-3.1H-20.7D`, $9,207 | `class/12`, `13`, `14` |
| Undo of that SB 60 | SB 80, colour on again, VA023, $5,283 | `class/15`, `16` |
| Urban Duplex, Strip on SB 80, SB 60 by "+" | `Top_HPLPrisma` on both; Strip, Cover and Vessel off; Prisma, Quadra on; $16,809 | `urban-duplex/06`, `07`, `08` |
| Urban Duplex, Vessel on SB 80, SB 60 by "+" | Integrated with `Top_HPLPrisma` on both; Vessel off | `urban-duplex-vessel/04`, `05` |
| Undo of that SB 60 | SB 80 with Vessel, $6,337 | `urban-duplex-vessel/06` |
| USH, SB 80, then SB 60 by "+" | all three Tekorlux basins stay on, `Top_Tekorlux_Rectangular` on both | `urban-standard-height/07`, `09` |

## Reverse order

The task card of `58a2b2c6` sets this order aside as a separate task, by the user's decision: with no other basin allowed, `useAvailabilityResets` keeps the basin. `docs/products/README.md` says the same. It is still `TC-CLASS-BAS-002-NEG`: VA023 stands on a 60 cm Sink Base and is priced. The screenshot `class/14` also shows a step at the right end of the 8 cm top; the top alone on SB 80 (`class/11`) has none. Whether the scene should draw that state is unknown, since the state is one the rule refuses.

## Console

Urban Duplex logs React's duplicate key warning for `/HastingCabinetsParametrization/index.html?v=041`, from `key={playCanvasSrc}` on siblings (`734eb5f0`). Class and USH log nothing.

## Not run

A lone SB 60 in Class, Summary for these states, SKU and price against an oracle (`BLOCKED`), Tricot, Lame, Urban Low Height and Urban Freestanding with two Sink Bases, the scene in Firefox, scene v105, real pointer input on the scene.
