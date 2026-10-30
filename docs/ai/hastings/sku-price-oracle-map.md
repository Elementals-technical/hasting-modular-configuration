# SKU / price oracle map

Independent oracle for SKUs and prices the configurator shows. Rows, anchors and code paths: [`sku-oracle.csv`](sku-oracle.csv) (`O-<FAMILY>-<NNN>`). Sources: client workbooks exported 2026-10-28 in `normalized/` (anchor `<source_id>!<sheet>!R<row>`). Recorded API answers in `src/shared/lib/pricing/__tests__/fixtures/prices/` are a secondary oracle for their exact SKUs only. Built read-only; the live API was not called.

## How to verify a SKU/price in a UI test

1. Record the UI selection (family, cabinet type/drawers/handle/fluting, W/H/D cm, colours, countertop style/thickness/basin, accessories).
2. Read the SKU sent: DevTools Network `GET …/pricing-v2/resolve?sku=…[&widthCm=…]` (one request per distinct SKU; Summary shows the same line SKUs).
3. Match the SKU to a CSV row by `sku_pattern`, then drop the material block (`-CAB-…`, `-BASP-…`, `-CABF-…`): the workbook row key is the base SKU. Sizes are inches (cm ÷ 2.54, 1 dp, trailing `.0` dropped, except UD `22.0H/20.9H/15.0H/11.0H`).
4. Expected price = the literal cell in `price_example`/`source_anchor`, column chosen by material (USH/UD/UFS: 3D, White GL/MT, LACM, LACG, ST, BM, HPL, ESS; Class: CABF material + `/B|/C`). Use US columns only (Countertops note E4).
5. Countertop tops and covers are per cm: compare the response `metadata.pricePerCm` with the workbook rate (USH CounterTopPrice col E, GB CountertopPricing col F) and `widthCm` with the composition; a total is an oracle only when the workbook states it (Class `I19:I27`) or a fixture recorded that SKU+width.
6. Multiply by line quantity (basin/HCUT per sink base, side panel per active side, divider per placement) before comparing the total.
7. No row, empty cell, `-` or a `BLOCKED` row → result `BLOCKED`, never PASS.

Tolerance: none is documented in the workbooks. Fixtures show integer answers: table cells rounded (2700.250784 → 2700, 607.6878283 → 608) and per-cm tops consistent with ceil(pricePerCm(3 dp) × cm) (19.042 × 202 → 3847). Treat a ±1 USD difference as `UNKNOWN` (backend rounding), anything larger as `FAIL`. An API `matchedSku` different from the base SKU (fuzzy size match) is not an oracle match.

## Per-family oracle table

| Family | SKU source | Price source | Coverage | Blocked |
|---|---|---|---|---|
| USH | CabinetsPrice rows (no SKU Structure sheet); BasinStylePrice A1 thread | CabinetsPrice, CounterTopPrice (/cm), BasinStylePrice, AсcessoriesPricing (Cyrillic `с` in sheet name) | cabinets, fluting, OS/OSS, top, basins, HCUT, FAHO, UCUT, side panel, divider, towel bar, book matching | vessels (external sheets), 40 cm open shelf, non-LACM fluting |
| ULH | none for cabinets | USH workbook for top/towel bar/side panel; CounterTopPrice R31–R47 for cover | cover rate only | cabinets, UROS-1S, side panels at ULH heights |
| UD | SKU Structure, SKU Curation, Pricing | Pricing; USH for OS/OSS/top/accessories | SB/SC L/R all heights | UROS-1S, SC 25/35/50 cm, SC 2DW 46D, SC 1DWL 15.0H 46D |
| UFS | SKU Structure, SKU Curation, Pricing | Pricing; USH for top/accessories | SB/SC 2DW, fluting (LACM), UROS-3S, UROSS | SC/1DW short cabinet, side panels, dividers |
| CLASS | SKU Structure, SKU Curation, CabinetPricing | CabinetPricing, CountertopPricing (/cm), Basin StylePricing, AccessoriesPricing | cabinets, top, basins, bracket, HCUT, FAHO, organizers | vessels IRIS/FRM/PLZ |
| TRICOT | SKU Structure, SKU Curation, CabinetPricing | CabinetPricing; Class for top/basin/accessories | cabinets, side panel | vessels |
| MAKO | SKU Structure, SKU Curation, CabinetPricing | CabinetPricing (incl. legs); Class rates, thin only | cabinets, legs, top, basins | LACG legs (`-`), vessels |
| LAME | — | — (top/basin via Class per Tricot CabinetPricing R12) | top/basin only | cabinets, legs, leg cap, undertop |

