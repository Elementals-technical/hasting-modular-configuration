import { describe, expect, it } from "vitest";

import { buildCabinetCoverSku, type CabinetCoverSkuInput } from "../buildCabinetCoverSku";

// 33.5″ × 19.9″, as the cover SKUs the product sheet lists.
const cover = (overrides: Partial<CabinetCoverSkuInput> = {}): CabinetCoverSkuInput => ({
  prefix: "UR",
  style: "vessel",
  widthCm: 85.09,
  depthCm: 50.55,
  thicknessIn: 0.5,
  materialSku: "3D",
  colorCode: "10B",
  ...overrides,
});

describe("buildCabinetCoverSku", () => {
  it.each([
    ["3D", "10B", "CT-UR3D-VES-33.5W-.5H-19.9D-3D-10B"],
    ["LACM", "77", "CT-URLACM-VES-33.5W-.5H-19.9D-LACM-77"],
    ["LACG", "A6", "CT-URLACG-VES-33.5W-.5H-19.9D-LACG-A6"],
    ["ST", "43", "CT-URST-VES-33.5W-.5H-19.9D-ST-43"],
    ["BM", "2MA", "CT-URBM-VES-33.5W-.5H-19.9D-BM-2MA"],
    ["ESS", "06A", "CT-URESS-VES-33.5W-.5H-19.9D-ESS-06A"],
  ])("spells the %s cover of the product sheet", (materialSku, colorCode, sku) => {
    expect(buildCabinetCoverSku(cover({ materialSku, colorCode }))).toBe(sku);
  });

  it("goes with the top's style: an integrated top gives INTG", () => {
    expect(buildCabinetCoverSku(cover({ style: "integrated" }))).toBe("CT-UR3D-INTG-33.5W-.5H-19.9D-3D-10B");
    // A preset spells it as its label.
    expect(buildCabinetCoverSku(cover({ style: "Integrated" }))).toBe("CT-UR3D-INTG-33.5W-.5H-19.9D-3D-10B");
  });

  it("gives no SKU while a part is unknown", () => {
    expect(buildCabinetCoverSku(cover({ style: null }))).toBeNull();
    expect(buildCabinetCoverSku(cover({ style: "unknown" }))).toBeNull();
    expect(buildCabinetCoverSku(cover({ materialSku: null }))).toBeNull();
    expect(buildCabinetCoverSku(cover({ colorCode: null }))).toBeNull();
    expect(buildCabinetCoverSku(cover({ widthCm: 0 }))).toBeNull();
    expect(buildCabinetCoverSku(cover({ depthCm: null }))).toBeNull();
  });
});
