# GB block revision 2: Metal (MTL) in the Price filter (2026-10-30)

Source: client 'list material' > Material Pricing Tiers, revision 2 (`list material - Material Pricing Tiers (2).csv`, supplied by the user in chat on 2026-10-30; no Drive revision id). Against revision 1 (sha256:7e27b55e, 2026-10-27) the Azzurra block is unchanged and the GB block adds one row, R40 `Metal = MTL Tier 1 $`. Decision K-CTML-014 (GB block for every colour field of Tricot, Lame, Mako, Class) applies.

Change: `"MTL": 1` in `ruleData.priceTiers.bySku` of the class, mako, lame and tricot profiles; `cabinetColorPriceTiers.test.ts` pins it (GB block equality + Gold/Silver as Standard $ per Metal field).

Local dev `localhost:5173` (the user's running vite, working tree with the change), Chrome through one `mcp-smoke.mjs --serve` session; write-guard and collections no-cache on every navigation; no writes blocked or attempted; 0 console errors. Grid scenarios are `docs/ai/qa/scenarios/tc/LOCAL-GB-pricefilter-<collection>.json`, unchanged; full mode is `LOCAL-MAKO-metal-fullmode.json` (new). Tabs other than localhost are redacted from the saved outputs.

| Collection | Section | Price offered | Standard $ |
|---|---|---|---|
| mako | Handle Color (22) | Standard $, Classic $$ | 2 Metal: Gold, Silver (before: Classic $$ only, Metal hidden) |
| mako | Handle Color, full mode | Standard $, Classic $$ | Gold, Silver (`mako-fullmode/11-fullmode-standard-1.png`) |
| lame | Handle Color (22) | Standard $, Classic $$ | Gold, Silver |
| lame | Leg Cap Color (22) | Standard $, Classic $$ | Gold, Silver |
| lame | Undertop Color (22) | Standard $, Classic $$ | Gold, Silver |

Unaffected baselines, same as 2026-10-28: Mako Cabinet (Classic, Specialty) and Countertop; Lame Cabinet and Countertop; Class Cabinet, Cabinet Side, Frame, Countertop (Class has no Metal field); Tricot Cabinet, Handle Groove, Countertop (Tricot has no Metal colour).

Not reached: Mako Leg Color (not shown on the default model) — covered by the unit test only. Observation outside the change: Tricot Vessel Color (Plaza) now lists 40 colours (Lacquered MT/GL) against 92 on 2026-10-28 (52 Tekorlux then); cause not investigated.
