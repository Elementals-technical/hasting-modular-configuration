---
name: hastings-tricot
description: Hastings Tricot collection (`collectionId=tricot`): tables 592/593, material-bound cabinet patterns, groove colour, side panels, thick countertops with brackets, basins, SKU TRIC. Do not apply to Class, Mako or Lame.
---

# Hastings Tricot

Read `../../docs/products/tricot/README.md` first (identity, key numbers, open questions). Then open only the
section file the task names; do not read the whole folder.

| Task is about | Read |
|---|---|
| cabinet types, widths, drawer styles, handle, what the collection lacks | `docs/products/tricot/products.md` |
| steps, blocks, scene menu, model cards | `docs/products/tricot/steps.md` |
| colours, thickness, price groups | `docs/products/tricot/materials.md` (names: `docs/products/_shared/palettes.md`) |
| basins, vessels, basin ↔ 3D model | `docs/products/tricot/basins.md` |
| accessories present and missing | `docs/products/tricot/accessories.md` |
| any "is this allowed" question | `docs/products/tricot/rules.md` (numbered rules, forbidden combinations) |
| SKU grammar, price lines, what changes the price | `docs/products/tricot/pricing.md` |
| how the package is wired | `docs/products/README.md` (no integration page yet) |

Client rules with sources: `docs/ai/hastings/domain-index.md` → `R-TRICOT-*`. Statuses: `docs/products/_shared/status-legend.md` —
a `Provisional` or `UNKNOWN` fact is a decision for the owner, `Not implemented` is backlog, not a defect.

## Operating contract

- Tricot uses configurator 12 and tables 592/593; one height (40 cm) and one depth (52 cm); styles 1DW / 2DW / 1DWID, 2DW never mixed with the others.
- Handle is always the groove: no handle selector; only Handle Groove Color is configurable and it follows the cabinet colour while equal to it.
- Cabinet Pattern is material-bound (Loden ↔ Lacquered MT; Cannette / Twill / Gessato / Satin ↔ Wood Veneer) and stored per cabinet; shared choice expands to one change per cabinet.
- Sink Base 60 cm with 1DWID takes vessel only (rule 7); thick countertops add two brackets (rule 19).
- Basin code ↔ 3D model mapping is Provisional for every row; do not "fix" a model name without the owner.
- Side panels: No groove only, open ends only, +1 cm countertop per side.

## Change workflow

Trace UI/profile → table 592 → command/runtime binding → scene → `sku-profile.json` → pricing. For patterns and groove colour test both materials and the per-cabinet override; for side panels test the length limit with panels on. Run focused Tricot tests plus `npm run tsc`. If the change alters a fact in the specification, update the section file and the revision
date in `README.md` in the same change. Report whether behavior is catalog-valid, visible in the scene, restorable and priced.
