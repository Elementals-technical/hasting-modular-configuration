---
paths:
  - "src/shared/lib/pricing/**"
  - "src/shared/lib/sku/**"
  - "src/shared/hooks/usePriceCalculation.ts"
  - "src/shared/hooks/usePricingInput.ts"
  - "src/shared/hooks/usePriceResult.ts"
  - "src/shared/hooks/useSkuBuilders.ts"
  - "src/entities/product/model/store/priceStore.ts"
  - "src/pages/prebuilt/summary/**"
  - "src/pages/custom/summary/**"
---

# Pricing rules

- The package decides the pricing path: a `skuProfile` means `buildCollectionPricingLines`, a `SKU_SERIES_BY_COLLECTION` row means the USH `buildPricingLines`, neither means an explicit `unsupported` with no price request. A collection never borrows a series it isn't listed under.
- Order lines come from pure builders over a `PricingInput`, which only `usePricingInput` assembles; both builders produce USH-shaped line ids.
- A part the collection hasn't confirmed is a `gap`; a gap with `blocksTotal: true` keeps the total `partial`. Never price an unconfirmed part silently.
- Route every SKU through `resolvePriceRequest`, and cache by `priceRequestCacheKey`.
- A summary item takes its SKU, price and pieces from the lines `usePriceCalculation` priced, through `summaryLinePrice.ts`; a page keeps only the item's look. Countertop width comes from `calcTotalCountertopWidthCm`.
- Format a price only for display, with `formatSummaryPrice`.
- `usePriceCalculation` is mounted once, in the configurator sidebar.
- Expected prices and SKUs in tests come from recorded API answers (`__tests__/fixtures/prices/`) or the client's workbooks. Refresh the recordings with `RECORD_PRICES=1 npx vitest run src/shared/lib/pricing/__tests__/recordPriceFixtures.test.ts`, then rerun the suite.
