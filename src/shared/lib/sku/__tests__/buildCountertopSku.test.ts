import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildCountertopSku,
  buildCountertopSkuIfComplete,
  canBuildCountertopSku,
  type CountertopSkuInput,
} from "../buildCountertopSku";
import { basinSkuMap, countertopMaterialSkuMap, countertopStyleSkuMap } from "../countertopSkuMaps";

const baseInput: CountertopSkuInput = {
  style: "integrated",
  width: 191,
  depth: 50.5,
  thickness: "0.5",
  basinType: null,
  faucetHolesAmount: "0",
  countertopMaterialSku: "SSTKR",
  countertopColorCode: "FF",
};

const buildSku = (overrides: Partial<CountertopSkuInput> = {}) => buildCountertopSku({ ...baseInput, ...overrides });

const parseTopSku = (sku: string) => {
  const [category, product, style, width, height, depth, material, color] = sku.split("-");
  return { category, product, style, width, height, depth, material, color };
};

const requiredBasinTokens = [
  "COVER",
  "PRISMA",
  "QUAD",
  "STRIP",
  "RECT",
  "NET",
  "OVL",
  "DIA",
  "OLY55",
  "OLY56",
  "ORION",
  "RAYO",
  "ROLL",
  "SYNT",
  "TIVI",
];

