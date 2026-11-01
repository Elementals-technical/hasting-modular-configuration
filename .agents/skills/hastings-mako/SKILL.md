---
name: hastings-mako
description: Analyze or change the Hastings Mako collection, including its cabinet/countertop tables, handles, legs, model recipes, PlayCanvas translations, partial SKU profile, pricing gaps, and tests. Use for `collectionId=mako` work; do not apply it to other collections.
---

# Hastings Mako

Read `../../docs/products/mako/README.md` first (3 KB: identity, key numbers, open questions). Then open only the
section file the task names; do not read the whole folder.

| Task is about | Read |
|---|---|
| cabinet types, widths, drawer styles, handle, legs | `docs/products/mako/products.md` |
| steps, blocks, selection hierarchy, model cards | `docs/products/mako/steps.md` |
| colours, thickness, price groups | `docs/products/mako/materials.md` (names: `docs/products/_shared/palettes.md`) |
| basins, vessels, basin ↔ 3D model | `docs/products/mako/basins.md` |
| legs, faucet holes, missing accessories | `docs/products/mako/accessories.md` |
| any "is this allowed" question | `docs/products/mako/rules.md` (rules 1–21, forbidden combinations) |
| SKU grammar, price lines, what changes the price | `docs/products/mako/pricing.md` |
| how the package is wired, scene contract, tests, known limits | `docs/products/mako/integration.md` |

Shared pipeline: `../../docs/products/README.md`. Statuses (Ready / Provisional / Not implemented / Not in scope /
UNKNOWN): `../../docs/products/_shared/status-legend.md` — a `Provisional` or `UNKNOWN` fact is not a bug to fix
silently; a `Not implemented` fact is backlog, not a defect.

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
placed-cabinet, pricing and restore tests plus `npm run tsc`. If the change alters a fact in the specification,
update the section file and the revision date in `README.md` in the same change.

Report whether behavior is catalog-valid, visible in the scene, restorable and priced.
