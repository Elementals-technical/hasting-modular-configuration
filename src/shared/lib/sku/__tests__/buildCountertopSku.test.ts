import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildCountertopSku, type CountertopSkuInput } from "../buildCountertopSku";
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

  it.each(Object.values(countertopMaterialSkuMap))("builds top SKU with countertop material %s", (materialSku) => {
    expect(buildSku({ countertopMaterialSku: materialSku })[0]).toBe(
      `CT-UR${materialSku}-INTG-75.2W-.5H-19.9D-${materialSku}-FF`,
    );
  });

  it.each(Object.entries(countertopStyleSkuMap))("maps style %s to top SKU token %s", (style, styleSku) => {
    expect(buildSku({ style })[0]).toBe(`CT-URSSTKR-${styleSku}-75.2W-.5H-19.9D-SSTKR-FF`);
  });

  it.each([
    ["0.5", ".5"],
    [".5", ".5"],
    ["0.4", ".4"],
    ["4", "4"],
    ["4.0", "4"],
    ["5.125", "5.1"],
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
});