describe("buildCountertopSku", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds the documented CT countertop top SKU format", () => {
    expect(buildSku()).toEqual(["CT-URSSTKR-INTG-75.2W-.5H-19.9D-SSTKR-FF"]);
  });

  it("builds top SKU tokens in the documented positions", () => {
    expect(parseTopSku(buildSku()[0])).toEqual({
      category: "CT",
      product: "URSSTKR",
      style: "INTG",
      width: "75.2W",
      height: ".5H",
      depth: "19.9D",
      material: "SSTKR",
      color: "FF",
    });
  });

  it.each(Object.values(countertopMaterialSkuMap))("builds top SKU with countertop material %s", (materialSku) => {
    expect(buildSku({ countertopMaterialSku: materialSku })[0]).toBe(
      `CT-UR${materialSku}-INTG-75.2W-.5H-19.9D-${materialSku}-FF`,
    );
  });

  it.each([
    ["Tekorlux", "SSTKR"],
    ["Fenix", "FX"],
    ["Porcelain", "POR"],
  ])("maps countertop material name %s to top SKU material %s", (materialName, materialSku) => {
    expect(buildSku({ countertopMaterialSku: materialName })[0]).toBe(
      `CT-UR${materialSku}-INTG-75.2W-.5H-19.9D-${materialSku}-FF`,
    );
  });

  it.each(Object.entries(countertopStyleSkuMap))("maps style %s to top SKU token %s", (style, styleSku) => {
    expect(buildSku({ style })[0]).toBe(`CT-URSSTKR-${styleSku}-75.2W-.5H-19.9D-SSTKR-FF`);
  });

  it.each(["INTG", "VES", "UDMT", "X"])("accepts mapped style token %s as input", (styleSku) => {
    expect(buildSku({ style: styleSku })[0]).toBe(`CT-URSSTKR-${styleSku}-75.2W-.5H-19.9D-SSTKR-FF`);
  });

  it("accepts case-insensitive style and material input", () => {
    expect(buildSku({ style: "Integrated", countertopMaterialSku: "tekorlux" })[0]).toBe(
      "CT-URSSTKR-INTG-75.2W-.5H-19.9D-SSTKR-FF",
    );
  });

  it.each([
    ["0.5", ".5"],
    [".5", ".5"],
    ["0.4", ".4"],
    ["0.375", ".4"],
    ["4", "4"],
    ["4.0", "4"],
    ["5.125", "5.1"],
    ["5.5", "5.5"],
    ["2.5", "2.4"],
    ["2.375", "2.4"],
  ])("normalizes thickness input %s for SKU output", (thickness, expectedToken) => {
    expect(buildSku({ thickness })[0]).toBe(`CT-URSSTKR-INTG-75.2W-${expectedToken}H-19.9D-SSTKR-FF`);
  });

  it.each(requiredBasinTokens)("builds basin line with basin token %s", (basinToken) => {
    expect(buildSku({ basinType: basinToken })[1]).toBe(`CT-URSSTKR-${basinToken}-.5H-SSTKR-FF`);
  });

  it("covers every required basin token through the current basin SKU map", () => {
    const currentBasinTokens = new Set(Object.values(basinSkuMap));

    expect(requiredBasinTokens.every((token) => currentBasinTokens.has(token))).toBe(true);
  });

  it("keeps faucet holes and vessel hole cutout as separate CT SKU lines", () => {
    expect(
      buildSku({
        style: "vessel",
        faucetHolesAmount: "2",
      }),
    ).toEqual(["CT-URSSTKR-VES-75.2W-.5H-19.9D-SSTKR-FF", "CT-URSSTKR-FAHO/2", "CT-URSSTKR-HCUT"]);
  });

  it.each([
    ["T1C", "SSOCR"],
    ["T1D", "SSOCR"],
    ["TAN", "SSSYN"],
    ["TAP", "SSSYN"],
  ])("infers countertop material %s from color code %s", (colorCode, materialSku) => {
    expect(buildSku({ countertopColorCode: colorCode })[0]).toBe(
      `CT-UR${materialSku}-INTG-75.2W-.5H-19.9D-${materialSku}-${colorCode}`,
    );
  });

  it.each([
    ["Top_Ocritech_Rayo", "SSOCR", "RAYO"],
    ["Top_Tekorlux_Rectangular", "SSTKR", "RECT"],
    ["Top_HPLPrisma", "HPL", "PRISMA"],
  ])("infers countertop material %s from basin type %s", (basinType, materialSku, basinSku) => {
    expect(buildSku({ basinType, countertopMaterialSku: null })).toEqual([
      `CT-UR${materialSku}-INTG-75.2W-.5H-19.9D-${materialSku}-FF`,
      `CT-UR${materialSku}-${basinSku}-.5H-${materialSku}-FF`,
    ]);
  });

  it("throws when countertop material and color are missing", () => {
    expect(() => buildSku({ countertopMaterialSku: null, countertopColorCode: null })).toThrow(
      "Cannot build countertop SKU without countertop material or color code",
    );
  });

  it("throws when countertop material cannot be resolved from an unmapped color code", () => {
    expect(() => buildSku({ countertopMaterialSku: null, countertopColorCode: "FF" })).toThrow(
      "Cannot build countertop SKU without countertop material or color code",
    );
  });

  it.each([
    ["width", { width: null }],
    ["depth", { depth: null }],
    ["thickness", { thickness: null }],
  ] satisfies Array<[string, Partial<CountertopSkuInput>]>)("throws when %s is missing", (_caseName, overrides) => {
    expect(() => buildSku(overrides)).toThrow(
      "Cannot build countertop SKU without width, depth, and thickness",
    );
  });

  it.each([
    ["abc"],
    [""],
    ["   "],
  ])("throws when thickness %s is not a finite number", (thickness) => {
    expect(() => buildSku({ thickness })).toThrow("Cannot build countertop SKU without width, depth, and thickness");
  });

  it.each([
    ["zero width", { width: 0 }],
    ["zero depth", { depth: 0 }],
    ["negative width", { width: -1 }],
    ["negative depth", { depth: -1 }],
  ] satisfies Array<[string, Partial<CountertopSkuInput>]>)("throws for %s", (_caseName, overrides) => {
    expect(() => buildSku(overrides)).toThrow(
      "Cannot build countertop SKU without width, depth, and thickness",
    );
  });

  it("throws when countertop style is unknown", () => {
    expect(() => buildSku({ style: "unknown" })).toThrow(
      "Cannot build countertop SKU with unknown countertop style",
    );
  });

  it("throws when countertop color code is empty", () => {
    expect(() => buildSku({ countertopColorCode: "" })).toThrow(
      "Cannot build countertop SKU without countertop color code",
    );
  });

  it.each([
    ["summary totalCountertopWidth", { width: null }, "Cannot build countertop SKU without width, depth, and thickness"],
    ["summary depth", { depth: null }, "Cannot build countertop SKU without width, depth, and thickness"],
    ["summary thickness", { thickness: null }, "Cannot build countertop SKU without width, depth, and thickness"],
    ["summary color", { countertopColorCode: null }, "Cannot build countertop SKU without countertop color code"],
    [
      "summary material",
      { countertopMaterialSku: null, countertopColorCode: "FF" },
      "Cannot build countertop SKU without countertop material or color code",
    ],
  ] satisfies Array<[string, Partial<CountertopSkuInput>, string]>)(
    "throws when %s is missing",
    (_caseName, overrides, expectedError) => {
      expect(() => buildSku(overrides)).toThrow(expectedError);
    },
  );

  it("builds SKU lines through the summary-safe guard when required data is complete", () => {
    expect(canBuildCountertopSku(baseInput)).toBe(true);
    expect(buildCountertopSkuIfComplete(baseInput)).toEqual(["CT-URSSTKR-INTG-75.2W-.5H-19.9D-SSTKR-FF"]);
  });
});
