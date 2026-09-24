# Mako collection v2

The `mako` collection: registry entry, manifest, `ui.json`, `presets.json` and `product-profile.json`. Built from two
documents on the `analysis/products-data` branch:

- `Mako/docs/MOCO-MODULAR-LOGIC-UA.md` — the product map (08.09.2026): WebGL Logic, the Mako price workbook and GB.
- `Mako/docs/COLLECTION-LOGIC-UA.md` — the 2D frame of the Master File with every value.

Only confirmed facts are in the profile. Nothing was taken from Urban or Class. Where the Master File conflicts with
the map, the map wins and the conflict is recorded.

## Package

| File | Content |
|---|---|
| `registry.json` | `mako` added after `class` |
| `mako/manifest.json` | label `Mako`, no defaults, local `presets` / `ui` / `productProfile` / `skuProfile` / `runtimeBindings`, remote 4 / 438 / 581 (Mako cabinet table) |
| `mako/ui.json` | same flows as Class: “Mako Models”, “Mako Cabinet Builder”, no sections yet |
| `mako/runtime-bindings.json` | how each Mako value reaches the scene (see below) |
| `mako/presets.json` | 42 models (Master File L2–L43), sizes from the key suffix, picture paths `images/Mako Vanity · 24_ 1-Drawer.png`. Compositions from `MAKO_MODEL_PRESET_MODULES` (team, 21.09.2026): Sink Base / Side Cabinet at 40–120 cm, height and drawers by style, depth 52, cabinet and handle colour `Antracite 400 MT` (configurator 9: `LACM`, colour code `400`; it replaced the scene material name `Antracite Matte OCF`, which configurator 9 does not offer and which left the cabinet SKU without its material block, 23.09.2026), legs in the cabinet colour (`LegColor: "None"`) on the Legs models, handle G57 — until the product names the models' handle. Basin and symmetry tags follow the compositions (ids 20, 29, 32, 37, 40, 41 corrected) |

## Colour catalogs are listed, not read from the configurator

The Mako palettes are the Class lacquer, glass, HPL and porcelain palettes, none of which is in configurator 4. The
profile lists every value from the Master File: the value is the raw key, the label its display label, the category
its material group. Mako glass keys have no `G` prefix, unlike Class (Q-MAKO-010).

## What the profile declares

| Attribute | Scope | Values | Source |
|---|---|---|---|
| `CabinetType` | cabinet | `Sink-Base` (SB), `Sink-Cabinet` labelled Side Cabinet (SC) | map §1 |
| `Drawers` | cabinet | `1` (1DW), `2` (2DW) | §2 |
| `Height` | cabinet | `26`, `52` | §2–3 |
| `Handle` | cabinet | `G57`, `G50`; no groove colour | §4 |
| `HandleColor` | cabinet | 22: Metal 2 (Gold, Silver), Lacquered MT 20 | §4, CSV L98–L119 |
| `CabinetColor` | global | 40: Lacquered MT 20, Lacquered GL 20 | §5 |
| `LegColor` | cabinet | 22: Metal 2, Lacquered MT 20 | §6, CSV L201–L222 |
| `CountertopStyle` | countertop | `integrated`, `vessel` | §8 |
| `CountertopColor` | countertop | 70: Solid Surface 1, HPL 14, Porcelain 15, Glass MT 20, Glass GL 20 | §7, CSV L120–L190 |
| `sinkType` | basin | integrated: LB440, LB175, LB575, LB856, VA024, LV890, LV892, VA002, VA005; vessel: Iris, Frame, Plaza | §9–10 |
| `FaucetHolesAmount` | countertop | `0`–`3` | §11 |
| `DividersStyle` | drawer | `Metal`, `Oak` | §13 |

## Scene bindings

The scene has two Mako products: `Mako-sink-cabinet` (with the sink Boolean cut-outs) and `Mako-side-cabinet`. The
profile keeps the product values; `runtime-bindings.json` says how each reaches the scene.

| Value | In the scene |
|---|---|
| `CabinetType` `Sink-Base` / `Sink-Cabinet` | placed as `Mako-sink-cabinet` / `Mako-side-cabinet` |
| `Handle` `G57` / `G50` | `HandleStyle` |
| `Drawers` `1` / `2` | `Height` 26 / 52, which lays the drawers out; legs hidden. The legacy `1D` / `2D` stays in the scene config for history and saved configurations |
| `Height` | 26 / 52 only |
| `Width`, `Depth` | as they are, in cm (the scene takes 40–120 and 52) |
| `LegColor` | no colour: legs hidden; a colour: legs shown in it. `None` shows them in the cabinet colour |
| `CabinetColor`, `HandleColor`, `CountertopColor` | as they are: the scene takes the exact material name |
| `sinkType`, `VesselColor`, `HandleGrooveColor` | recorded only: no Mako basin in the scene, no groove on Mako handles |

