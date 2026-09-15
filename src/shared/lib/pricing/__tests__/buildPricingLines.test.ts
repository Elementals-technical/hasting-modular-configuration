import { beforeEach, describe, expect, it, vi } from "vitest";

import configurator4 from "@/entities/collection/__tests__/fixtures/remote/configurator-4.json";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import { calcTotalCountertopWidthCm } from "@/entities/countertop";
import { deriveBookMatchingChargeInfo } from "@/shared/lib/bookMatching";
import type { NormalizedProductConfigSnapshot } from "@/shared/lib/normalizeProductConfigSnapshot";
import { createSkuBuilders } from "@/shared/lib/sku";
import { ushSkuProfile } from "@/shared/lib/sku/__tests__/ushSkuProfileFixture";

import { buildColorSkuMaps } from "../buildColorSkuMaps";
import { buildPricingLines } from "../buildPricingLines";
import { expandLineSkus } from "../pricingLines";
import type { PricingInput } from "../types";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

const cabinet = (
  id: string,
  overrides: Partial<NormalizedProductConfigSnapshot> = {},
): NormalizedProductConfigSnapshot => ({
  id,
  _productId: id,
  category: null,
  name: "Sink-Base",
  ProductType: "Sink-Base",
  productType: null,
  type: null,
  entityName: null,
  Width: 60,
  Height: 53,
  Depth: 50.5,
  Thickness: null,
  Drawers: "1D",
  Handle: "handle_urban_topcut",
  CabinetColor: null,
  CountertopColor: null,
  sinkType: null,
  ...overrides,
});

const PRODUCT_IDS = ["Sink-Base-aaaaaa", "Sink-Base-bbbbbb"];

const pricingInput = (overrides: Partial<PricingInput> = {}): PricingInput => ({
  skuBuilders: createSkuBuilders({ status: "ready", profile: ushSkuProfile }),
  activeProfile: ushProfile,
  colorSkuMaps: buildColorSkuMaps(configurator4.availableOptions as unknown as ConfiguratorAvailableOption[]),
  countertopRules: [],
  cabinetCatalog: {
    typeCabinetRules: [{ code: "Sink-Base", widths: [60, 80], depths: [50.5], heights: [53], drawers: ["1", "2"] }],
  },
  shouldUsePresets: false,
  productIds: PRODUCT_IDS,
  orderedProductIds: PRODUCT_IDS,
  productsPresets: [],
  sceneConfigs: PRODUCT_IDS.map((id) => cabinet(id)),
  cabinetEntries: [],
  dimensionsByCabinet: {},
  activeCabinetType: "Sink-Base",
  selectedDimensions: { width: 60, height: 53, depth: 50.5 },
  selectedProductConfig: null,
  placedDividers: [],
  placedCabinetStyles: {},
  cabinetColor: "Castagno chiaro 1C1",
  cabinetColorSku: "",
  handleGrooveColor: "",
  handleGrooveColorSku: "",
  countertopColor: "Cacao Orinoco FF MT",
  countertopColorSku: "",
  vesselColor: "",
  countertopThickness: "0.5",
  countertopStyle: "integrated",
  sinkType: "Top_Tekorlux_Rectangular",
  drawerPanelFluting: "",
  grainDirection: "",
  bookMatching: "",
  towelBarOption: "None",
  towelBarColor: "",
  faucetHolesAmount: "0",
  sidePanelsOption: "",
  sidePanelLeft: "none",
  sidePanelRight: "none",
  ...overrides,
});

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
