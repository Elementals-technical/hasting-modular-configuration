# Solid Surface types in Class, Mako and Tricot (2026-10-30)

Question: do Technolite and Technomat work the same in Class, Mako and Tricot? Change under test: `nestGbMaterials` + `filterOptionsByMaterialTree` (see `../tricot-solid-surface/README.md`). Live configurators 8 (Class), 9 (Mako), 12 (Tricot) all give Matte White `GBMaterial: Technolite` (SSTL, codeColor MW) and Matte White 8cm `Technomat` (SSTMT, codeColor MW).

Local dev `localhost:5173`, working tree with the change, Chrome through one `mcp-smoke.mjs --serve` session; write-guard and collections no-cache; no writes blocked or attempted; 0 console errors in each run. Scenarios `docs/ai/qa/scenarios/tc/LOCAL-GB-solid-surface-<collection>.json` (prebuilt flow, Countertop & Basin step, default model). The first Tricot and Mako attempts could not reach Chrome (no DevToolsActivePort yet) and were rerun. Tabs other than localhost are redacted.

| Check | Tricot | Mako | Class |
|---|---|---|---|
| Material menu | HPL, Porcelain, Solid Surface ›, Glass › | Fenix, HPL, Porcelain, Solid Surface ›, Glass › | HPL, Porcelain, Solid Surface ›, Glass › |
| Solid Surface opens to | Technolite, Technomat | same | same |
| Technolite | Matte White, group Technolite | same | same |
| Technomat | Matte White 8cm, group Technomat | same | same |
| Solid Surface (header) | both, groups Technolite, Technomat | same | same |
| Available | both | both | both |
| Chosen on the default model | neither | Matte White (Technolite) | neither |
| Price with the Solid Surface header | Standard $: Matte White 8cm; Classic $$: Matte White; Exclusive $$$$ offered, empty | same | same |
| Full mode: Technolite / Technomat / header | as the grid | same | same |
| Glass header / no filter | 40 / 71 | 80 / 170 | 40 / 71 |

The same holds at code level on the live data (`resolveConfiguratorOptions` → `nestGbMaterials` → filter tree, scratch run). Difference between the collections: only their catalogs (Mako has Fenix and twice the glass colours) and Mako's default countertop, Matte White. The Price menu lists every tier of the field, not of the material picked (existing behaviour), so Exclusive $$$$ is offered with the Solid Surface header and shows nothing.