The scene does not have the Mako materials yet (it has `Antracite Matte OCF` only), so a colour is sent but not shown
until the scene adds it.

## Master File values left out

| Value | Why |
|---|---|
| `Matte White 8cm` | Mako has thin countertops only (§7, D-P0184) |
| `VA023` | Bound to the thick 3.1″ Technomat top (§9, GB row 14) |
| `VA030` | Confirmed by GB for SS Texturizzato but absent from the Master File (§9) — offered once the product list is fixed |

## Rules

| Section | What it does | Source |
|---|---|---|
| `cabinetMatrixLegacyAdapter` | Required by the format; height follows the style, not the handle | Table format |
| `drawerStyleGroups` | `[["1"], ["2"]]`: 1DW and 2DW cabinets are never mixed | §2, D-P0159–D-P0160 |
| `undeterminedRules` | `MAKO-LEG-002`: Leg Color on a one-drawer cabinet is held back as undetermined (`product.missingData`); nothing changes | §6, Q-MAKO-002 |

`messages` holds the texts of the command's own reasons (`change.notAvailable`, `change.valueNotInCatalog`),
`handle.notAvailableForCabinetType`, `drawers.requiredHeight` and `product.missingData`. No other declared rule has a
reason text of its own.

## Confirmed but not yet expressible

Listed in `excludedFromThisProfile`:

- **Legs only for 2DW** (§6) — the profile has no availability rule, and when Leg Color is shown is open (Q-MAKO-002).
  Until then a Leg Color change on a 1DW cabinet is blocked as undetermined (`MAKO-LEG-002`).
- **Height by style, widths** — 1DW 26 cm, 2DW 52 cm; SB 60–120, SC 40–120, depth 52; cabinet table rows.
- **Composition limits** — 220 cm, at most two SB, cabinets abut only (§3).
- **Integrated basin by material, SB ≥ 60 cm** (§7, §9) — needs Mako countertop table rows.
- **Basin position** — standard or closer to the wall with no faucet holes, except LB856 / VA030 (§9).
- **Vessel cutout per SB** (§11) — an order line for D.

## Open in the sources

- **Legs** — positions (§6, Q-MAKO-003). Quantity and unit are settled: $745 / $1,340 is the price of one leg and a configuration takes a pair (team, 24.09.2026); the SKU profile orders them as `VAN-MAKOV-LEG-{material}-{colour}` × 2.
- **Handles** — G50 20 or 36 cm by width; lacquered G50; shared handle and colours across the composition (§4, §5).
- **Thickness** — Porcelain 0.8″ in the tables vs 3/4″ in the catalog (§7); no thickness catalog declared.
- **Floating** — needs a thick top, Mako has thin ones only, so it is not valid today (§12).
- **Solid Surface** — Technolite / Technomood / Texturizzato have no palettes (§7).
- **Vessels** — Iris / Frame / Plaza colours, minimum SB, cutouts and prices (§10).
- **Master File L100** has an empty ProductID (Q-MAKO-001).

## Blockers, by owner

| Owner | What is needed |
|---|---|
| Product | A Mako configurator and Mako rows in the cabinet and countertop tables; approved defaults; the handle of the 42 models (their colour is `Antracite 400 MT`, 23.09.2026); leg positions (the pair per configuration and the per-leg price are confirmed, 24.09.2026); G50 length rule; VA030 in the product list; Porcelain profile; vessel data. Whether integrated basins are held back as undetermined until the countertop table has Mako rows (one `undeterminedRules` entry, but it disables every integrated basin). |
| A | Load Mako sources instead of 4 / 438. The cabinet table is table 581. |
| B | Handle style and colour, leg colour, countertop and basin steps in `ui.json`. |
| I | Basins: the Mako cabinets have no basin sub-product in the scene. (Handles, handle colour, legs and leg colour are bound.) |
| Scene | The Mako cabinet, handle and leg materials. |
| D | Mako SKU grammar, cabinet, legs, countertop and accessory pricing. |

## Evidence

`entities/collection/__tests__/makoProfile.test.ts`:
- the profile validates and the manifest loads it;
- types, styles and heights match; no inner drawer;
- colour counts per material group match the Master File;
- glass keys have no `G` prefix; `Matte White 8cm`, VA023 and VA030 are absent;
- no Urban or Class value leaks in; the drawer style groups and one undetermined rule are declared;
- the mixing rule keeps 1DW and 2DW apart.

`features/configurationCommands/__tests__/undeterminedGate.test.ts`: Leg Color is blocked on a one-drawer cabinet
and changes nothing, applied on a two-drawer one, and the rule reads drawers the command recorded as well as the
placed style.

The collection package itself is covered by `collectionContracts`, `partialCollectionPackages`,
`ActiveCollectionProvider`, `FlowEntryRedirect` and `ProductModelsGrid` tests, as for Class.
