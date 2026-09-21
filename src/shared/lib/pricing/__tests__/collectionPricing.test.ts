import { describe, expect, it } from "vitest";

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
  // Legs and the Iris vessel have no confirmed price: the total leaves them out and says so.
  "mako-vessel-with-legs": { total: 8573, status: "partial" },
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
    expect(gaps.map(({ group, blocksTotal }) => [group, blocksTotal])).toEqual([
      ["legs", true],
      ["vessel", true],
      ["solidSurfaceGroup", false],
      ["divider", false],
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
