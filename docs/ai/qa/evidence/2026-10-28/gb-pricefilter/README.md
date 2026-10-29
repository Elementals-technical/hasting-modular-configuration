# GB collections — Price filter by Material Pricing Tiers, GB block (2026-10-28)

Source: client 'list material' > Material Pricing Tiers, GB block (sha256:7e27b55e, modified 2026-10-27). Decision K-CTML-014 (dev, 2026-10-28): the block applies to every colour field of Tricot, Lame, Mako and Class; materials outside it keep the shared Azzurra table.

Local dev `localhost:5173`, uncommitted working tree, Chrome MCP through one `--serve` session; write-guard and collections no-cache on every navigation; no writes blocked or attempted; 0 console errors in every run. Scenarios: `docs/ai/qa/scenarios/tc/LOCAL-GB-pricefilter-<collection>.json` (grid only; Tricot also picks the Vessel style and the Plaza sink).

| Collection | Section | Shown | Price tiers (count, groups) |
|---|---|---|---|
| tricot | Cabinet Color | 23 | Classic $$ 20 Lacquered MT; Specialty $$$ 3 Wood Veneer |
| tricot | Handle Groove Color | 20 | Classic $$ 20 |
| tricot | Countertop Color | 71 | Standard $ 1 (Matte White 8cm); Classic $$ 41 (Glass GL/MT, Matte White); Exclusive $$$$ 29 (HPL, Porcelain) |
| tricot | Vessel Color (Plaza) | 92 | Classic $$ 20 Lacquered MT; Specialty $$$ 72 = 20 Lacquered GL + 52 Tekorlux (all 52 unavailable for Plaza) |
| lame | Cabinet Color | 40 | Classic $$ 20 LACM; Specialty $$$ 20 LACG |
| lame | Handle / Leg Cap / Undertop Color | 22 each | Classic $$ 20; the 2 Metal colours have no tier (hidden under any Price) |
| lame | Countertop Color | 70 | Classic $$ 41; Exclusive $$$$ 29 |
| mako | Cabinet Color | 40 | Classic $$ 20 LACM; Specialty $$$ 20 LACG |
| mako | Handle Color | 22 | Classic $$ 20; 2 Metal without tier |
| mako | Countertop Color | 170 | Standard $ 1; Classic $$ 81; Exclusive $$$$ 88 (Fenix, HPL, Porcelain) |
| class | Cabinet Color | 68 | Standard $ 12 Laminate; Classic $$ 21 (LACM, Smoke Glass); Specialty $$$ 20 LACG; Exclusive $$$$ 15 Porcelain |
| class | Cabinet Side Color | 52 | Standard $ 12 Laminate; Classic $$ 20; Specialty $$$ 20 |
| class | Frame Color | 20 | Classic $$ 20 |
| class | Countertop Color | 71 | Standard $ 1; Classic $$ 41; Exclusive $$$$ 29 |

Not reached: Vessel Color of Lame, Mako, Class (shown only with a vessel top), Mako Leg Color (not shown on the default model) — covered by `cabinetColorPriceTiers.test.ts` only. The live configurator 12 has 52 Tekorlux vessel colours that the recording of 2026-10-09 lacks; live Mako shows 170 countertop colours against 73 recorded.

First Lame/Class runs opened new tabs that failed (navigation timeout, tab lost); the rerun reuses the agent's own tab.
