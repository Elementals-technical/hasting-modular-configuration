---
name: hastings-ud
description: Hastings Urban Duplex collection (`collectionId=urban-duplex`): tables 594/595, Base + Lateral panel colours, hybrid URSTD/URLH cabinets, multi-level columns, Open Side Shelf, SKU URDPX. Do not treat it as USH or ULH.
---

# Hastings Urban Duplex

Read `../../docs/products/urban-duplex/README.md` first (identity, key numbers, open questions). Then open only the
section file the task names; do not read the whole folder.

| Task is about | Read |
|---|---|
| cabinet types, widths, drawer styles, handle, what the collection lacks | `docs/products/urban-duplex/products.md` |
| steps, blocks, scene menu, model cards | `docs/products/urban-duplex/steps.md` |
| colours, thickness, price groups | `docs/products/urban-duplex/materials.md` (names: `docs/products/_shared/palettes.md`) |
| basins, vessels, basin ↔ 3D model | `docs/products/urban-duplex/basins.md` |
| accessories present and missing | `docs/products/urban-duplex/accessories.md` |
| any "is this allowed" question | `docs/products/urban-duplex/rules.md` (numbered rules, forbidden combinations) |
| SKU grammar, price lines, what changes the price | `docs/products/urban-duplex/pricing.md` |
| how the package is wired, scene contract, tests, known limits | `docs/products/urban-duplex/integration.md` |

Client rules with sources: `docs/ai/hastings/domain-index.md` → `R-UD-*`. Statuses: `docs/products/_shared/status-legend.md` —
a `Provisional` or `UNKNOWN` fact is a decision for the owner, `Not implemented` is backlog, not a defect.

## Operating contract

- Urban Duplex uses configurator 13 and tables 594/595 (copied from ULH for the countertop); upper-groove handle only, no fluting, no stacking.
- Two panel colours (Base, Lateral) are composition-wide; the Lateral Panel side (L / R) is per cabinet and defaults to R; the groove and Open Side Shelf take the Lateral colour (Provisional).
- Height follows style (2DW 56; 1DW/1DWID 53; 1DW Slim 38 / 28) and is one per composition in the builder; hybrid URSTD / URLH side cabinets have a full handle and no Lateral Panel.
- Multi-level models are columns, not stacks; depth 50.5 in their data is not applied (Not implemented).
- Countertop position rules follow ULH by thickness; vessel needs HPL/Porcelain and a Sink Base ≥ 80 cm; Solid Surface colours are disabled by table 595.
- Pricing: cabinets from the Duplex price list, everything else as USH (Provisional); the HNDL vs HDL groove token is an open question.

## Change workflow

Trace UI/profile → table 594 → command/runtime binding → scene → `sku-profile.json` → pricing. For panel colours test hybrids, Open Shelf and Open Side Shelf; for multi-level test column placement and the Lower countertop. Run focused Urban Duplex tests plus `npm run tsc`. If the change alters a fact in the specification, update the section file and the revision
date in `README.md` in the same change. Report whether behavior is catalog-valid, visible in the scene, restorable and priced.
