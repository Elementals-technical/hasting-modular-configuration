# Urban Low Height product profile v3

`product-profile.json` for the `urban-low-height` collection, built from
`analysis/products-data/Urban Low Height/docs/URBAN-LOW-HEIGHT-PRODUCT-MAP-UA.md` (map dated 09.09.2026; re-checked
17.09.2026 against the map and the live configurator 4).

The map grades every fact as confirmed, inherited, inferred or undescribed. **Only the confirmed ones
are in the profile.** Nothing was copied from Urban Standard Height: where Low Height has no confirmed
rule, the profile simply does not declare it, and the collection behaves as a collection without that
capability rather than as USH. One exception, added on request: `CountertopStyle`, `sinkType` and `VesselColor` take
the Urban Standard Height options and pictures, although the map does not describe the choice and names other basins.

## What the profile declares

| Attribute | Scope | Values | Source |
|---|---|---|---|
| `CabinetType` | cabinet | `Sink-Base` (URLH-SB), `Side-Cabinet` (URLH-SC), `Open-Shelf` (UROS), `Open-Side-Shelf` (UROSS) | §1, four module types over 664 base SKUs |
| `Drawers` | cabinet | `1`, aliased `1D` / `1DW` | §2, every SB and SC is `1DW` |
| `Handle` | cabinet | `handle_urban_topcut` (Upper Groove), `handle_pto` (Push-to-Open); neither offers a groove colour | §2; §5 — the groove colour cannot be included yet |
| `Height` | cabinet | `38`, `35`, `28`, `25` | §2–3 |
| `DrawerPanelFluting` | cabinet | `None`, `Vertical A`, `Vertical B`, `Horizontal A`, `Horizontal B`, aliased to `X`, `CVA`, `CVB`, `CHA`, `CHB` | §4 |
| `CabinetColor` | global | no list — `optionsSource: "configurator:Cabinet Color"` | §5; the 232 values come from configurator 4 |
| `CountertopColor` | countertop | no list — `optionsSource: "configurator:Countertop Color"` | §11; the 61 values come from the same source |
| `CountertopStyle` | countertop | `integrated`, `vessel` — the options and pictures of Urban Standard Height | Not from the map: §11 lists Integrated/Vessel/Undermount as not described. Added on request; recorded only, the scene has no key for it |
| `sinkType` | basin | the 28 integrated basins and 5 vessels Urban Standard Height shows, and `Vessel` (shown as None) for a vessel countertop without a basin | Not from the map: §12 names Rectangular, Strip, Cover, Prisma and Quadra. Added on request; integrated basins are filtered by the shared table 438, and the value reaches every ULH Sink Base as in USH |
| `VesselColor` | basin | no list — `optionsSource: "configurator:Vessels"` | Added on request with `sinkType`; shown only for a vessel countertop |

Widths and depths (§3) are not in the profile: they are rows of the cabinet table, not product semantics.

## Rules

| Section | What it does | Source |
|---|---|---|
| `cabinetMatrixLegacyAdapter` | Required: which cabinet table columns carry types, drawers, handles and forced heights | Format of the table |
| `fluting` | Fluting is offered only for a Lacquer Matte (`LACM`) cabinet; no part is excluded | §4 — fluted SKUs are priced only in the LACM column. Side panels are not mentioned for Low Height, so nothing is excluded by part |
| `cabinetColorTraits` | Tells which material a cabinet colour belongs to, so the fluting rule can check it | §5 — the seven groups `3D`, `LACM`, `LACG`, `ST`, `BM`, `HPL`, `ESS` |
| `countertopFallbacks` | Hides the countertop materials Low Height does not have: Tekorlux, Tekormud, Glass MT, Glass GL. Their colours carry `Lacquered MT/GL` as material, so those two tokens are excluded too. No integrated-basin restriction is declared (`needsConfirmation: true`) | §11 — four materials: Solid-Surface, Fenix, HPL, Porcelain. Configurator 4 is shared with USH and offers nine |

`finishCodes` is empty: it drives the grain rule, and Low Height confirms no grain rule.

Fluting only on Sink Base and Side Cabinet needs no rule of its own: fluting is a drawer front option, and
open modules have no drawers.

The countertop exclusion becomes visible once table 438 has Low Height rows: until then the countertop page has no
Low Height basins to match.

Solid-Surface is not narrowed: the map names Gloss White / Matte White, and configurator 4 has both in Mineralmarmo
(TMO/TNO) and Ocritech (TD2/TD1).

## Models (`presets.json`)

The 59 models of the master file (§10) with their titles, size buckets and style tags; `Open Shelf` and
`Open Shelving` are one tag, and `Multi-level` was added to the style filter. Every model has its picture in
`images/`, checked against the SHA-256 in its Threekit URL.

