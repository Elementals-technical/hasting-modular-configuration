# Class product profile v2

`product-profile.json` for the `class` collection, built from two documents on the `analysis/products-data` branch:

- `Class/docs/CLASS-MODULAR-LOGIC-UA.md` — section 0 (WebGL Scoping of 08.09.2026 and the GB countertop table) is the
  current rule set; sections 5–6 and appendix A hold the price workbook facts and the full Master File register.
  Where the two disagree, section 0 wins.
- `Class/docs/COLLECTION-LOGIC-UA.md` — the 2D frame of the Master File.

Only confirmed facts are in the profile. Nothing was taken from Urban Standard Height: Class has no handle choice, a
side and frame colour of its own, and its own drawer mixing rule.

## Colour catalogs are listed, not read from the configurator

The manifest points Class at configurator 4, tables 438 and 439. None of them holds Class data: the live
configurator 4 has no Class colour (`Grigio Argento 403`, `Rovere Caffe 967`, `Calacatta 259`) and no Class basin
(`LB440`, `Iris`). With `optionsSource: "configurator:…"` Class would show Urban colours. The profile therefore lists
every colour from appendix A: the value is the Master File key (`3DOptionValue`), the label its display label, and
the category its material group (`SelectionType`).

## What the profile declares

| Attribute | Scope | Values | Source |
|---|---|---|---|
| `CabinetType` | cabinet | `Sink-Base` (SB), `Sink-Cabinet` labelled Side Cabinet (SC) | CLS-WGL-001, CLS-XLS-001 |
| `Drawers` | cabinet | `1` (1DW), `2` (2DW), `1+inner` (1DWID) | CLS-XLS-004 |
| `Height` | cabinet | `40`, `52` | CLS-XLS-005/006/007 |
| `CabinetColor` | global | 108: Lacquered MT 20, Lacquered GL 20, Smoke Glass 1, Porcelain 15, Glass MT 20, Glass GL 20, Laminates 12 | A4, CLS-WGL-011 |
| `CabinetSideColor` | global | 52: Lacquered MT 20, Lacquered GL 20, Laminates 12 | A5 |
| `FrameColor` | global | 20: Lacquered MT | A6 |
| `CountertopStyle` | countertop | `integrated`, `vessel` | §0.8, CLS-XLS-015 |
| `CountertopColor` | countertop | 71: Solid Surface 2, HPL 14, Porcelain 15, Glass MT 20, Glass GL 20 | A7 |
| `sinkType` | basin | integrated: LB440, LB175, LB575, LB856, VA024, LV890, LV892, VA002, VA005, VA023; vessel: Iris, Frame, Plaza | A8, CLS-WGL-012 |
| `FaucetHolesAmount` | countertop | `0`–`3` | §0.8 (GB O5:O21), CLS-XLS-024 |
| `DividersStyle` | drawer | `Metal` (ROW-MTL-43), `Oak` (ROW-OAK-43) | CLS-WGL-014, §6.7 |

There is **no `Handle`**: the grip is part of the frame (CLS-WGL-003).

## Models (`presets.json`)

The 44 models of the Master File (appendix A1) with their titles, size buckets taken from the key suffix
(`_24` → 24–29″ … `_80` → 80–89″) and style tags (1-Drawer, 2-Drawer, Single basin, Double basin, Asymmetrical).
`Class 87 2DW 1_80` has no filter in the Master File (Q-CLASS-001), so its style list is empty and it appears only
under “All”. Compositions are empty: the documents give no model recipes (§6.8), so choosing a model builds nothing
yet. Picture paths follow the Urban naming (`images/Class Vanity 24_ 1-Drawer.png`); the files are not delivered yet.

## Rules

| Section | What it does | Source |
|---|---|---|
| `cabinetMatrixLegacyAdapter` | Required by the format; no handle columns | Table format |
| `drawerStyleGroups` | `[["1", "1+inner"], ["2"]]`: 2DW only with 2DW, 1DW may be mixed with 1DWID | CLS-WGL-004/005 |

