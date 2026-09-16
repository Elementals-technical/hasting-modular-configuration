# Recorded price answers

Raw answers of `GET https://renderadmin.vivid3d.tech/pricing-v2/resolve?sku=…` for the SKUs of the
reference scenarios in `../pricingScenarios.ts`, one file per scenario (D03). The countertop top is
recorded with its `widthCm`, the way `resolvePriceRequest` asks for it.

The regression tests read these files and never reach the network. An answer without a price is kept
as it came back: a missing price is part of what the regression fixes.

Refresh after changing a scenario or when the price tables change:

```bash
RECORD_PRICES=1 npx vitest run src/shared/lib/pricing/__tests__/recordPriceFixtures.test.ts
```

Then re-run the suite: a changed total shows up as a failing expectation in
`../../regressionPrices.test.ts`, which is the point of the fixtures.
