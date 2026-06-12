import { describe, expect, it } from "vitest";

import { isCountertopTopDynamicCandidate } from "../countertopPricingSku";

const widthCm = 191;

const buildTopSku = ({
  material = "SSTKR",
  style = "INTG",
  width = "75.2",
  thickness = ".5",
  depth = "19.9",
  color = "FF",
}: {
  material?: string;
  style?: string;
  width?: string;
  thickness?: string;
  depth?: string;
  color?: string;
} = {}) => `CT-UR${material}-${style}-${width}W-${thickness}H-${depth}D-${material}-${color}`;

describe("isCountertopTopDynamicCandidate", () => {
  it("detects the documented dynamic SKU with CT category and UR material prefix", () => {
    expect(isCountertopTopDynamicCandidate("CT-URSSTKR-INTG-75.2W-.5H-19.9D-SSTKR-FF", widthCm)).toBe(true);
  });

  it.each([1, 87, 191])("accepts numeric widthCm=%i as a positive dynamic pricing input", (candidateWidthCm) => {
    expect(isCountertopTopDynamicCandidate(buildTopSku(), candidateWidthCm)).toBe(true);
  });

  it.each(["FX", "HPL", "POR", "SSTM", "SSTKR", "SSOCR", "SSMMO", "GLSM", "GLSG", "SSSYN"])(
    "allows countertop material %s",
    (material) => {
      expect(isCountertopTopDynamicCandidate(buildTopSku({ material }), widthCm)).toBe(true);
    },
  );

  it.each(["INTG", "VES", "UDMT", "X"])("allows countertop top style token %s", (style) => {
    expect(isCountertopTopDynamicCandidate(buildTopSku({ style }), widthCm)).toBe(true);
  });

  it.each([
    ".5",
    "0.5",
    ".4",
    "0.4",
    "0.375",
    "4",
    "4.0",
    "5.125",
    "5.1",
    "2.5",
    "2.375",
    "2.4",
  ])("treats thickness token %sH as valid when SKU has CT category and UR material prefix", (thickness) => {
    expect(isCountertopTopDynamicCandidate(buildTopSku({ thickness }), widthCm)).toBe(true);
  });

  it.each([
    ["SKU without CT category prefix", "ST-URSSTKR-INTG-75.2W-.5H-19.9D-SSTKR-FF"],
    ["CT SKU without UR material prefix", "CT-SSTKR-INTG-75.2W-.5H-19.9D-SSTKR-FF"],
    ["material outside whitelist", buildTopSku({ material: "WOOD" })],
    ["missing width token", "CT-URSSTKR-INTG-.5H-19.9D-SSTKR-FF"],
    ["missing height token", "CT-URSSTKR-INTG-75.2W-19.9D-SSTKR-FF"],
    ["missing depth token", "CT-URSSTKR-INTG-75.2W-.5H-SSTKR-FF"],
    ["invalid top thickness", buildTopSku({ thickness: "3" })],
    ["faucet-hole matrix SKU", "CT-URSSTKR-FAHO/2"],
    ["hole-cut matrix SKU", "CT-URSSTKR-HCUT"],
    ["basin/matrix SKU without top style dimension block", "CT-URSSTKR-RECT-.5H-SSTKR-FF"],
  ])("rejects %s", (_caseName, sku) => {
    expect(isCountertopTopDynamicCandidate(sku, widthCm)).toBe(false);
  });

  it.each([null, undefined, 0, -1])("rejects widthCm %s", (candidateWidthCm) => {
    expect(isCountertopTopDynamicCandidate(buildTopSku(), candidateWidthCm)).toBe(false);
  });
});