No other section is declared: fluting, grain, book matching, side panels and Syntesi are not confirmed for Class, so
the collection behaves as one without them. `messages` holds only the texts of the command's own reasons
(`change.notAvailable`, `change.valueNotInCatalog`), `drawers.requiredHeight` and `product.missingData`: no declared
rule has a reason text of its own.

## Confirmed but not yet expressible

Listed in `excludedFromThisProfile`:

- **Height by style** — 1DW/1DWID 40 cm, 2DW 52 cm; a cabinet table row.
- **Widths and depth** — SB 60/80/100/120, SC 40/60/80/100/120, depth 52; cabinet table rows.
- **SB 60 / 1DWID not with Integrated** (CLS-WGL-006) — the profile has no width × style × countertop style rule.
- **Composition limits** — 220 cm, at most two SB, cabinets abut only (CLS-WGL-007/008/009).
- **Floating countertop** — thick countertops only (CLS-WGL-010).
- **Basin by material and minimum SB width** — 60 cm, 80 cm for VA023 (§0.8); needs Class countertop table rows.
- **Vessel cutout per SB, brackets** — order lines for D (CLS-WGL-013, CLS-XLS-022).
- **Faucet hole positions** — only the counts are confirmed.

## Not declared because the sources conflict or are missing

- **Thickness** — GB says 4″ where the price workbook says 4.7; .8 vs 3/4″, 3.1 vs 3-1/8″ (Q-CLASS-033/042).
- **Colour → SKU material** — CABF/CABS/FRM codes and the /B or /C price class (Q-CLASS-004/006/032).
- **Solid Surface** — `Matte White` / `Matte White 8cm` are not joined to SSTL/SSTM/SSTEX/SSTMT (Q-CLASS-016).
- **VA030** — priced for SSTEX, absent from the Master File (§6.6).
- **Vessel assets** — Iris, Frame, Plaza have no SKU, price, colour or asset (Q-CLASS-043).
- **Model filter of `Class 87 2DW 1_80`** is empty in the Master File (Q-CLASS-001) — matters for presets, not the profile.

## Not from the documents

- `Sink-Base` / `Sink-Cabinet` and `integrated` / `vessel` are platform values, as in Urban Standard Height.
  Urban Low Height writes the side cabinet as `Side-Cabinet`; the two collections should agree on one spelling.
- `sourceRefs` (4 / 438 / 439) come from the manifest and hold no Class data.
- Labels such as `1 Drawer With Inner Drawer`, `Metal`, `Oak` are UI wording.

## Blockers, by owner

| Owner | What is needed |
|---|---|
| Product | A Class configurator and Class rows in the cabinet and countertop tables; approved `defaults`; the colour → CABF/CABS/FRM code join and the /B, /C rule; model recipes for the 44 models; thickness decision; vessel SKUs and assets. Whether integrated basins are held back as undetermined until the countertop table has Class rows (one `undeterminedRules` entry, but it disables every integrated basin). |
| A | Load Class sources instead of 4 / 438 / 439. |
| B | Fields for Cabinet Side Color and Frame Color, no handle step, the vessel styles. |
| I | Scene bindings for the side and frame colour slots, the basins and the frame grip. |
| D | Class SKU grammar (three element blocks), cabinet price by CABF only, countertop per-cm rate, cutouts, brackets, faucet holes. |

## Evidence

`entities/collection/__tests__/classProfile.test.ts`:
- the profile validates and the manifest loads it;
- types, styles and heights match; there is no handle;
- colour counts per material group match appendix A, with the raw key kept apart from its label;
- 10 integrated and 3 vessel basins;
- no Urban value leaks in, only the drawer style groups are declared;
- the mixing rule refuses 1DW next to 2DW and allows 1DW next to 1DWID.
