---
name: hastings-class
description: Analyze or change the Hastings Class collection, including its package data, Class cabinet and countertop tables, frame/side colors, scene bindings, empty model recipes, partial SKU profile, and tests. Use for `collectionId=class` work.
---

# Hastings Class

Read `../../docs/products/class.md`; read `../../docs/products/README.md` for the shared pipeline.

## Operating contract

- Class uses configurator 9 but is not Mako. Its own tables are 578/579 and its scene products are `Class-*`.
- Class has no handle option; do not synthesize Urban/Mako handle behavior.
- Keep the distinction between cabinet face, cabinet side and frame colors through UI, profile and runtime bindings.
- Treat countertop style, basin, vessel and thickness as state-only until the Class scene contract changes.
- All 44 preset recipes are currently empty. A model-card change is not a composition implementation.
- The collection SKU profile is partial; preserve and report applicable pricing gaps.

## Change workflow

Trace the affected value through `manifest.json`, `ui.json`, `product-profile.json`, table 579,
`runtime-bindings.json`, `sku-profile.json` and save/restore. For model work, verify every recipe creates only
Class scene product types. Run focused Class collection/profile/runtime, pricing and restore tests plus `npm run tsc`.

Report UI, scene and pricing readiness separately.
