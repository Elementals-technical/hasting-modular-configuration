# Urban Low Height and Class browser smoke

Date: 2026-09-16

The production bundle was built with Node `22.18.0` and served through `vite preview`. Headless Google Chrome opened both public collection URLs against that bundle.

| URL | Observed rendered markers |
|---|---|
| `/prebuilt/model?collectionId=urban-low-height` | `Urban Low Height Models`, `No preset compositions available for Urban Low Height`, and links retaining `collectionId=urban-low-height` |
| `/prebuilt/model?collectionId=class` | `Class Models`, `No preset compositions available for Class`, and links retaining `collectionId=class` |

Both pages passed the active collection loader and rendered the collection-specific navigation and empty state. No unknown-collection or source-load error was rendered. The current remote environment therefore supplied Configurator `4`, Countertop DataTable `438`, and Cabinet DataTable `439` during this smoke run.

This evidence covers the partial UI launch only. Neither package declares presets, ProductProfile, runtime bindings, SKU mappings, defaults, or pricing data. The smoke run does not approve cabinet placement, scene mutations, Save/restore, quotes, or checkout for either collection.
