# B06: page option lists from the ProductProfile — done

Status 22.09.2026: done on `S1-DD-C/ProductProfile` (taken over by Developer C). The countertop and accessories
steps no longer declare product catalogs; they read them from the active collection's profile.

The lists are built in `src/features/collectionCustomization/lib/pageOptionCatalogs.ts`, in the shape the pages used
when they were constants. Pictures stay out of the profile: `pageOptionImages.ts` maps an option value to its image,
and an option without an entry is shown without a picture, not dropped.

| Former page constant | Now | Profile call |
| --- | --- | --- |
| `optionsMockData3` (36 basins), also on `prebuilt/model/ModelPage.tsx` | `buildBasinOptions(profile)` | `selectBasinOptions(profile, "integrated")`, then `"vessel"` |
| `optionsMockData2` (countertop style) | `buildCountertopStyleOptions(profile)` | `selectOptions(profile, "CountertopStyle")` |
| `optionsMockData4` (thickness) | `buildThicknessOptions(profile)` | `selectOptions(profile, "Thickness")` |
| `optionsSidePanelsData` | `buildSidePanelOptions(profile)` | `selectOptions(profile, "SidePanels")` |
| `optionsSwatchData2` (divider option) | `buildDividerModeOptions(profile)` | `selectOptions(profile, "DividersOption")` |
| `dividersMockData` | `buildDividerStyleOptions(profile)` | `selectOptions(profile, "DividersStyle")` |
| `optionsSwatchDataTowel` | `buildTowelBarOptions(profile)` | `selectOptions(profile, "TowelBarOption")` |

The unused `optionsMockData`, `optionsSwatchData` and `optionsTowelData` were deleted with the constant files.

## Proof

- `pageOptionCatalogs.test.ts`: the USH lists have the profile's values, labels and order, a picture for every basin,
  style, side panel but None and divider style; Mako gets its own basins and "Metal" / "Oak" dividers, and no side
  panels, thickness or towel bar.
- Before the constants were deleted, the built USH lists were compared field by field with them (all equal but `id`,
  which is only a React key).
- `collectionConsumerBoundary.test.ts` fails if one of the former constant names comes back in production code.

## Also moved in the same round

- Material filter groups on the countertop step and in colour fields come from
  `materialNormalization.displayHierarchy`; the vessel-compatible countertop materials from
  `vesselCompatibleCountertopMaterialTokens`; the pages match materials by the collection's alias table.
- The countertop step changes the vessel colour, the vessel basin, the plain cutout and the countertop style through
  the commands; the accessories step resets the towel bar and records the divider option through them.

## Still open

- **Divider styles are stored by label.** The divider state keeps "Option A" and parses the type back from it
  (`getDividerTypeFromOptionTitle`). Class and Mako label their styles "Metal" / "Oak", which this parsing does not
  know. Moving to the value ("A", "Oak") changes the saved format: B + C, together with the divider bindings (I).
- **Thickness for pricing.** `COUNTERTOP_THICKNESS_OPTIONS` stays: pricing (D) reads it.
