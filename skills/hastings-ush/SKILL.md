---
name: hastings-ush
description: Analyze or change the Hastings Urban Standard Height collection, including its legacy-compatible package, rules, PlayCanvas bindings, SKU mappings, pricing, and restore behavior. Use for `urban-standard-height` or USH work.
---

# Hastings Urban Standard Height

Read `../../docs/products/urban-standard-height.md` and, for loader changes,
`../../docs/products/README.md`.

## Operating contract

- USH is registry default and the only legacy restore fallback. Treat changes to identity/defaults as compatibility changes.
- Inspect both collection files and legacy consumers: navigation/static options/cabinet SKU mappings still coexist
  with profile/UI/runtime data.
- Keep the full rule surface intact unless the request explicitly changes it: fluting, grain, book matching,
  drawer mixing, side panels, dividers, Syntesi, countertop and vessel compatibility.
- Pricing uses `cabinet-sku-mappings.json` plus `SKU_SERIES_BY_COLLECTION`; it does not use a collection SKU profile.
- Do not generalize a USH special case to ULH, Class or Mako without a product-specific data contract.

## Change workflow

Trace UI → profile/rule → command → runtime binding → scene and SKU/pricing → save/restore. Check both prebuilt
and custom flows. Run focused collection, runtime, pricing and restore tests plus `npm run tsc`; use a browser check
for scene or multi-step UI changes.
