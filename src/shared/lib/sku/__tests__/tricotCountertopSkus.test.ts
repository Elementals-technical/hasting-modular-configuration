import { describe, expect, it } from "vitest";

import { tricotConfigurator, tricotProfile, tricotSkuProfile } from "@/entities/collection/__tests__/tricotFixtures";
import { hasOwnCountertop } from "@/entities/collection";

import { buildCollectionCountertopSkus, type CollectionCountertopSkuInput } from "../buildCollectionSkus";
import { createConfiguratorColorReader } from "../configuratorColors";

/**
 * The Tricot top is spelled and priced as the Class GB top (team decision 2026-10-09). Each expected
 * SKU is a row of the Class price workbook: Countertop_Pricing for the top, Basin Style_Pricing for
 * the basin and its thickness, Accessories_Pricing for the faucet holes, and its bracket for thick tops.
 */

if (!hasOwnCountertop(tricotSkuProfile)) throw new Error("Tricot spells its countertop itself");
const skuProfile = tricotSkuProfile;
const readConfiguratorColor = createConfiguratorColorReader(tricotProfile, tricotConfigurator);

const countertop = (input: Partial<CollectionCountertopSkuInput>) =>
  buildCollectionCountertopSkus(skuProfile, tricotProfile, {
    style: "integrated",
    color: null,
    thickness: null,
    basins: [],
    widthCm: 60,
    faucetHoles: null,
    readConfiguratorColor,
    ...input,
  });

describe("Tricot countertop SKUs", () => {
  it("spells the default top, Matte White on LB440, as the thin Solid Surface top", () => {
    const defaults = tricotProfile.defaults as Record<string, string>;

    expect(
      countertop({ style: defaults.CountertopStyle, color: defaults.CountertopColor, basins: [defaults.sinkType] }),
    ).toMatchObject({
      top: "CT-GBSSTL-INTG-23.6W-.5H-20.7D",
      basins: ["CT-GBSSTL-LB440-.5H"],
      bracket: null,
    });
    // Tricot offers no faucet hole choice: the top is ordered without holes, which cost nothing.
    expect(countertop({ color: "Matte White", basins: ["LB440"], faucetHoles: "0" }).faucetHoles).toBe(
      "CT-GBSSTL-FAHO/0",
    );
  });

  it("spells each basin family on the material and thickness the price list gives it", () => {
    // Matte White 8cm is Technomat, the only material of VA023, 3.1" thick: a thick top takes the bracket.
    expect(countertop({ color: "Matte White 8cm", basins: ["VA023"] })).toMatchObject({
      top: "CT-GBSSTMT-INTG-23.6W-3.1H-20.7D",
      basins: ["CT-GBSSTMT-VA023-3.1H"],
      bracket: { sku: "CT-GB-BRKT", quantity: 2 },
    });
    expect(countertop({ color: "CALACATTA BLACK 338", basins: ["LV890"] })).toMatchObject({
      top: "CT-GBPOR-INTG-23.6W-.8H-20.7D-POR-338",
      basins: ["CT-GBPOR-LV890-.8H"],
      bracket: null,
    });
    expect(countertop({ color: "CALACATTA 259", basins: ["VA024"] })).toMatchObject({
      top: "CT-GBHPL-INTG-23.6W-.5H-20.7D-HPL-259",
      basins: ["CT-GBHPL-VA024-.5H"],
    });
    expect(countertop({ color: "Nebbia 402 MT", basins: ["VA002"] })).toMatchObject({
      top: "CT-GBGLSM-INTG-23.6W-.5H-20.7D-GLSM-402",
      basins: ["CT-GBGLSM-VA002-.5H"],
    });
    expect(countertop({ color: "Nebbia 402 GL", basins: ["VA005"] }).basins).toEqual(["CT-GBGLSG-VA005-.5H"]);
  });

  it("spells the thick tops the profile offers, with the bracket", () => {
    expect(countertop({ color: "CALACATTA BLACK 338", thickness: "4.75", basins: ["LV892"] })).toMatchObject({
      top: "CT-GBPOR-INTG-23.6W-4.7H-20.7D-POR-338",
      basins: ["CT-GBPOR-LV892-4.7H"],
      bracket: { sku: "CT-GB-BRKT", quantity: 2 },
    });
    expect(countertop({ color: "CALACATTA 259", thickness: "4", basins: ["VA024"] })).toMatchObject({
      top: "CT-GBHPL-INTG-23.6W-4H-20.7D-HPL-259",
      basins: ["CT-GBHPL-VA024-4H"],
      bracket: { sku: "CT-GB-BRKT", quantity: 2 },
    });
    expect(countertop({ color: "Matte White", thickness: "4.75", basins: ["LB856"] }).basins).toEqual([
      "CT-GBSSTL-LB856-4.7H",
    ]);
  });
});
