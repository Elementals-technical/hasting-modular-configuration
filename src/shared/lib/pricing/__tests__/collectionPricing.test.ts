import { describe, expect, it } from "vitest";

import makoPresetsDocument from "../../../../../public/collections/mako/presets.json";

import { normalizeOptionValue, presetsSchema } from "@/entities/collection";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import type { ValueTarget } from "@/entities/configuration";

import {
  derivePriceStatus,
  priceStoreReducer,
  setPricingGaps,
  setPricingLines,
  setSkuPriceEntries,
  type SkuPriceEntry,
} from "@/entities/product/model/store/priceStore";
import { createSkuBuilders } from "@/shared/lib/sku";

import { buildCollectionPricingLines } from "../buildCollectionPricingLines";
import { resolvePriceFromResponse, resolvePriceRequest } from "../priceRequests";
import {
  at,
  COLLECTION_PRICING_SCENARIOS,
  CLASS,
  collectionPricingInput,
  MAKO,
  type CollectionPricingScenarioId,
} from "./fixtures/collectionPricingScenarios";
import classOrder from "./fixtures/prices/class-porcelain-integrated.json";
import makoOrder from "./fixtures/prices/mako-vessel-with-legs.json";

/**
 * Class and Mako orders (D04): the lines built from C's state, the parts the collections have not
 * confirmed, and the reference totals against the recorded answers of the price server.
 */

type RecordedPrices = { scenario: string; recordedAt: string; answers: Record<string, Record<string, unknown>> };

const RECORDED: Record<CollectionPricingScenarioId, RecordedPrices> = {
  "class-porcelain-integrated": classOrder as RecordedPrices,
  "mako-vessel-with-legs": makoOrder as RecordedPrices,
};

/**
 * Each price read off the collection's workbook by hand. The countertop top is its rate per cm to
 * the cent times the width, rounded up to the dollar (Class/Mako CountertopPricing, column F);
 * everything else is the workbook price rounded to the dollar.
 */
const WORKBOOK_PRICES: Record<CollectionPricingScenarioId, Record<string, number>> = {
  "class-porcelain-integrated": {
    // CabinetPricing: SB/2DW 31.5W and SC/2DW 15.7W, POR/C (colour frame).
    "VAN-CLSV-SB/2DW-31.5W-20.5H-20.5D-CABF-POR/C-338-CABS-LACM-410-FRM-LACM-410": 5084,
    "VAN-CLSV-SC/2DW-15.7W-20.5H-20.5D-CABF-POR/C-338-CABS-LACM-410-FRM-LACM-410": 4016,
    // CountertopPricing: HPL .5 at 15.30 / cm × 120 cm.
    "CT-GBHPL-INTG-47.2W-.5H-20.7D-HPL-259": 1836,
    // Basin StylePricing: HPL VA024, 3713.99.
    "CT-GBHPL-VA024-.5H": 3714,
    // AccessoriesPricing: one faucet hole is free.
    "CT-GBHPL-FAHO/1": 0,
  },
  "mako-vessel-with-legs": {
    // CabinetPricing: SB/2DW/G57 and SC/2DW/G50 23.6W, LACG.
    "VAN-MAKOV-SB/2DW/G57-23.6W-20.5H-20.5D-CAB-LACG-403-HDL-MTL-SLV": 3028,
    "VAN-MAKOV-SC/2DW/G50-23.6W-20.5H-20.5D-CAB-LACG-403-HDL-MTL-SLV": 2938,
    // CabinetPricing A54: a leg costs 745 in metal and 1340 in matte lacquer; a pair is ordered.
    "VAN-MAKOV-LEG-MTL": 745,
    // CountertopPricing: SS Technolite .5 at 13.11 / cm × 120 cm = 1573.20, rounded up.
    "CT-GBSSTL-VES-47.2W-.5H-20.7D": 1574,
    // Class AccessoriesPricing, which Mako refers to: SSTL cutout 607.69 and three holes.
    "CT-GBSSTL-HCUT": 608,
    "CT-GBSSTL-FAHO/3": 275,
    "VAN-GBDIV-OAK-3.8W-2.6H-16.9D": 150,
  },
};

const EXPECTED = {
  "class-porcelain-integrated": { total: 14650, status: "ready" },
  // The pair of legs is priced; the Iris vessel is not, so the total leaves it out and says so.
  "mako-vessel-with-legs": { total: 10063, status: "partial" },
} as const;

