# Tricot client feedback — evidence (2026-10-28)

Client source: "Modular Build – Dev Feedback", Tricot (vessel Delete; Cabinet Color price filter; step order and Faucet Details; Wood Veneer loading).
All runs are read-only: write-guard and collections no-cache on every navigation; Summary auto-save POSTs are blocked and listed in each `*-guard.txt`.

## Staging baseline (before the change, bundle `index-B-mLU0_Q.js`)

| Folder | What it shows |
|---|---|
| `pricefilter/`, `pricefilter-full/` | Standard $ = 1 (Latte), Classic $$ = 19 LACM and 0 WDV; the full-mode probe there did not read the dialog (count 0) |
| `vessel-explore/`, `vessel-delete/` | Tricot vessel Delete skipped as `no-translation`; colour re-applied; price unchanged $6,572; the scene removes the vessel when called directly |
| `vessel-diff/` | Class has the same defect |

## Local dev after the change (`localhost:5173`, uncommitted working tree)

| Folder | Scenario (`docs/ai/qa/scenarios/tc/`) | Result |
|---|---|---|
| `local/pricefilter/` | `LOCAL-TRICOT-pricefilter.json` | grid and full mode: 23 / Standard $ 20 LACM / Classic $$ 3 WDV |
| `local/steps-prebuilt/` | `LOCAL-TRICOT-steps-prebuilt.json` | Models > Finishes > Countertop & Basin > Accessories > Faucet Details > Summary; Faucet Holes 0–3, 0 chosen; Summary "Faucet Holes 0 $0.00" |
| `local/steps-custom/` | `LOCAL-TRICOT-steps-custom.json` | same order from the Cabinet Builder |
| `local/vessel-delete-run1-before-fanout/` | `LOCAL-VESSEL-delete.json` | first fix only: vessel removed in the scene but price unchanged (the sink base kept its own basin) |
| `local/vessel-delete/` | `LOCAL-VESSEL-delete.json` | Tricot $6,572 → $5,122, Class $6,197 → $4,747; Undo/Redo restore |
| `local/wood-veneer/` | `LOCAL-TRICOT-wood-veneer.json` | local and staging: all 3 WDV render wood; WDV enables Cannete/Twill/Gessato/Satin, LACM only Loden |
| `local/firefox/` | `LOCAL-FIREFOX-tricot.json` | step nav in the new order; price filter not reachable by the Firefox harness; the MCP Firefox renders no 3D scene |
| `local/groove-pricefilter/` | `LOCAL-TRICOT-groove-pricefilter.json` | after `HandleGrooveColor: { LACM: 1 }`: Handle Groove Color Price offers only Standard $, 20 / 20 in grid and full mode; Cabinet Color still 23 / Standard $ 20 / Classic $$ 3; no writes, 0 console errors |
| `local/countertop-vessel-pricefilter/` | `LOCAL-TRICOT-countertop-vessel-pricefilter.json` | Countertop Color by the GB block: Price = Standard $ / Classic $$ / Exclusive $$$$; 71 = 1 (Matte White 8cm) + 41 (40 glass + Matte White) + 29 (HPL, Porcelain), grid and full mode; no writes, 0 console errors. Vessel Color not reached: it appears only after a vessel sink is picked (`31-34` = `NO TRIGGER`); the follow-up `LOCAL-TRICOT-vessel-pricefilter-followup.json` (Plaza) did not run — Chrome DevTools connection not approved twice |

Screenshots are copied from the Chrome MCP temp folder by the scratchpad helper `collect_shots.py` (the server refuses paths in the repository).
