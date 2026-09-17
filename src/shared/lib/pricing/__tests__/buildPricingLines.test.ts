import { beforeEach, describe, expect, it, vi } from "vitest";

import { calcTotalCountertopWidthCm } from "@/entities/countertop";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { deriveBookMatchingChargeInfo } from "@/shared/lib/bookMatching";
import { createSkuBuilders } from "@/shared/lib/sku";
import { ushSkuProfile } from "@/shared/lib/sku/__tests__/ushSkuProfileFixture";

import { buildPricingLines } from "../buildPricingLines";
import { expandLineSkus } from "../pricingLines";
import { cabinet, pricingInput } from "./fixtures/pricingScenarios";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

const PRODUCT_IDS = ["Sink-Base-aaaaaa", "Sink-Base-bbbbbb"];

describe("buildPricingLines", () => {
  it("keeps two identical cabinets as two pieces, each with its own line", () => {
    const lines = buildPricingLines(pricingInput());
    const cabinets = lines.filter(({ group }) => group === "cabinet");

    expect(cabinets.map(({ id, sourceId, quantity }) => ({ id, sourceId, quantity }))).toEqual([
      { id: "cabinet:Sink-Base-aaaaaa", sourceId: "Sink-Base-aaaaaa", quantity: 1 },
      { id: "cabinet:Sink-Base-bbbbbb", sourceId: "Sink-Base-bbbbbb", quantity: 1 },
    ]);
    expect(cabinets[0].sku).toBe(cabinets[1].sku);
    expect(cabinets[0].sku.startsWith("VAN-URSTD-SB/1DW/UG/X-23.6W-20.9H-19.7D")).toBe(true);
    expect(expandLineSkus(lines).filter((sku) => sku === cabinets[0].sku)).toHaveLength(2);
  });

  it("prices the countertop top for the actual width of the composition", () => {
    const narrow = buildPricingLines(pricingInput());
    const wide = buildPricingLines(pricingInput({ sceneConfigs: PRODUCT_IDS.map((id) => cabinet(id, { Width: 80 })) }));
    const top = (lines: ReturnType<typeof buildPricingLines>) => lines.find(({ id }) => id === "countertop:0");

    expect(top(narrow)).toMatchObject({
      group: "countertop",
      widthCm: calcTotalCountertopWidthCm(120, "none", "none"),
    });
    expect(top(wide)).toMatchObject({ group: "countertop", widthCm: calcTotalCountertopWidthCm(160, "none", "none") });
    expect(top(wide)?.sku).not.toBe(top(narrow)?.sku);
  });

  it("gives every sink base its basin and spells the faucet holes with the collection series", () => {
    const lines = buildPricingLines(pricingInput());

    expect(lines.filter(({ group }) => group === "basin").map(({ id }) => id)).toEqual([
      "countertop:basin:config-0",
      "countertop:basin:config-1",
    ]);
    expect(lines.filter(({ group }) => group === "faucetHoles").every(({ sku }) => sku.startsWith("CT-UR"))).toBe(true);
  });

  it.each(["0", "2"])("orders a vessel cutout per sink base with %s faucet holes", (faucetHolesAmount) => {
    const lines = buildPricingLines(
      pricingInput({
        countertopStyle: "vessel",
        countertopColorSku: "SSTKR",
        sinkType: "Vessel_UrbanModo",
        faucetHolesAmount,
      }),
    );

    expect(lines.filter(({ group }) => group === "holeCut").map(({ quantity }) => quantity)).toEqual([2]);
    expect(lines.filter(({ group }) => group === "faucetHoles").every(({ quantity }) => quantity === 1)).toBe(true);
  });

  it("adds a towel bar per side", () => {
    const lines = buildPricingLines(pricingInput({ towelBarOption: "Both", towelBarColor: "Carbone 43 MT" }));

    expect(lines.filter(({ group }) => group === "towelBar").map(({ id }) => id)).toEqual([
      "towelBar:right",
      "towelBar:left",
    ]);
  });

  it("charges book matching per drawer as the quantity of one line", () => {
    const input = pricingInput({
      grainDirection: "GrainVertical",
      bookMatching: "enabled",
      sceneConfigs: PRODUCT_IDS.map((id) => cabinet(id, { Drawers: "2D" })),
    });
    const info = deriveBookMatchingChargeInfo({
      grainDirection: input.grainDirection,
      bookMatching: input.bookMatching,
      cabinets: PRODUCT_IDS.map(() => ({ name: "Sink-Base", drawers: "2D" })),
      profile: ushProfile,
      skuProfile: ushSkuProfile,
    });
    const bookMatchingLines = buildPricingLines(input).filter(({ group }) => group === "bookMatching");

    expect(bookMatchingLines.reduce((sum, { quantity }) => sum + quantity, 0)).toBe(info.applies ? info.drawerQty : 0);
    expect(bookMatchingLines.length).toBeLessThanOrEqual(1);
  });

  it("builds no lines for a collection without an SKU profile", () => {
    const lines = buildPricingLines(
      pricingInput({
        skuBuilders: createSkuBuilders({ status: "unsupported", collectionId: "mako", reason: "no-sku-series" }),
      }),
    );

    expect(lines).toEqual([]);
  });
});
