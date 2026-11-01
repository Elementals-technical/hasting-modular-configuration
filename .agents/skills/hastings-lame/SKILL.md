---
name: hastings-lame
description: Hastings Lame collection (`collectionId=lame`): tables 596/597, single G58 handle, composition-wide pattern, legs with caps, undertop, thin countertops, basins incl. VA030, SKU LAMEV. Do not apply to Mako, Tricot or Class.
---

# Hastings Lame

Read `../../docs/products/lame/README.md` first (identity, key numbers, open questions). Then open only the
section file the task names; do not read the whole folder.

| Task is about | Read |
|---|---|
| cabinet types, widths, drawer styles, handle, what the collection lacks | `docs/products/lame/products.md` |
| steps, blocks, scene menu, model cards | `docs/products/lame/steps.md` |
| colours, thickness, price groups | `docs/products/lame/materials.md` (names: `docs/products/_shared/palettes.md`) |
| basins, vessels, basin ↔ 3D model | `docs/products/lame/basins.md` |
| accessories present and missing | `docs/products/lame/accessories.md` |
| any "is this allowed" question | `docs/products/lame/rules.md` (numbered rules, forbidden combinations) |
| SKU grammar, price lines, what changes the price | `docs/products/lame/pricing.md` |
| how the package is wired | `docs/products/README.md` (no integration page yet) |

Client rules with sources: `docs/ai/hastings/domain-index.md` → `R-LAME-*`. Statuses: `docs/products/_shared/status-legend.md` —
a `Provisional` or `UNKNOWN` fact is a decision for the owner, `Not implemented` is backlog, not a defect.

## Operating contract

- Lame uses configurator 14 and tables 596/597; height follows drawer style (26 / 52 cm), depth 52 cm; 1DW and 2DW never mixed.
- One handle (G58) without selection; one pattern for the whole composition (never per cabinet); handle colour, leg caps and undertop are composition-wide.
- Legs: one pair per composition, model follows drawer style (long for 1DW, short for 2DW); caps take the handle colour until chosen. Undertop lifts countertop and basins by 2 cm.
- Thin countertops only: no brackets, no offset/remote, no hosted basins. VA030 has no 3D model (Not implemented in scene) and still prices.
- Undertop with a 60 cm Sink Base is forbidden by the client and not blocked in the build (Not implemented): a defect to report, not to hide.
- Vessel Art and Diamond, side panels and dividers are Not implemented; do not borrow them from other collections.

## Change workflow

Trace UI/profile → table 596 → command/runtime binding → scene → `sku-profile.json` → pricing. For legs and undertop test both drawer styles and replay/restore; for pattern changes verify every placed cabinet follows. Run focused Lame tests plus `npm run tsc`. If the change alters a fact in the specification, update the section file and the revision
date in `README.md` in the same change. Report whether behavior is catalog-valid, visible in the scene, restorable and priced.
