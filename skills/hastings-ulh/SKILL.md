---
name: hastings-ulh
description: Analyze or change the Hastings Urban Low Height collection, including its package data, cabinet table, product rules, UI, presets, PlayCanvas bindings, pricing gaps, and tests. Use for `urban-low-height` or ULH work; do not silently apply Urban Standard Height behavior.
---

# Hastings Urban Low Height

Read `../../docs/products/urban-low-height.md` before changing ULH behavior. For the shared loading pipeline,
also read `../../docs/products/README.md`.

## Operating contract

- Treat `urban-low-height` as its own collection. Shared remote ids 4 and 438 are data sources, not inheritance.
- Start at `public/collections/urban-low-height/manifest.json`, then inspect only the files relevant to the request.
- Put navigation/presentation changes in `ui.json`, product values/rules in `product-profile.json`, scene
  translations/status in `runtime-bindings.json`, and model recipes in `presets.json`.
- Keep `collectionId` identical across manifest, UI, profile and runtime bindings.
- Never add a USH fallback to cover missing ULH data. Record an explicit gap or `state-only`/`unbound` contract.
- Keep Open Side Shelf hidden through `unplacedProductTypes` until a real scene product exists.
- Do not claim pricing support without an ULH SKU profile or an explicitly approved ULH series.

## Change workflow

1. Classify the request as loader/source, UI, product rule, cabinet matrix, scene runtime, preset, or pricing.
2. Trace the value end to end: UI field → profile attribute/rule → Redux command → runtime binding → scene,
   and separately profile/SKU → pricing.
3. Check table 580 constraints and the profile matrix adapter before changing hardcoded TypeScript.
4. Preserve the known partial boundaries: six empty Multi-Level recipes, unplaced Open Side Shelf,
   incomplete handle-height catalog coupling, borrowed countertop/basin semantics, and no pricing series.
5. Update focused tests first or alongside data; run the collection/profile/runtime and affected UI tests plus `npm run tsc`.

When reporting completion, distinguish “visible in UI”, “bound in PlayCanvas”, “saved/restored”, and “priced”.
