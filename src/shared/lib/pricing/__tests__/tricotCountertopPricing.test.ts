import { describe, expect, it } from "vitest";

import {
  tricotConfigurator,
  tricotProfile,
  tricotSkuProfile,
  tricotTestBindings,
} from "@/entities/collection/__tests__/tricotFixtures";
import { createSkuBuilders } from "@/shared/lib/sku";

import { buildCollectionPricingLines } from "../buildCollectionPricingLines";
import { pricingInput } from "./fixtures/pricingScenarios";

/**
 * The default Tricot model priced from its SKU profile: its top and basin are the Class GB ones.
 * The price server answered these SKUs on 2026-10-09: the top $787 (13.11 $/cm × 60), LB440 $1,882,
 * no faucet holes $0, the cabinet $3,584.
 */

const defaults = tricotProfile.defaults as Record<string, string>;
const sinkBase = { target: { scope: "cabinet" as const, cabinetId: "cab-1" } };

const defaultModel = () =>
  pricingInput({
    activeProfile: tricotProfile,
    runtimeBindings: tricotTestBindings,
    configurator: tricotConfigurator,
    skuBuilders: createSkuBuilders({ status: "collection", collectionProfile: tricotSkuProfile }),
    cabinetEntries: [{ stableKey: "cab-1", runtimeId: "test-tricot-sb-1", index: 0 }],
    dimensionsByCabinet: { "cab-1": { width: 60, height: 40, depth: 52 } },
    placedCabinetStyles: { "test-tricot-sb-1": "1" },
    cabinetColor: defaults.CabinetColor,
    handleGrooveColor: defaults.HandleGrooveColor,
    countertopColor: defaults.CountertopColor,
    countertopStyle: defaults.CountertopStyle,
    sinkType: defaults.sinkType,
    configurationValues: {
      CabinetType: [{ ...sinkBase, value: "Sink-Base" }],
      DrawerPanelFluting: [{ ...sinkBase, value: defaults.DrawerPanelFluting }],
    },
  });

describe("Tricot default model price", () => {
  it("orders the cabinet, the Class GB top and its basin, without a gap that blocks the total", () => {
    const { lines, gaps } = buildCollectionPricingLines(defaultModel());

    expect(lines.map(({ group, sku, widthCm }) => ({ group, sku, ...(widthCm ? { widthCm } : {}) }))).toEqual([
      { group: "cabinet", sku: "VAN-TRIC-SB/1DW/SAT-23.6W-15.7H-20.5D-CAB-WDV-932-HDL-LACM-407" },
      { group: "countertop", sku: "CT-GBHPL-INTG-23.6W-.5H-20.7D-HPL-250", widthCm: 60 },
      { group: "basin", sku: "CT-GBHPL-VA024-.5H" },
      { group: "faucetHoles", sku: "CT-GBHPL-FAHO/0" },
    ]);
    expect(gaps.filter(({ blocksTotal }) => blocksTotal)).toEqual([]);
  });
});

describe("Tricot vessel model price", () => {
  const vesselModel = (sinkType: string, vesselColor: string) =>
    buildCollectionPricingLines({
      ...defaultModel(),
      countertopColor: "Matte White",
      countertopStyle: "vessel",
      sinkType,
      vesselColor,
    });

  it("orders the Class GB vessel top, its cutout and the vessel in its lacquer", () => {
    const { lines, gaps } = vesselModel("Plaza", "Zaffiro 411 GL");

    expect(lines.filter(({ group }) => group !== "cabinet").map(({ group, sku }) => ({ group, sku }))).toEqual([
      { group: "countertop", sku: "CT-GBSSTL-VES-23.6W-.5H-20.7D" },
      { group: "holeCut", sku: "CT-GBSSTL-HCUT" },
      { group: "faucetHoles", sku: "CT-GBSSTL-FAHO/0" },
      { group: "vessel", sku: "VES-PLZ-X-23.6W-4.7H-18.9D-LACG-411" },
    ]);
    expect(gaps.filter(({ blocksTotal }) => blocksTotal)).toEqual([]);
    // The vessels and their palettes are Class's, which the product has not confirmed for Tricot.
    expect(gaps.find(({ group }) => group === "vessel")).toMatchObject({ blocksTotal: false, owner: "product" });
  });

  it("orders no vessel for the bare cutout, nor without a colour, and the price says why", () => {
    expect(vesselModel("None", "").lines.map(({ group }) => group)).not.toContain("vessel");

    const { lines, gaps } = vesselModel("Iris", "");
    expect(lines.map(({ group }) => group)).not.toContain("vessel");
    expect(gaps.filter(({ blocksTotal }) => blocksTotal)).toEqual([
      expect.objectContaining({ reason: "VesselColor is not chosen, so the vessel has no price." }),
    ]);
  });
});
