---
name: hastings-class
description: Analyze or change the Hastings Class collection: cabinet/countertop tables 579/578, face/side/frame colours, drawer styles, basins, SKU profile, presets, tests. Use for `collectionId=class`; do not apply it to Mako or other collections.
---

# Hastings Class

Read `../../docs/products/class/README.md` first (identity, key numbers, open questions). Then open only the
section file the task names; do not read the whole folder.

| Task is about | Read |
|---|---|
| cabinet types, widths, drawer styles, handle, what the collection lacks | `docs/products/class/products.md` |
| steps, blocks, scene menu, model cards | `docs/products/class/steps.md` |
| colours, thickness, price groups | `docs/products/class/materials.md` (names: `docs/products/_shared/palettes.md`) |
| basins, vessels, basin ↔ 3D model | `docs/products/class/basins.md` |
| accessories present and missing | `docs/products/class/accessories.md` |
| any "is this allowed" question | `docs/products/class/rules.md` (numbered rules, forbidden combinations) |
| SKU grammar, price lines, what changes the price | `docs/products/class/pricing.md` |
| how the package is wired, scene contract, tests, known limits | `docs/products/class/integration.md` |

Client rules with sources: `docs/ai/hastings/domain-index.md` → `R-CLASS-*`. Statuses: `docs/products/_shared/status-legend.md` —
a `Provisional` or `UNKNOWN` fact is a decision for the owner, `Not implemented` is backlog, not a defect.

## Operating contract

- Class uses configurator 8 and tables 578/579; its scene products are `Class-*`. It shares nothing with Mako beyond the GB countertop grammar.
- Class has no handle option (frame detail); do not synthesize Urban/Mako handle behavior.
- Keep the distinction between cabinet face, cabinet side and frame colors through UI, profile and runtime bindings; frame colour decides the /B vs /C price class.
- Glass materials and the 2DW style/models are "Provisional — to be removed" by team decision: describe as-is, do not extend them.
- Treat countertop style, basin, vessel and thickness as state-only until the Class scene contract changes.
- The collection SKU profile is partial; preserve and report applicable pricing gaps.

## Change workflow

Trace the affected value through `manifest.json`, `ui.json`, `product-profile.json`, table 579, `runtime-bindings.json`, `sku-profile.json` and save/restore. Run focused Class collection/profile/runtime, pricing and restore tests plus `npm run tsc`. If the change alters a fact in the specification, update the section file and the revision
date in `README.md` in the same change. Report whether behavior is catalog-valid, visible in the scene, restorable and priced.
