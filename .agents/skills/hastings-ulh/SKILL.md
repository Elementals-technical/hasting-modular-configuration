---
name: hastings-ulh
description: Hastings Urban Low Height collection (`urban-low-height`, ULH): tables 580/589, two-row placement, countertop offset/remote, Lower cover, side panels, presets, pricing gaps. Do not silently apply Urban Standard Height behavior.
---

# Hastings Urban Low Height

Read `../../docs/products/urban-low-height/README.md` first (identity, key numbers, open questions). Then open only the
section file the task names; do not read the whole folder.

| Task is about | Read |
|---|---|
| cabinet types, widths, drawer styles, handle, what the collection lacks | `docs/products/urban-low-height/products.md` |
| steps, blocks, scene menu, model cards | `docs/products/urban-low-height/steps.md` |
| colours, thickness, price groups | `docs/products/urban-low-height/materials.md` (names: `docs/products/_shared/palettes.md`) |
| basins, vessels, basin ↔ 3D model | `docs/products/urban-low-height/basins.md` |
| accessories present and missing | `docs/products/urban-low-height/accessories.md` |
| any "is this allowed" question | `docs/products/urban-low-height/rules.md` (numbered rules, forbidden combinations) |
| SKU grammar, price lines, what changes the price | `docs/products/urban-low-height/pricing.md` |
| how the package is wired, scene contract, tests, known limits | `docs/products/urban-low-height/integration.md` |

Client rules with sources: `docs/ai/hastings/domain-index.md` → `R-ULH-*`. Statuses: `docs/products/_shared/status-legend.md` —
a `Provisional` or `UNKNOWN` fact is a decision for the owner, `Not implemented` is backlog, not a defect.

## Operating contract

- Treat `urban-low-height` as its own collection. Shared remote ids 4 and 589 are data sources, not inheritance; countertop, basins, vessels, side panels and towel bar are priced with the USH grammar by explicit decision.
- Put navigation/presentation changes in `ui.json`, product values/rules in `product-profile.json`, scene translations/status in `runtime-bindings.json`, model recipes in `presets.json`; keep `collectionId` identical across them.
- Never add a USH fallback to cover missing ULH data. Record an explicit gap or `state-only`/`unbound` contract.
- Keep Open Side Shelf hidden through `unplacedProductTypes` until a real scene product exists.
- Placement rules 11–22 and countertop rules 33–50 in `rules.md` are the contract for Drag & Drop, two rows, offset/remote and the Lower cover; a change there needs the shared countertop/side-panel routers (`hasting-countertop`, `hasting-side-panels`) for the 3D side.
- Do not claim pricing support without an ULH SKU profile row or an explicitly approved USH series.

## Change workflow

Classify the request (loader, UI, product rule, cabinet matrix, scene runtime, preset, pricing); trace UI field → profile attribute/rule → Redux command → runtime binding → scene, and separately profile/SKU → pricing; check table 580 and the matrix adapter before changing TypeScript. Run collection/profile/runtime, placement and affected UI tests plus `npm run tsc`. If the change alters a fact in the specification, update the section file and the revision
date in `README.md` in the same change. Report whether behavior is catalog-valid, visible in the scene, restorable and priced.
