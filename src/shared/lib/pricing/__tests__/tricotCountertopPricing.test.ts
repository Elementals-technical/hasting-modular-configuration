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
      { group: "cabinet", sku: "VAN-TRIC-SB/1DW/CAN-23.6W-15.7H-20.5D-CAB-WDV-932-HDL-LACM-433" },
      { group: "countertop", sku: "CT-GBSSTL-INTG-23.6W-.5H-20.7D", widthCm: 60 },
      { group: "basin", sku: "CT-GBSSTL-LB440-.5H" },
      { group: "faucetHoles", sku: "CT-GBSSTL-FAHO/0" },
    ]);
    expect(gaps.filter(({ blocksTotal }) => blocksTotal)).toEqual([]);
  });
});
