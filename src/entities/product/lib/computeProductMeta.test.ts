import { describe, expect, it } from "vitest";

import type { PresetProduct } from "@/entities/product/types";

import { computeSize, computeStyles, enrichProduct } from "./computeProductMeta";

const sinkBase = (overrides: Partial<PresetProduct> = {}): PresetProduct => ({
  name: "Sink-Base",
  ...overrides,
});

describe("computeSize", () => {
  it("buckets inch values into the right size ranges", () => {
    expect(computeSize('Foo · 24" 1-Drawer')).toBe("24_29");
    expect(computeSize('Foo · 30" 1-Drawer')).toBe("30_39");
    expect(computeSize('Foo · 49" 1-Drawer')).toBe("40_49");
    expect(computeSize('Foo · 59" 1-Drawer')).toBe("50_59");
    expect(computeSize('Foo · 69" 1-Drawer')).toBe("60_69");
    expect(computeSize('Foo · 79" 1-Drawer')).toBe("70_79");
    expect(computeSize('Foo · 89" 2-Drawer')).toBe("80_89");
    expect(computeSize('Foo · 90" 2-Drawer')).toBe("90_plus");
    expect(computeSize('Foo · 103" 2-Drawer')).toBe("90_plus");
  });

  it("falls back to the smallest bucket when no inch token is present", () => {
    expect(computeSize("No measurement here")).toBe("24_29");
  });
});

describe("computeStyles", () => {
  it("detects drawer styles", () => {
    expect(computeStyles([sinkBase({ Drawers: "1D" })])).toContain("1_drawer");
    expect(computeStyles([sinkBase({ Drawers: "2D" })])).toContain("2_drawer");
  });

  it("detects single vs double basin", () => {
    expect(computeStyles([sinkBase({ sinkType: "Top_X" })])).toContain("single_basin");

    const doubleBasin = computeStyles([
      sinkBase({ sinkType: "Top_X", Width: 60 }),
      sinkBase({ sinkType: "Top_X", Width: 60 }),
    ]);
    expect(doubleBasin).toContain("double_basin");
    expect(doubleBasin).not.toContain("single_basin");
  });

  it("detects open shelving", () => {
    expect(computeStyles([sinkBase(), { name: "Open-Shelf" }])).toContain("open_shelving");
  });

  it("flags asymmetric compositions but not symmetric ones", () => {
    const symmetric = computeStyles([
      sinkBase({ Width: 60 }),
      sinkBase({ Width: 60 }),
    ]);
    expect(symmetric).not.toContain("asymmetrical");

    const asymmetric = computeStyles([
      sinkBase({ Width: 60 }),
      sinkBase({ Width: 80 }),
    ]);
    expect(asymmetric).toContain("asymmetrical");
  });
});

describe("enrichProduct", () => {
  it("adds derived size and style to the raw model", () => {
    const enriched = enrichProduct({
      id: 1,
      img: "",
      title: 'Foo · 36" 1-Drawer',
      isProductModel: true,
      presetProducts: [sinkBase({ Drawers: "1D", sinkType: "Top_X" })],
    });

    expect(enriched.size).toBe("30_39");
    expect(enriched.style).toEqual(expect.arrayContaining(["1_drawer", "single_basin"]));
    expect(enriched.id).toBe(1);
  });
});
