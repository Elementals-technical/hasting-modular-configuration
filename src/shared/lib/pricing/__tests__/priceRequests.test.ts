import { describe, expect, it } from "vitest";

import {
  LatestPriceRequestCache,
  priceRequestCacheKey,
  resolvePriceFromResponse,
  resolvePriceRequest,
} from "../priceRequests";

const USH = { countertopPrefix: "UR", bookMatchingSkuPrefix: "VAN-URBMG-" };
const DYNAMIC_TOP = "CT-URSSTKR-INTG-75.2W-.5H-19.9D-SSTKR-FF";

describe("resolvePriceRequest", () => {
  it("invalidates a top request when its priced length changes without changing its SKU", () => {
    expect(priceRequestCacheKey(DYNAMIC_TOP, 120)).not.toBe(priceRequestCacheKey(DYNAMIC_TOP, 120.1));
    expect(priceRequestCacheKey(DYNAMIC_TOP)).toBe(DYNAMIC_TOP);
  });

  it("re-fetches A after the same SKU was priced at A, then B", () => {
    const cache = new LatestPriceRequestCache();
    const shouldFetch = (widthCm: number) => !cache.has(DYNAMIC_TOP, widthCm);
    const completeRequest = (widthCm: number) => cache.mark(DYNAMIC_TOP, widthCm);

    expect(shouldFetch(100)).toBe(true);
    completeRequest(100);
    expect(shouldFetch(100)).toBe(false);

    expect(shouldFetch(120)).toBe(true);
    completeRequest(120);
    expect(shouldFetch(100)).toBe(true);
  });

  it("prices the countertop top per cm, with the width of the composition", () => {
    expect(resolvePriceRequest({ sku: DYNAMIC_TOP, widthCm: 191, ...USH })).toEqual({
      kind: "countertopTop",
      widthCm: 191,
    });
  });

  it("falls back to the plain request when the top has no width", () => {
    expect(resolvePriceRequest({ sku: DYNAMIC_TOP, widthCm: null, ...USH })).toEqual({ kind: "product" });
  });

  it.each([
    ["a vessel", "VES-URMOD-X-19.7W-5.5H-13D"],
    ["book matching", "VAN-URBMG-VER-3D"],
  ])("asks the v2 resolver for %s", (_caseName, sku) => {
    expect(resolvePriceRequest({ sku, ...USH })).toEqual({ kind: "productV2Resolve" });
  });

  it.each([
    ["a cabinet", "VAN-URSTD-SB/1DW/UG/X-23.6W-20.9H-19.7D-CAB-3D-1C1"],
    ["a basin", "CT-URSSTKR-RECT-.5H-SSTKR-FF"],
    ["faucet holes", "CT-URSSTKR-FAHO/2"],
    ["a vessel cutout", "CT-URSSTKR-HCUT"],
  ])("asks the plain price endpoint for %s", (_caseName, sku) => {
    expect(resolvePriceRequest({ sku, ...USH })).toEqual({ kind: "product" });
  });

  it("has no book matching route for a collection without a profile", () => {
    expect(
      resolvePriceRequest({ sku: "VAN-URBMG-VER-3D", countertopPrefix: null, bookMatchingSkuPrefix: null }),
    ).toEqual({ kind: "product" });
  });
});

describe("resolvePriceFromResponse", () => {
  it.each([
    ["a number", { price: 2098 }, 2098],
    ["a formatted string", { price: "$1,234.50" }, 1234.5],
    ["another price key", { Total: 637 }, 637],
    ["zero", { price: 0 }, 0],
  ])("reads %s", (_caseName, data, expected) => {
    expect(resolvePriceFromResponse(data)).toBe(expected);
  });

  it.each([
    ["an answer without a price", { resolver: "CT/matrix", error: 'No best match for baseSku "CT-UR-FAHO/2"' }],
    ["an empty answer", undefined],
    ["a null price", { price: null }],
  ])("reports no price for %s", (_caseName, data) => {
    expect(resolvePriceFromResponse(data as Record<string, unknown> | undefined)).toBeNull();
  });
});