Fixture cross-check: 26 of 28 recorded answers equal a workbook cell (cabinets, legs, basins, HCUT, FAHO, side panel, divider, towel bar, organizer) or its per-cm rate (tops: `pricePerCm` 19.042 / 15.3 / 13.11). Disagreements: `VAN-UROS-2S-15.7W-20.9H-19.7D…` = 729 via `matchedSku` 19.7W-22H (no 40 cm row); `VES-URMOD-X-19.7W-5.5H-13D` = no price (no oracle). `tricot-cabinet-workbook.json` is a workbook copy: 137/137 equal the sheet.

## Mismatches found (code vs workbook)

1. **USH basin separator** — workbook agreed `CT-URPOR-COVER/.5H-CT-POR-TR2` (BasinStylePrice R1 thread; J16, J22); code `CT-UR{mat}-{BASIN}-{T}H-{mat}-{code}` (`src/shared/lib/sku/buildCountertopSku.ts`). API accepts the dash form (fixture 2700). O-USH-011.
2. **Mineralmarmo code** — code `SSMMO` → `CT-URSSMMO-HCUT/-FAHO/n`; AсcessoriesPricing R3/R12 `CT-URSSMO-…`, BasinStylePrice J34 `SSMLM` (`countertopSkuMaps.ts`). O-USH-014.
3. **Syntesi basin** — workbook `SYN` (J56), code `SYNT`; code drops the basin line; workbook flat top+basin price by width is flagged "incorrect" (H108/H109). O-USH-012/013.
4. **Undermount cutout** `CT-UR{SSTM|SSTKR}-UCUT` (R48–R49) not built anywhere in `src/`. O-USH-017.
5. **Thickness keys** — code `.4H` for 0.375/0.4; workbook thin Porcelain 3/8" vs 0.5 and Glass 0.4 vs 0.5 across sheets. O-USH-010.
6. **Open side shelf height** — USH rows only 19.7H; code sends the cabinet height (USH/UD), relying on API fuzzy match. O-USH-007, O-UD-005.
7. **UD open shelf 1S height** — code `15H/11H` (`cmToInches` drops `.0`), UD Pricing/Pre-Render `15.0H/11.0H`; no 1S price exists. O-UD-004.
8. **UD element #3** — SKU Structure R7/R25 `HDL`, Pricing examples `HNDL`; code `HNDL` (`public/collections/urban-duplex/sku-profile.json`). O-UD-001.
9. **UD low cabinets** — workbook R144 15.0H = 2168 vs tall R51 = 3031; profile note says the API prices 15H/11H as 20.9H (backend). O-UD-002.
10. **Class 2DW height** — workbook rows write `52H` in inch SKUs; code/API `20.5H` (prices agree). O-CLASS-002.
11. **Lower countertop/cover** — workbook cover materials 3D/LACM/LACG/ST/BM/ESS, VES, 19.9D, 0.4 table thickness; code: Upper palette (2026-10-28 decision), Upper style, nominal 19.7D/18.1D, .5H (`buildCabinetCoverSku.ts`). O-ULH-004.
12. **Book matching** for UD/UFS (Accessories Pricing R4 says reuse USH) not built in `buildCollectionPricingLines.ts`. O-UD-007, O-UFS-008.
13. **GB integer width** — 7/13 feedback (CountertopPricing R32): `63W` returned null; code emits `63W` for 160 cm. Re-check. O-CLASS-003.

## Blocked / unknown

- **Lame**: no SKU workbook; every Lame cabinet, leg, leg-cap and undertop price is `BLOCKED` (code cites a workbook not in the set).
- **ULH cabinets**: no ULH workbook in the set.
- **USH "Cabinets VAN-URSTD-SB (missing)"**: validity grid only (CG not offered for 1DW/1DWID), no prices — negative oracle (O-USH-002).
- **Vessels** (USH VES-…, Class/Tricot/Mako/Lame IRIS/FRM/PLZ): external sheets/table 542 not normalized.
- **Rows without price**: UD SC 25/35/50 cm, SC 2DW 46D, UROS-1S; UFS SC/1DW; side panels taller than 22H (UFS) or below 19.7H (ULH); Mako LACG legs; fluting outside LACM.
- **Quantities not in workbooks**: legs ×2, book matching per drawer, organizer per drawer, bracket ×2 per composition.
- **Tracker** (`file-pricing-tracker`): all vanities "In Client Testing", none client-confirmed (Analytics R15); UD "missing SKU data", Class "Need client clarification", UFS/Lame/Mako/Tricot and all countertop materials "Updates Needed".
- **Material Pricing Tiers** are qualitative ($–$$$$), not prices.
