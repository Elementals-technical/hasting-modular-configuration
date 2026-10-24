import { describe, expect, it } from "vitest";
import { tandemCountertopItems, tandemCountertopLineId } from "../tandemCountertopLines";
import type { PricingLine } from "../types";

describe("tandem countertop summary items", () => {
  it("one item per tandem line: the main countertop item with the line's width and price", () => {
    const main = { id: "countertop-1", title: "Countertop", price: "$1,000", description: { Style: "Plain", Width: 180 } };
    const lines: PricingLine[] = [
      { id: "countertop:0", group: "countertop", sku: "TOP-180", quantity: 1, widthCm: 180 },
      { id: tandemCountertopLineId(0), group: "countertop", sku: "TOP-90", quantity: 1, widthCm: 90 },
    ];
    const items = tandemCountertopItems(main, lines, (line) => ({ price: line.sku }));
    expect(items).toEqual([
      { id: "countertop-tandem-0", title: "Countertop", price: "TOP-90", description: { Style: "Plain", Width: 90 } },
    ]);
  });
});
