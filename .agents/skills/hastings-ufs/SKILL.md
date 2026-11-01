---
name: hastings-ufs
description: Hastings Urban Freestanding collection (`collectionId=urban-freestanding`): tables 590/591, plinth, handle-driven heights 91/88, Floor-Mount Short Cabinet, fluting, side panels, SKU URFS. Do not treat it as USH.
---

# Hastings Urban Freestanding

Read `../../docs/products/urban-freestanding/README.md` first (identity, key numbers, open questions). Then open only the
section file the task names; do not read the whole folder.

| Task is about | Read |
|---|---|
| cabinet types, widths, drawer styles, handle, what the collection lacks | `docs/products/urban-freestanding/products.md` |
| steps, blocks, scene menu, model cards | `docs/products/urban-freestanding/steps.md` |
| colours, thickness, price groups | `docs/products/urban-freestanding/materials.md` (names: `docs/products/_shared/palettes.md`) |
| basins, vessels, basin ↔ 3D model | `docs/products/urban-freestanding/basins.md` |
| accessories present and missing | `docs/products/urban-freestanding/accessories.md` |
| any "is this allowed" question | `docs/products/urban-freestanding/rules.md` (numbered rules, forbidden combinations) |
| SKU grammar, price lines, what changes the price | `docs/products/urban-freestanding/pricing.md` |
| how the package is wired | `docs/products/README.md` (no integration page yet) |

Client rules with sources: `docs/ai/hastings/domain-index.md` → `R-UFS-*`. Statuses: `docs/products/_shared/status-legend.md` —
a `Provisional` or `UNKNOWN` fact is a decision for the owner, `Not implemented` is backlog, not a defect.

## Operating contract

- Urban Freestanding uses configurator 11 and tables 590/591; linear composition on a 3 cm plinth; no drag-and-drop, no second row.
- Handle (UG / CG / PTO) is one per composition and sets the height (91 / 88 cm; short cabinet 56 / 53); Open Side Shelf only with PTO.
- Floor-Mount Short Cabinet is Provisional: sizes and heights are ours, no SKU or price in the client list; it stands only at an end next to a tall cabinet and gets its own Lower countertop.
- Fluting only for Lacquered MT, per cabinet; Handle Color only with UG / CG. Wood Veneer and the 20 Tricot lacquers in the configurator are extra and unpriced.
- Thin countertop (0.5") only: no brackets, no offset/remote. Vessel needs a Sink Base ≥ 80 cm; the Fenix exclusion is an open question.
- Side panels next to the short cabinet and panels taller than 22" have no price row and block the total; dividers block the total when styled.

## Change workflow

Trace UI/profile → table 590 → command/runtime binding → scene → `sku-profile.json` → pricing. For handle changes test the height change on every cabinet and the short cabinet staying put; for side panels test both heights and the total-blocking cases. Run focused Urban Freestanding tests plus `npm run tsc`. If the change alters a fact in the specification, update the section file and the revision
date in `README.md` in the same change. Report whether behavior is catalog-valid, visible in the scene, restorable and priced.