Compositions come from `URBAN_LOW_HEIGHT_MODEL_PRESET_MODULES` (team, 25.09.2026; the map itself has no BOM, §15.7):
Sink Base, Side Cabinet and Open Shelf modules left to right, the price-list inches in centimetres (§3: 9.8″ → 25 …
47.2″ → 120). Every module stands at 38 cm with the upper groove (`handle_urban_topcut`) and 46 cm deep — the first
height and handle of the profile, and the depth the scene lays out — until the product names each model's height and
handle; cabinets carry the one drawer (`1D`). The six Multi-Level models hang at two wall heights, which the scene
cannot place yet, so they keep no composition. The `open_shelving` and `asymmetrical` tags now follow the compositions
(ids 13, 15, 22, 26, 32, 41, 59 corrected).

## Configurator 4 against the map

| Catalogue | Map | Missing or disabled in configurator 4 |
|---|---|---|
| Cabinet colours | 232 | 16: five 3D (`Pietra Piasentina Grigio Chiaro 1AA`, `… Scuro 1AB`, `Paulownia Seppia 1F2`, `Pelle Pecari Tortora 1PE`, `Rovere Sherwood Chiaro 1S1`) and the metallic colours in GL/ST |
| Countertop colours | 61 | 2: `Avenue Plumb TRB`, `Metal Grey TRD` |

## Confirmed but not yet expressible

Listed in `excludedFromThisProfile` with the section numbers:

- **Handle decides the height** — Upper Groove 38/28, Push-to-Open 35/25 (§2). Read from the cabinet table, which has no Low Height rows.
- **Open Shelf width depends on height** — up to 70 cm at 38/35, up to 120 cm at 28/25 (§3, §6). The table keeps widths and heights as independent lists; this needs split rows or a new rule.
- **Open Side Shelf sizes** — 15 cm wide, 35 or 25 cm high, 50 or 46 cm deep (§7). A table row.

## Not from the product map

- Attribute and handle identifiers (`Sink-Base`, `handle_urban_topcut`, `handle_pto`) follow the platform and the scene; the map names the handles UG and PTO. Confirm with I.
- The map confirms only `FlutingVerticalA → CVA` and `FlutingHorizontalB → CHB`; `CVB` and `CHA` follow the same pattern (§4 says their reading "follows from the Urban logic").
- The Lacquer Matte spellings in `eligibleMaterialAliases` cover how configurator 4 writes the material; configurator 4 is shared with Urban Standard Height.
- `sourceRefs` (4 / 438 / 439) come from the manifest; message texts are UI wording.

## Blockers, by owner

| Owner | What is needed |
|---|---|
| Product | Approved `defaults` (the profile ships `{}`); the height and handle of each model and the Multi-Level layout (the compositions came from the team, not the map, §15.7); which Solid-Surface (Mineralmarmo or Ocritech) Low Height uses; the 18 colours missing from configurator 4; the colour → price column map, including the separate `White GL/MT` column (§15.5); the groove colour structure (§15.4); confirmation whether `ProductID = USTD` is intentional (§15.2). |
| Product / A | **A cabinet table for Low Height.** Table `439` holds USH rows, with neither `URLH-SB/SC` nor the heights 38/35/28/25. Until Low Height rows exist, sizes, handle heights and shelf widths cannot be applied — and no cabinet can be placed. The manifest accepts a cabinet table only as a remote DataTable, so a local file is not an option without a change in A. **A countertop table for Low Height:** `438` has no Rectangular/Strip/Cover/Prisma/Quadra rows. |
| B | A colour step and the fluting field in `ui.json`; until then the fluting rule is in the data but not visible. |
| I | A scene product for Open Side Shelf: `runtime-bindings.json` places Sink Base, Side Cabinet and Open Shelf as `ULH-sink-cabinet`, `ULH-side-cabinet` and `ULH-Open-Shelf` and declares Open Side Shelf in `unplacedProductTypes`: its card is temporarily hidden in the builder until the scene has the product. With Product / A: table 580 lists the depth 50, but the ULH scene lays out 46 and 50.5 only. |
| D | SKU series and pricing inputs. Until they exist the collection shows "Price unavailable". Note: the map spells the open shelf `VAN-UROS-1S`, the USH builder writes `2S`. |

## Evidence

`entities/collection/__tests__/urbanLowHeightProfile.test.ts`: the profile validates without
diagnostics, the manifest loads it, every attribute matches the tables above, no USH value leaks in, and
only the confirmed rule sections are declared, and the countertop section hides exactly the USH-only materials. The fluting rule is offered for `LACM` with the five
variants, refused with its reason for every other group, and a real configurator colour (`3D`) resolves
to its material and is refused.