const entriesOf = (scenario: CollectionPricingScenarioId): Record<string, SkuPriceEntry> =>
  Object.fromEntries(
    Object.entries(RECORDED[scenario].answers).map(([sku, answer]) => {
      const price = resolvePriceFromResponse(answer);
      return [sku, typeof price === "number" ? { status: "ready", value: price } : { status: "missing" }];
    }),
  );

const priceScenario = (scenario: CollectionPricingScenarioId) => {
  const { lines, gaps } = buildCollectionPricingLines(COLLECTION_PRICING_SCENARIOS[scenario].input);

  return [setPricingLines(lines), setPricingGaps(gaps), setSkuPriceEntries(entriesOf(scenario))].reduce(
    (state, action) => priceStoreReducer(state, action),
    priceStoreReducer(undefined, { type: "init" }),
  );
};

describe("Class and Mako order lines", () => {
  it("lists every cabinet, the top over the whole composition, the basin of its sink base and the faucet holes", () => {
    const { lines, gaps } = buildCollectionPricingLines(
      COLLECTION_PRICING_SCENARIOS["class-porcelain-integrated"].input,
    );

    expect(lines.map(({ id, group, quantity, widthCm }) => ({ id, group, quantity, widthCm }))).toEqual([
      { id: "cabinet:Sink-Base-aaa111", group: "cabinet", quantity: 1, widthCm: undefined },
      { id: "cabinet:Sink-Cabinet-bbb222", group: "cabinet", quantity: 1, widthCm: undefined },
      { id: "countertop:0", group: "countertop", quantity: 1, widthCm: 120 },
      { id: "countertop:basin:cls-sb", group: "basin", quantity: 1, widthCm: undefined },
      { id: "countertop:faucetDefault", group: "faucetHoles", quantity: 1, widthCm: undefined },
    ]);
    expect(gaps).toEqual([]);
  });

  it("cuts a vessel top once per sink base, adds the organizer and names what the order uses unconfirmed", () => {
    const { lines, gaps } = buildCollectionPricingLines(COLLECTION_PRICING_SCENARIOS["mako-vessel-with-legs"].input);

    expect(lines.find(({ group }) => group === "holeCut")).toMatchObject({ sku: "CT-GBSSTL-HCUT", quantity: 1 });
    expect(lines.find(({ group }) => group === "divider")).toMatchObject({ id: "divider:mko-sb:Top", quantity: 1 });
    expect(lines.some(({ group }) => group === "basin")).toBe(false);
    expect(lines.find(({ group }) => group === "legs")).toMatchObject({ sku: "VAN-MAKOV-LEG-MTL", quantity: 2 });
    expect(gaps.map(({ group, blocksTotal }) => [group, blocksTotal])).toEqual([
      ["vessel", true],
      ["solidSurfaceGroup", false],
      ["divider", false],
    ]);
  });

  it("reads the Mako cabinets the scene placed as its Mako products", () => {
    const { input } = COLLECTION_PRICING_SCENARIOS["mako-vessel-with-legs"];
    const sceneIds = ["Mako-sink-cabinet-k3j4h5g6f", "Mako-side-cabinet-a1b2c3d4e"];
    const placed = buildCollectionPricingLines({
      ...input,
      runtimeBindings: makoRuntimeBindings,
      cabinetEntries: input.cabinetEntries.map((entry, index) => ({ ...entry, runtimeId: sceneIds[index] })),
    });
    const skus = (lines: { sku: string }[]) => lines.map(({ sku }) => sku);

    // The same order as with the ids the fixture gives: the sink base keeps its cutout.
    expect(skus(placed.lines)).toEqual(skus(buildCollectionPricingLines(input).lines));
    expect(placed.lines.find(({ group }) => group === "holeCut")).toMatchObject({ quantity: 1 });
  });

  it("addresses the cabinets of a model by their place in it, as the Summary of a model reads them", () => {
    const { input } = COLLECTION_PRICING_SCENARIOS["mako-vessel-with-legs"];
    // A cabinet added on top of the two-cabinet model, which the Summary reads by its runtime id.
    const added = { stableKey: "mko-added", runtimeId: "Sink-Cabinet-fff666", index: 2 };
    const { lines } = buildCollectionPricingLines({
      ...input,
      shouldUsePresets: true,
      productsPresets: [{ name: "Sink-Base" }, { name: "Sink-Cabinet" }],
      productIds: [...input.cabinetEntries.map(({ runtimeId }) => runtimeId), added.runtimeId],
      cabinetEntries: [...input.cabinetEntries, added],
      dimensionsByCabinet: { ...input.dimensionsByCabinet, [added.stableKey]: { width: 60, height: 52, depth: 52 } },
    });

    expect(lines.filter(({ group }) => group === "cabinet").map(({ id, sourceId }) => [id, sourceId])).toEqual([
      ["cabinet:preset-0", "Sink-Base-ccc333"],
      ["cabinet:preset-1", "Sink-Cabinet-ddd444"],
      ["cabinet:Sink-Cabinet-fff666", "Sink-Cabinet-fff666"],
    ]);
  });

  it("keeps two identical cabinets as two lines", () => {
    const cabinet = (stableKey: string, runtimeId: string) => ({
      stableKey,
      runtimeId,
      size: { width: 60, height: 52, depth: 52 },
    });
    const { lines } = buildCollectionPricingLines(
      collectionPricingInput(MAKO, [cabinet("a", "Sink-Base-a1"), cabinet("b", "Sink-Base-b2")], {
        Drawers: [at({ scope: "global" }, "2")],
        Handle: [at({ scope: "global" }, "G57")],
        CabinetColor: [at({ scope: "global" }, "Nero 433 MT")],
      }),
    );
    const cabinetLines = lines.filter(({ group }) => group === "cabinet");

    expect(cabinetLines).toHaveLength(2);
    expect(new Set(cabinetLines.map(({ sku }) => sku)).size).toBe(1);
  });

  it("marks a Class front without a frame colour as an input the price cannot do without", () => {
    const { gaps } = buildCollectionPricingLines(
      collectionPricingInput(
        CLASS,
        [{ stableKey: "a", runtimeId: "Sink-Base-a1", size: { width: 60, height: 52, depth: 52 } }],
        { CabinetColor: [at({ scope: "global" }, "Nero 433 MT")] },
      ),
    );

    expect(gaps).toEqual([expect.objectContaining({ group: "input", blocksTotal: true })]);
  });

  it("builds nothing without a collection SKU profile", () => {
    const input = {
      ...COLLECTION_PRICING_SCENARIOS["class-porcelain-integrated"].input,
      skuBuilders: createSkuBuilders({ status: "unsupported", collectionId: "class", reason: "no-sku-series" }),
    };

    expect(buildCollectionPricingLines(input)).toEqual({ lines: [], gaps: [] });
  });

  const MAKO_MODELS = presetsSchema.parse(makoPresetsDocument);
  const modelWithLegs = MAKO_MODELS.find(({ presetProducts }) => presetProducts.some(({ LegColor }) => LegColor));

  /**
   * The first cabinet of a shipped Mako model, with the values the preset path leaves in C's
   * state: the cabinet colour once for the configuration, the rest at the cabinet that carries them.
   */
  const makoModelInput = (model: (typeof MAKO_MODELS)[number], cabinetColor?: string) => {
    const [product] = model.presetProducts;
    const cabinet: ValueTarget = { scope: "cabinet", cabinetId: "mko-model" };

    return collectionPricingInput(
      MAKO,
      [
        {
          stableKey: "mko-model",
          runtimeId: "Sink-Base-eee555",
          size: { width: product.Width ?? 0, height: product.Height ?? 0, depth: product.Depth ?? 0 },
        },
      ],
      {
        Drawers: [at(cabinet, normalizeOptionValue(MAKO.profile, "Drawers", product.Drawers) ?? "")],
        Handle: [at(cabinet, product.Handle ?? "")],
        HandleColor: [at(cabinet, product.HandleColor ?? "")],
        LegColor: product.LegColor ? [at(cabinet, product.LegColor)] : [],
        CabinetColor: [at({ scope: "global" }, cabinetColor ?? product.CabinetColor ?? "")],
      },
    );
  };

  it("prices the cabinet of a shipped Mako model with its material and colour", () => {
    const { lines } = buildCollectionPricingLines(makoModelInput(MAKO_MODELS[0]));

    expect(lines[0].sku).toBe("VAN-MAKOV-SB/1DW/G57-23.6W-10.2H-20.5D-CAB-LACM-400-HDL-LACM-400");
  });

  it("stands a shipped Mako model on its pair of legs, in the cabinet's colour", () => {
    if (!modelWithLegs) throw new Error("No Mako model carries legs");
    const { lines, gaps } = buildCollectionPricingLines(makoModelInput(modelWithLegs));

    // `LegColor: "None"` is not a colour of its own: the legs take the cabinet's.
    expect(lines.find(({ group }) => group === "legs")).toMatchObject({
      id: "legs",
      sku: "VAN-MAKOV-LEG-LACM-400",
      quantity: 2,
    });
    expect(gaps).toEqual([]);
  });

  it("leaves a model without legs without a legs line", () => {
    const { lines } = buildCollectionPricingLines(makoModelInput(MAKO_MODELS[0]));

    expect(lines.some(({ group }) => group === "legs")).toBe(false);
  });

  it("prices the cabinet and its legs in the colour the builder starts from until one is chosen", () => {
    if (!modelWithLegs) throw new Error("No Mako model carries legs");
    const input = makoModelInput(modelWithLegs);
    const { lines } = buildCollectionPricingLines({
      ...input,
      configurationValues: { ...input.configurationValues, CabinetColor: [] },
      cabinetColor: MAKO.profile.defaults.CabinetColor,
    });

    expect(lines[0].sku).toContain("-CAB-LACM-400-");
    expect(lines.find(({ group }) => group === "legs")?.sku).toBe("VAN-MAKOV-LEG-LACM-400");
  });

  it("keeps the chosen cabinet colour over the one the builder starts from", () => {
    const { lines } = buildCollectionPricingLines({
      ...makoModelInput(MAKO_MODELS[0], "Nero 433 MT"),
      cabinetColor: MAKO.profile.defaults.CabinetColor,
    });

    expect(lines[0].sku).toContain("-CAB-LACM-433-");
  });

  it("names a colour the collection has no material for instead of pricing the cabinet without it", () => {
    // The scene's Mako material, which is not one of the colours the collection offers.
    const { lines, gaps } = buildCollectionPricingLines(makoModelInput(MAKO_MODELS[0], "Antracite Matte OCF"));

    expect(lines[0].sku).not.toContain("-CAB-");
    expect(gaps).toContainEqual(expect.objectContaining({ group: "input", blocksTotal: true }));
  });
});

