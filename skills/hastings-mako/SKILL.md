---
name: hastings-mako
description: Analyze or change the Hastings Mako collection, including its cabinet/countertop tables, handles, legs, model recipes, PlayCanvas translations, partial SKU profile, pricing gaps, and tests. Use for `collectionId=mako` work.
---

# Hastings Mako

Read `../../docs/products/mako.md`; read `../../docs/products/README.md` for the shared pipeline.

## Operating contract

- Mako uses configurator 9 and tables 577/581. Do not borrow Class product types or rules.
- Preserve semantic-to-scene translations: Handle → `HandleStyle`, Drawers → legacy `1D`/`2D` plus height,
  and LegColor → `ShowLegs`/`LegColor`.
- Preserve execution order for drawer and leg changes; a reordered patch can leave stale legs visible.
- Treat basin and VesselColor as state-only until a Mako basin scene product exists.
- 42 presets currently have real compositions; do not regress them to model-card-only data.
- Pricing is data-driven but partial. Apply and expose the SKU profile gaps instead of inventing missing product data.

## Change workflow

Trace UI/profile → table 581 → command/runtime binding → Mako scene and profile/SKU → pricing. For legs,
handles or drawers, test both one- and two-drawer cabinets and replay/restore. Run focused Mako profile/runtime,
placed-cabinet, pricing and restore tests plus `npm run tsc`.

Report whether behavior is catalog-valid, visible in the scene, restorable and priced.
