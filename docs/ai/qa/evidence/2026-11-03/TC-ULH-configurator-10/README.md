# Urban Low Height on configurator 10 (2026-11-03)

Request: read the Urban Low Height materials from `GET /configurators/10?view=full&serialize=true` instead of configurator 4.

Status: the switch works. Open: the SKU of `Matte White`, and the questions below. Not deployed by this work; see "State of the branches".

## Code

`manifest.json`, `product-profile.json`, `sku-profile.json`, `runtime-bindings.json` (30 countertop overrides, as Tricot's), the recorded `configurator-10.json`, tests and docs. Commit `696271ff`, made and pushed by the repository owner during the run.

## Browser

Chrome headless, temporary profile, software WebGL, every non-GET request blocked (none was attempted), Summary not opened. Local dev build of `988fe5d9`. Scripts: `ulh10-*.cjs`.

| Check | Result |
|---|---|
| Configurator requested | ULH 10, USH 4 |
| Countertop, desktop, prebuilt | 89: Fenix 9, HPL 26, Porcelain 53, Technolite 1 (`01`) |
| Material filter | Fenix, HPL, Porcelain, Solid Surface; no Lacquered, no Glass (`02`) |
| All 89 colours picked (`countertop-sweep-89.json`) | none refused, cabinet stays, scene wears the expected material; 87: material and code in the SKU equal the configurator's. `Bianco Male TFA` is the preset's start, so a click asks no price; its SKU was seen on load. `Matte White`: below |
| Cabinet Color | 232; `Blu Pavone A6 GL`: `…CAB-LACG-A6-HDL-LACG-A6` $1,901, in the scene |
| Handle Groove | None + 232; `Castagno Malto 1C2`: `…HDL-3D-1C2` |
| Towel Bar | 5, each with Preview; `VAN-URTWLBR-STB/L-15.7W-1.4H-2D-LACM` $380 (`03`) |
| Vessels, 80 cm Sink Base | Blade 11 ceramic 5, Urban Modo solid surface 2, Acquarius Tekorlux 54; `VES-BLD11-X-19.7W-6.1H-15D-CER-OCB` $1,235, `VES-URMOD-X-19.7W-5.5H-13D-SS-T1D` $2,805, `VES-ACQS-X-18.9W-5.5H-13.4D-SSTKR-BD` $2,409 (`05`) |
| Six presets against an export of `e2bcfde5` on configurator 4 (`presets-vs-configurator-4.json`) | same totals, same SKUs: 24", 42", 59", 73" Multi-Level, 95", 99" |
| USH against staging | same: 233 colours, $6,744, same SKUs |
| Mobile, 390x844 | 89, no horizontal overflow, Towel Bar 5 with Preview (`06`) |
| Custom flow | 89; `Calacatta 259`: `CT-URHPL-INTG-23.6W-.5H-19.7D-HPL-259` $1,063, in the scene (`07`) |

The React warning about two children with the same key appears in both builds.

## Commands

`npx vitest run` on `988fe5d9`: 4620 tests, 4588 passed, 19 failed, 13 skipped; the 19 are all among the 20 that failed before this work on `48a836d5`. `npm run tsc`, `npm run build`: pass. `npx eslint` on the 14 changed TypeScript files: pass.

Prettier: three lines of mine in `ownMaterialConfigurators.test.ts`, `urbanLowHeightSkus.test.ts` and `collectionPricing.test.ts` are not formatted. A fix was on disk and is gone from the tree; not re-applied.

## `Matte White`: BLOCKED

It works in the browser: `Solid Surface Matte White` in the scene, Ocritech basins, the same 3/8" and price as `Matte White TD1` on configurator 4 ($4,478 for the 24" model). All six basins at 80 cm: $1,634.

Its SKU has no oracle: `CT-URSSOCR-INTG-23.6W-.4H-19.7D-SSOCR-White`. The material comes from the basin and the code from the end of the name (`extractColorCode`). Configurator 10 says `SSTL` and `MW`; `CT-URSSTL…SSTL-MW` has no price. The server does not check the code. The ULH price list has no countertops.

## Questions for the product

- `Matte White`: which material and code does its SKU carry?
- `Gloss White`: no SKU in configurator 10, so not offered.
- 29 HPL and Porcelain colours the master file does not name: offered, as the configurator lists them. No document decides.
- No colour leads to these basins any more: `Top_Glass_Nettuno`, `Top_Glass_Ovale`, `Top_Mineralmarmo_Diamond`, `Top_Tekorlux_Syntesi`, `_Quadra`, `_Rectangular`, `_Ron`, `_Trip`, `Top_Tekormud_Tivi`. They stay in the profile. The product map's Solid-Surface basin is Rectangular; `Matte White` gets Ocritech's.
- The grid titles `Matte White` Technolite (its `GBMaterial`), the filter says Solid Surface.

## Not checked

- Restoring a configuration saved with a colour configurator 10 does not have (Tekorlux, Glass, Tekormud, Ocritech): it needs a stored configuration, and writing one is a backend write.
- Firefox. Summary and PDF. A deployed build as the acceptance target: staging answered manifest 10 after the merge, and was not re-run in full.

## Notes

- An empty scene and $0.00 at 16:28:50 (`Matte White`, sample run): 21 s after Vite reloaded the page for the merge `988fe5d9` at 16:28:29. Not reproduced in three chains and the sweep.
- A first pick up to about 20 s after a preset opened was lost in three local runs, on software WebGL, and in none after 30 s. Cause not established; it may be the known preset load race.
- `excludedMaterialFilterTokens` stays in the profile; the ULH colour step does not read it.
- `skills/hastings-ulh/SKILL.md:13` still names remote id 4 (team guidance, not edited).

## State of the branches

`696271ff` is in `origin/phase2/ui-fixes`, `origin/phase-2/staging` and `origin/phase-2/production` (merge `e3bba586`). None of those were pushed or merged by this work. Whether production serves it was not checked.
