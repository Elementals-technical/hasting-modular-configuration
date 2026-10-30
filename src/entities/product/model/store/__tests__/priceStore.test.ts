import { describe, expect, it } from "vitest";

import type { PricingLine } from "@/shared/lib/pricing";

import {
  derivePriceStatus,
  priceStoreReducer,
  setPricingLines,
  setPricingUnavailable,
  setSkuPriceEntries,
  setSkusLoading,
} from "../priceStore";

type PriceAction = Parameters<typeof priceStoreReducer>[1];

const CABINET = "VAN-URSTD-SB/1DW/UG/X-23.6W-20.9H-19.7D";
const BOOK_MATCHING = "VAN-URBMG-VER-3D";

const lines: PricingLine[] = [
  { id: "cabinet:a", group: "cabinet", sku: CABINET, quantity: 1, sourceId: "a" },
  { id: "cabinet:b", group: "cabinet", sku: CABINET, quantity: 1, sourceId: "b" },
  { id: "bookMatching", group: "bookMatching", sku: BOOK_MATCHING, quantity: 3 },
];

const reduce = (...actions: PriceAction[]) =>
  actions.reduce((state, action) => priceStoreReducer(state, action), priceStoreReducer(undefined, { type: "init" }));

describe("priceStore", () => {
  it("counts every piece of identical lines once each price is known", () => {
    const state = reduce(
      setPricingLines(lines),
      setSkuPriceEntries({
        [CABINET]: { status: "ready", value: 100 },
        [BOOK_MATCHING]: { status: "ready", value: 10 },
      }),
    );

    expect(state.activeSkus).toEqual([CABINET, CABINET, BOOK_MATCHING, BOOK_MATCHING, BOOK_MATCHING]);
    expect(state.total).toBe(230);
    expect(derivePriceStatus(state)).toBe("ready");
  });

  it("is loading until every line has an answer", () => {
    const loading = reduce(setPricingLines(lines), setSkusLoading([CABINET, BOOK_MATCHING]));
    const halfAnswered = reduce(
      setPricingLines(lines),
      setSkusLoading([CABINET, BOOK_MATCHING]),
      setSkuPriceEntries({ [CABINET]: { status: "ready", value: 100 } }),
    );

    expect(derivePriceStatus(loading)).toBe("loading");
    expect(derivePriceStatus(halfAnswered)).toBe("loading");
  });

  it.each([
    ["an error", { status: "error", message: "timeout" } as const],
    ["a missing price", { status: "missing" } as const],
  ])("reports %s as an incomplete total that leaves the line out", (_caseName, entry) => {
    const state = reduce(
      setPricingLines(lines),
      setSkuPriceEntries({ [CABINET]: { status: "ready", value: 100 }, [BOOK_MATCHING]: entry }),
    );

    expect(state.total).toBe(200);
    expect(derivePriceStatus(state)).toBe("partial");
  });

  it("stops counting a price that later failed", () => {
    const state = reduce(
      setPricingLines(lines),
      setSkuPriceEntries({
        [CABINET]: { status: "ready", value: 100 },
        [BOOK_MATCHING]: { status: "ready", value: 10 },
      }),
      setSkuPriceEntries({ [BOOK_MATCHING]: { status: "error", message: "gone" } }),
    );

    expect(state.total).toBe(200);
    expect(derivePriceStatus(state)).toBe("partial");
  });

  it("has no lines and no total for a collection without an SKU profile", () => {
    const state = reduce(
      setPricingLines(lines),
      setSkuPriceEntries({ [CABINET]: { status: "ready", value: 100 } }),
      setPricingUnavailable(),
    );

    expect(state).toMatchObject({ lines: [], activeSkus: [], total: 0 });
    expect(derivePriceStatus(state)).toBe("unavailable");
  });

  it("is idle without lines", () => {
    expect(derivePriceStatus(reduce())).toBe("idle");
  });
});
