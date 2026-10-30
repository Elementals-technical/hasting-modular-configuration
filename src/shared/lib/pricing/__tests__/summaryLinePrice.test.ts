import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SkuPriceEntry } from "@/entities/product/model/store/priceStore";

import { appendUncoveredLines, resolveSummaryLinePrice, type SummaryPricedSection } from "../summaryLinePrice";
import type { PricingLine } from "../types";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

const cabinet: PricingLine = { id: "cabinet:a", group: "cabinet", sku: "VAN-CAB", quantity: 1, sourceId: "a" };
const bookMatching: PricingLine = { id: "bookMatching", group: "bookMatching", sku: "VAN-BMG", quantity: 3 };
const faucet: PricingLine = { id: "countertop:faucetDefault", group: "faucetHoles", sku: "CT-FAHO/0", quantity: 1 };

describe("resolveSummaryLinePrice", () => {
  it("prices the pieces the item stands for", () => {
    expect(resolveSummaryLinePrice([{ line: bookMatching, entry: { status: "ready", value: 10 }, pieces: 3 }])).toEqual(
      { sku: "VAN-BMG", lineIds: ["bookMatching"], price: "$30.00", priceState: "ready" },
    );
  });

  it.each([
    ["loading", { status: "loading" } as const, "loading"],
    ["not requested yet", null, "loading"],
    ["missing", { status: "missing" } as const, "missing"],
    ["failed", { status: "error", message: "timeout" } as const, "missing"],
  ])("shows no amount while the price is %s", (_caseName, entry: SkuPriceEntry | null, priceState) => {
    expect(resolveSummaryLinePrice([{ line: cabinet, entry }])).toMatchObject({ price: "$0", priceState });
  });

  it("has no price without a line", () => {
    expect(resolveSummaryLinePrice([])).toEqual({ lineIds: [], price: "$0" });
  });
});

describe("appendUncoveredLines", () => {
  const ready = (value: number): SkuPriceEntry => ({ status: "ready", value });

  it("adds only the lines no item shows, into their section", () => {
    const sections: SummaryPricedSection[] = [
      {
        id: "cabinet",
        title: "Cabinet",
        items: [{ id: "cabinet-config-0", title: "Sink Base", price: "$1.00", lineIds: ["cabinet:a"] }],
      },
    ];

    appendUncoveredLines(sections, [cabinet, bookMatching, faucet], () => ready(5));

    expect(sections.map(({ id, items }) => [id, items.map(({ id: itemId, price }) => [itemId, price])])).toEqual([
      ["cabinet", [["cabinet-config-0", "$1.00"]]],
      ["cabinet-options", [["line-bookMatching", "$15.00"]]],
      ["faucet", [["line-countertop:faucetDefault", "$5.00"]]],
    ]);
  });
});
