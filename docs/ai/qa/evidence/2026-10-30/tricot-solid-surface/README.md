# Tricot countertop: Solid Surface header with Technolite / Technomat (2026-10-30)

Rule R-TRICOT-CT-003 (dev feedback: Solid Surface is a header, its two types Technolite and Technomat nested under it); K-CTML-035 decided by the user on 2026-10-30. Source of the types: the configurator's `GBMaterial`, which the user added to the API (`GET /configurators/12?view=full&serialize=true`): Matte White → Technolite (SSTL), Matte White 8cm → Technomat (SSTMT). Grid groups by type: the user's choice.

Change: `traits.gbMaterial` from the variant metadata (`buildConfiguratorOptions`); `nestGbMaterials` files a colour whose material is only a header of the material hierarchy under its GB material and adds that material to the header's children; the grid's Material filter reads the filter tree (`filterOptionsByMaterialTree`, as the full mode did), so a header keeps every colour under it. `traits.materials` is unchanged (the countertop rules read it).

Local dev `localhost:5173` (the user's running vite, working tree with the change), Chrome through one `mcp-smoke.mjs --serve` session; write-guard and collections no-cache; no writes blocked or attempted; 0 console errors. Scenario `docs/ai/qa/scenarios/tc/LOCAL-TRICOT-solid-surface-filter.json`. Tabs other than localhost are redacted from the saved outputs.

| Case | Shown | Groups |
|---|---|---|
| Material menu | Show all, HPL, Porcelain, Solid Surface ›, Glass ›; Solid Surface opens to Technolite, Technomat (`11-material-menu-1.png`) | — |
| No filter | 71 | HPL, Porcelain, Technolite, Technomat, Glass GL, Glass MT |
| Technolite | Matte White | Technolite |
| Technomat | Matte White 8cm | Technomat |
| Solid Surface (header) | Matte White, Matte White 8cm | Technolite, Technomat |
| Glass (header) | 40 (before the change: 0 in the grid, a header matched no colour) | Glass GL, Glass MT |
| Full mode: Technolite / Solid Surface | Matte White / both | as in the grid (`21-fullmode-1.png`) |

Control, Mako (`mako-control/`): the live configurator 9 also gives `GBMaterial` now, so Mako's Solid Surface is a header with Technolite and Technomat as well (2 colours); Glass header 80; no filter 170. The live configurators 8, 9, 14 (and 11, 13 with Technolite only) carry `GBMaterial`; 4 (USH, ULH) does not. Class, Lame, UFS, UD not opened in the browser.