describe("Class and Mako reference orders", () => {
  it.each(Object.keys(EXPECTED) as CollectionPricingScenarioId[])(
    "the server charges the workbook price of every SKU of %s",
    (scenario) => {
      const recorded = Object.fromEntries(
        Object.entries(RECORDED[scenario].answers).map(([sku, answer]) => [sku, resolvePriceFromResponse(answer)]),
      );

      expect(recorded).toEqual(WORKBOOK_PRICES[scenario]);
    },
  );

  it.each(Object.keys(EXPECTED) as CollectionPricingScenarioId[])("totals %s", (scenario) => {
    const state = priceScenario(scenario);

    expect(state.total).toBe(EXPECTED[scenario].total);
    expect(derivePriceStatus(state)).toBe(EXPECTED[scenario].status);
  });

  it("prices the top per cm of the composition", () => {
    expect(
      resolvePriceRequest({
        sku: "CT-GBHPL-INTG-47.2W-.5H-20.7D-HPL-259",
        widthCm: 120,
        countertopPrefix: null,
        bookMatchingSkuPrefix: null,
        pricedPerCm: true,
      }),
    ).toEqual({ kind: "countertopTop", widthCm: 120 });
  });
});

describe("price status with unconfirmed parts", () => {
  const priced = priceStoreReducer(
    priceStoreReducer(
      undefined,
      setPricingLines([{ id: "cabinet:a", group: "cabinet", sku: "VAN-MAKOV-SB", quantity: 1 }]),
    ),
    setSkuPriceEntries({ "VAN-MAKOV-SB": { status: "ready", value: 100 } }),
  );

  it("stays complete with notes that do not change the price", () => {
    const state = priceStoreReducer(
      priced,
      setPricingGaps([{ group: "divider", blocksTotal: false, owner: "product", reason: "unit" }]),
    );

    expect(derivePriceStatus(state)).toBe("ready");
  });

  it("is incomplete while the order uses a part without a price", () => {
    const state = priceStoreReducer(
      priced,
      setPricingGaps([{ group: "legs", blocksTotal: true, owner: "product", reason: "quantity" }]),
    );

    expect(derivePriceStatus(state)).toBe("partial");
    expect(state.total).toBe(100);
  });
});
