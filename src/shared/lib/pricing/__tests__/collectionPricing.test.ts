import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";

import makoPresetsDocument from "../../../../../public/collections/mako/presets.json";
import { rootReducer } from "@/app/store/reducer";
import { replaceCollectionData } from "@/entities/product/model/store/slice";

import datatable438 from "@/entities/collection/__tests__/fixtures/remote/datatable-438.json";
import {
  countertopDatatableSchema,
  hasOwnCountertop,
  normalizeOptionValue,
  presetsSchema,
  selectOptions,
} from "@/entities/collection";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import type { ScopedValue, ValueTarget } from "@/entities/configuration";
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop";

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
import type { PricingInput, PricingLine } from "../types";
import {
  at,
  COLLECTION_PRICING_SCENARIOS,
  CLASS,
  collectionPricingInput,
  MAKO,
  URBAN_LOW_HEIGHT,
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

  it.each([
    ["Class", CLASS],
    ["Mako", MAKO],
  ])("%s spells every thickness its countertop offers", (_name, { profile, skuProfile }) => {
    if (!hasOwnCountertop(skuProfile)) throw new Error("the collection spells its own countertop");
    const thicknesses = selectOptions(profile, "Thickness").map(({ value }) => value);

    expect(thicknesses.length).toBeGreaterThan(0);
    expect(thicknesses.filter((value) => !skuProfile.countertop.thicknessCodes[value])).toEqual([]);
  });

  it("spells the thickness chosen for the top and its basin, with the brackets a thick top takes", () => {
    const order = COLLECTION_PRICING_SCENARIOS["class-porcelain-integrated"].input;
    const countertopSkus = (countertopThickness: string) =>
      buildCollectionPricingLines({ ...order, countertopThickness }).lines.flatMap(({ group, sku, quantity }) =>
        group === "countertop" || group === "basin" || group === "bracket" ? [{ sku, quantity }] : [],
      );

    // Table 578 gives an HPL top 1/2" or 4"; the price list spells them .5 and 4.
    expect(countertopSkus("4")).toEqual([
      { sku: "CT-GBHPL-INTG-47.2W-4H-20.7D-HPL-259", quantity: 1 },
      { sku: "CT-GBHPL-VA024-4H", quantity: 1 },
      { sku: "CT-GB-BRKT", quantity: 2 },
    ]);
    expect(countertopSkus("0.5")).toEqual([
      { sku: "CT-GBHPL-INTG-47.2W-.5H-20.7D-HPL-259", quantity: 1 },
      { sku: "CT-GBHPL-VA024-.5H", quantity: 1 },
    ]);
  });

  it.each(["class-porcelain-integrated", "mako-vessel-with-legs"] as const)(
    "uses the committed top length for %s without changing cabinet or basin lines",
    (scenario) => {
      const input = COLLECTION_PRICING_SCENARIOS[scenario].input;
      const fallback = buildCollectionPricingLines(input).lines;
      const resized = buildCollectionPricingLines({ ...input, committedCountertopLengthCm: 137.5 }).lines;
      const top = (lines: PricingLine[]) => lines.find(({ group }) => group === "countertop");
      const geometryLines = (lines: PricingLine[]) =>
        lines
          .filter(({ group }) => group === "cabinet" || group === "basin")
          .map(({ id, sku, quantity }) => ({ id, sku, quantity }));

      expect(top(resized)).toMatchObject({ widthCm: 137.5 });
      expect(top(resized)?.sku).not.toBe(top(fallback)?.sku);
      expect(geometryLines(resized)).toEqual(geometryLines(fallback));
    },
  );

  it("cuts a vessel top once per sink base, adds the organizer and names what the order uses unconfirmed", () => {
    const { lines, gaps } = buildCollectionPricingLines(COLLECTION_PRICING_SCENARIOS["mako-vessel-with-legs"].input);

    expect(lines.find(({ group }) => group === "holeCut")).toMatchObject({ sku: "CT-GBSSTL-HCUT", quantity: 1 });
    expect(lines.find(({ group }) => group === "vessel")).toMatchObject({
      sku: "VES-IRIS-X-XW-XH-XD-LACG-403",
      quantity: 1,
    });
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
    // A collection that declares no frame colour to start from.
    const withoutDefaults = { ...CLASS, profile: { ...CLASS.profile, defaults: {} } };
    const { gaps } = buildCollectionPricingLines(
      collectionPricingInput(
        withoutDefaults,
        [{ stableKey: "a", runtimeId: "Sink-Base-a1", size: { width: 60, height: 52, depth: 52 } }],
        { CabinetColor: [at({ scope: "global" }, "Nero 433 MT")] },
      ),
    );

    expect(gaps).toEqual([expect.objectContaining({ group: "input", blocksTotal: true })]);
  });

  it("prices a Class model before a colour is chosen, from the collection's defaults", () => {
    // What switching to Class leaves in the state: the profile's defaults (replaceCollectionData).
    const store = configureStore({ reducer: rootReducer });
    store.dispatch(replaceCollectionData({ profile: CLASS.profile, cabinetCatalog: null }));
    const { CabinetColor, CountertopColor, CountertopStyle, sinkType } =
      store.getState().rootStateUI.product.productOptions;

    const { lines, gaps } = buildCollectionPricingLines(
      collectionPricingInput(
        CLASS,
        [{ stableKey: "a", runtimeId: "Sink-Base-a1", size: { width: 60, height: 52, depth: 52 } }],
        { Drawers: [at({ scope: "cabinet", cabinetId: "a" }, "2")] },
        { cabinetColor: CabinetColor, countertopColor: CountertopColor, countertopStyle: CountertopStyle, sinkType },
      ),
    );

    // The Class of the site: a Nero Atlante porcelain front in a black frame and sides, on a black glass top.
    expect(lines.map(({ sku }) => sku)).toEqual([
      "VAN-CLSV-SB/2DW-23.6W-20.5H-20.5D-CABF-POR/B-326-CABS-LACM-433-FRM-LACM-433",
      "CT-GBGLSG-INTG-23.6W-.5H-20.7D-GLSG-433",
      "CT-GBGLSG-VA005-.5H",
    ]);
    expect(gaps).toEqual([]);
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

  it("spells the handle colour of the composition on every cabinet, and a cabinet's own where it has one", () => {
    // A model and the Handle Color field record the composition's colour once, at the first cabinet.
    const first: ValueTarget = { scope: "cabinet", cabinetId: "mko-1" };
    const second: ValueTarget = { scope: "cabinet", cabinetId: "mko-2" };
    const cabinetSkus = (handleColors: ScopedValue[]) =>
      buildCollectionPricingLines(
        collectionPricingInput(
          MAKO,
          [
            { stableKey: "mko-1", runtimeId: "Sink-Base-aaa111", size: { width: 60, height: 26, depth: 52 } },
            { stableKey: "mko-2", runtimeId: "Sink-Base-bbb222", size: { width: 60, height: 26, depth: 52 } },
          ],
          {
            Drawers: [at(first, "1"), at(second, "1")],
            Handle: [at(first, "G57"), at(second, "G57")],
            HandleColor: handleColors,
            CabinetColor: [at({ scope: "global" }, "Antracite 400 MT")],
          },
        ),
      ).lines.flatMap(({ group, sku }) => (group === "cabinet" ? [sku] : []));

    expect(cabinetSkus([at(first, "Antracite 400 MT")])).toEqual([
      "VAN-MAKOV-SB/1DW/G57-23.6W-10.2H-20.5D-CAB-LACM-400-HDL-LACM-400",
      "VAN-MAKOV-SB/1DW/G57-23.6W-10.2H-20.5D-CAB-LACM-400-HDL-LACM-400",
    ]);
    expect(cabinetSkus([at(first, "Antracite 400 MT"), at(second, "Silver")])).toEqual([
      "VAN-MAKOV-SB/1DW/G57-23.6W-10.2H-20.5D-CAB-LACM-400-HDL-LACM-400",
      "VAN-MAKOV-SB/1DW/G57-23.6W-10.2H-20.5D-CAB-LACM-400-HDL-MTL-SLV",
    ]);
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

  it("prices the countertop of a Mako model before one is chosen, from the collection's defaults", () => {
    // What switching to Mako leaves in the state: the profile's defaults (replaceCollectionData).
    const store = configureStore({ reducer: rootReducer });
    store.dispatch(replaceCollectionData({ profile: MAKO.profile, cabinetCatalog: null }));
    const { CountertopColor, CountertopStyle, sinkType } = store.getState().rootStateUI.product.productOptions;

    const { lines, gaps } = buildCollectionPricingLines({
      ...makoModelInput(MAKO_MODELS[0]),
      countertopColor: CountertopColor,
      countertopStyle: CountertopStyle,
      sinkType,
    });

    // Nero 433 GL is Glass Gloss (GLSG, .5"), on an integrated top with a VA005 basin over the 60 cm Sink Base.
    expect(lines.filter(({ group }) => group === "countertop" || group === "basin").map(({ sku }) => sku)).toEqual([
      "CT-GBGLSG-INTG-23.6W-.5H-20.7D-GLSG-433",
      "CT-GBGLSG-VA005-.5H",
    ]);
    expect(gaps).toEqual([]);
  });

  it("reads the countertop style Prebuilt records in the scene's spelling through the profile's aliases", () => {
    // Placing a model records the style as the scene takes it ("Integrated", "Vessel").
    const countertop: ValueTarget = { scope: "countertop" };
    const withStyle = (style: string) =>
      buildCollectionPricingLines({
        ...makoModelInput(MAKO_MODELS[0]),
        configurationValues: {
          ...makoModelInput(MAKO_MODELS[0]).configurationValues,
          CountertopStyle: [at(countertop, style)],
          CountertopColor: [at(countertop, "Nero 433 GL")],
        },
        sinkType: style === "Integrated" ? "VA005" : "",
      });

    expect(withStyle("Integrated").lines.find(({ group }) => group === "countertop")?.sku).toBe(
      "CT-GBGLSG-INTG-23.6W-.5H-20.7D-GLSG-433",
    );

    const vessel = withStyle("Vessel");
    expect(vessel.lines.find(({ group }) => group === "countertop")?.sku).toBe(
      "CT-GBGLSG-VES-23.6W-.5H-20.7D-GLSG-433",
    );
    // The vessel sink Mako has no price for keeps the total incomplete.
    expect(vessel.gaps.map(({ group }) => group)).toContain("vessel");
  });

  it("leaves a model without legs without a legs line", () => {
    const { lines } = buildCollectionPricingLines(makoModelInput(MAKO_MODELS[0]));

    expect(lines.some(({ group }) => group === "legs")).toBe(false);
  });

  it("prices the legs a field sets at the first cabinet over the model's on the other cabinets", () => {
    const first: ValueTarget = { scope: "cabinet", cabinetId: "mko-first" };
    const second: ValueTarget = { scope: "cabinet", cabinetId: "mko-second" };
    // A model on legs records them at each cabinet; the Leg Color field records its choice at the first.
    const withLegColor = (legColor: string) =>
      collectionPricingInput(
        MAKO,
        [
          { stableKey: "mko-first", runtimeId: "Sink-Base-eee555", size: { width: 60, height: 52, depth: 52 } },
          { stableKey: "mko-second", runtimeId: "Sink-Cabinet-fff666", size: { width: 40, height: 52, depth: 52 } },
        ],
        {
          Drawers: [at(first, "2"), at(second, "2")],
          Handle: [at(first, "G57"), at(second, "G57")],
          LegColor: [at(first, legColor), at(second, "None")],
          CabinetColor: [at({ scope: "global" }, "Antracite 400 MT")],
        },
      );
    const legsLine = (legColor: string) =>
      buildCollectionPricingLines(withLegColor(legColor)).lines.find(({ group }) => group === "legs");

    // Switching the legs off records no colour: they are removed and not priced.
    expect(legsLine("")).toBeUndefined();
    expect(legsLine("Gold")).toMatchObject({ sku: "VAN-MAKOV-LEG-MTL", quantity: 2 });
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

describe("Urban Low Height countertop, priced as Urban Standard Height's", () => {
  const countertopRules = parseCountertopMatrix(countertopDatatableSchema.parse(datatable438));
  const sinkBase = (stableKey: string, depth = 46) => ({
    stableKey,
    runtimeId: `Sink-Base-${stableKey}`,
    size: { width: 60, height: 38, depth },
  });
  const countertop: ValueTarget = { scope: "countertop" };
  /** A composition of 60 cm sink bases with the default HPL top configurator 4 keeps, `Ardesia TKF`. */
  const ulhOrder = (
    cabinets: ReturnType<typeof sinkBase>[],
    values: Record<string, ScopedValue[]> = {},
    overrides: Partial<PricingInput> = {},
  ) =>
    buildCollectionPricingLines(
      collectionPricingInput(
        URBAN_LOW_HEIGHT,
        cabinets,
        {
          Drawers: cabinets.map(({ stableKey }) => at({ scope: "cabinet", cabinetId: stableKey }, "1")),
          Handle: cabinets.map(({ stableKey }) =>
            at({ scope: "cabinet", cabinetId: stableKey }, "handle_urban_topcut"),
          ),
          CountertopColor: [at(countertop, "Ardesia TKF")],
          CountertopStyle: [at(countertop, "integrated")],
          ...values,
        },
        { countertopRules, cabinetColor: "Castagno chiaro 1C1", ...overrides },
      ),
    );
  const skusOf = (lines: PricingLine[], group: PricingLine["group"]) =>
    lines.filter((line) => line.group === group).map(({ sku, quantity }) => ({ sku, quantity }));

  it("prices the top of the 24\" 1-Drawer 1 model as USH does, at the cabinets' depth, and completes the total", () => {
    const { lines, gaps } = ulhOrder([sinkBase("ulh-sb")]);

    // 60 cm wide, 46 cm deep; table 438 gives HPL at 46 cm its first thickness, 1/2".
    expect(lines.find(({ group }) => group === "countertop")).toMatchObject({
      sku: "CT-URHPL-INTG-23.6W-.5H-18.1D-HPL-TKF",
      quantity: 1,
      widthCm: 60,
    });
    expect(skusOf(lines, "faucetHoles")).toEqual([{ sku: "CT-URHPL-FAHO/0", quantity: 1 }]);
    expect(gaps).toEqual([]);

    const entries = Object.fromEntries(lines.map(({ sku }) => [sku, { status: "ready" as const, value: 100 }]));
    expect(derivePriceStatus({ isUnavailable: false, isLoading: false, lines, entries, gaps })).toBe("ready");
  });

  it("uses the committed runtime length only for the ULH top", () => {
    const fallback = ulhOrder([sinkBase("ulh-sb")]).lines;
    const resized = ulhOrder([sinkBase("ulh-sb")], {}, { committedCountertopLengthCm: 137.5 }).lines;
    const top = (lines: PricingLine[]) => lines.find(({ group }) => group === "countertop");
    const cabinetAndBasinLines = (lines: PricingLine[]) =>
      lines
        .filter(({ group }) => group === "cabinet" || group === "basin")
        .map(({ id, sku, quantity }) => ({ id, sku, quantity }));

    expect(top(fallback)?.widthCm).toBe(60);
    expect(top(resized)).toMatchObject({ widthCm: 137.5 });
    expect(top(resized)?.sku).not.toBe(top(fallback)?.sku);
    expect(cabinetAndBasinLines(resized)).toEqual(cabinetAndBasinLines(fallback));
  });

  it("sizes the top by its sink base when a narrower cabinet stands first, as a side cabinet added on the left", () => {
    const sideCabinet = {
      stableKey: "ulh-sc",
      runtimeId: "Side-Cabinet-ulh-sc",
      size: { width: 25, height: 38, depth: 46 },
    };
    const { lines, gaps } = ulhOrder([sideCabinet, sinkBase("ulh-sb")]);

    // Table 438 takes an integrated HPL top over a sink base of 60 cm or more; the side cabinet is 25 cm.
    expect(lines.find(({ group }) => group === "countertop")).toMatchObject({
      sku: "CT-URHPL-INTG-33.5W-.5H-18.1D-HPL-TKF",
      widthCm: 85,
    });
    expect(gaps).toEqual([]);
  });

  it("spells the groove colour the configuration holds on an Upper Groove cabinet, and the cabinet colour until one is chosen", () => {
    const cabinetSku = (handleGrooveColor: string) =>
      buildCollectionPricingLines(
        collectionPricingInput(
          URBAN_LOW_HEIGHT,
          [sinkBase("ulh-sb")],
          {
            Drawers: [at({ scope: "cabinet", cabinetId: "ulh-sb" }, "1")],
            Handle: [at({ scope: "cabinet", cabinetId: "ulh-sb" }, "handle_urban_topcut")],
          },
          { cabinetColor: "Castagno chiaro 1C1", handleGrooveColor },
        ),
      ).lines.find(({ group }) => group === "cabinet")?.sku;

    expect(cabinetSku("Castagno Malto 1C2")).toBe("VAN-URLH-SB/1DW/UG/X-23.6W-15H-18.1D-CAB-3D-1C1-HDL-3D-1C2");
    expect(cabinetSku("")).toBe("VAN-URLH-SB/1DW/UG/X-23.6W-15H-18.1D-CAB-3D-1C1-HDL-3D-1C1");
  });

  it("hangs the towel bar on each side as Urban Standard Height prices it, and completes the total", () => {
    const withTowelBar = (towelBarOption: string) =>
      ulhOrder(
        [sinkBase("ulh-sb")],
        { TowelBarOption: [at({ scope: "global" }, towelBarOption)] },
        { towelBarOption, towelBarColor: "Carbone 43 MT" },
      );
    const towelBarOf = (towelBarOption: string) => skusOf(withTowelBar(towelBarOption).lines, "towelBar");

    expect(towelBarOf("Both")).toEqual([
      { sku: "VAN-URTWLBR-STB/R-15.7W-1.4H-2D-LACM-43 MT", quantity: 1 },
      { sku: "VAN-URTWLBR-STB/L-15.7W-1.4H-2D-LACM-43 MT", quantity: 1 },
    ]);
    expect(withTowelBar("Both").gaps).toEqual([]);
    expect(towelBarOf("Left")).toEqual([{ sku: "VAN-URTWLBR-STB/L-15.7W-1.4H-2D-LACM-43 MT", quantity: 1 }]);
    expect(towelBarOf("None")).toEqual([]);
  });

  it("stands a side panel on each active side as Urban Standard Height spells it, at the cabinets' height", () => {
    const withSidePanels = (sidePanelsOption: string, overrides: Partial<PricingInput> = {}) =>
      ulhOrder(
        [sinkBase("ulh-sb")],
        { SidePanels: [at({ scope: "global" }, sidePanelsOption)] },
        { sidePanelsOption, sidePanelLeft: "active", sidePanelRight: "active", ...overrides },
      );
    const sidePanelsOf = (order: ReturnType<typeof withSidePanels>) => skusOf(order.lines, "sidePanel");

    // 38 cm high, 46 cm deep; the groove of an upper-groove panel in the cabinet colour until one is chosen.
    const upperGroove = withSidePanels("UpperG");
    expect(sidePanelsOf(upperGroove)).toEqual([
      { sku: "VAN-URSP-1GU-.4W-15H-17.9D-CAB-3D-1C1-HDL-3D-1C1", quantity: 2 },
    ]);
    expect(upperGroove.gaps).toEqual([]);
    expect(
      sidePanelsOf(withSidePanels("UpperG", { handleGrooveColor: "Castagno Malto 1C2", sidePanelRight: "none" })),
    ).toEqual([{ sku: "VAN-URSP-1GU-.4W-15H-17.9D-CAB-3D-1C1-HDL-3D-1C2", quantity: 1 }]);
    expect(sidePanelsOf(withSidePanels("NoG"))).toEqual([{ sku: "VAN-URSP-0G-.4W-15H-17.9D-CAB-3D-1C1", quantity: 2 }]);
  });

  it("orders the integrated basin of each sink base as USH spells it", () => {
    const { lines } = ulhOrder([sinkBase("ulh-sb-1"), sinkBase("ulh-sb-2")], {
      sinkType: [at({ scope: "basin" }, "Top_HPLPrisma")],
    });

    expect(lines.find(({ group }) => group === "countertop")?.sku).toBe("CT-URHPL-INTG-47.2W-.5H-18.1D-HPL-TKF");
    expect(skusOf(lines, "basin")).toEqual([
      { sku: "CT-URHPL-PRISMA-.5H-HPL-TKF", quantity: 1 },
      { sku: "CT-URHPL-PRISMA-.5H-HPL-TKF", quantity: 1 },
    ]);
  });

  it("prices the top and the basin of a model before a countertop is chosen, from the collection's defaults", () => {
    // What switching to Urban Low Height leaves in the state: the profile's defaults (replaceCollectionData).
    const store = configureStore({ reducer: rootReducer });
    store.dispatch(replaceCollectionData({ profile: URBAN_LOW_HEIGHT.profile, cabinetCatalog: null }));
    const { CountertopColor, CountertopStyle, sinkType } = store.getState().rootStateUI.product.productOptions;

    const { lines, gaps } = ulhOrder(
      [sinkBase("ulh-sb")],
      { CountertopColor: [], CountertopStyle: [] },
      { countertopColor: CountertopColor, countertopStyle: CountertopStyle, sinkType },
    );

    // Pietra Di Savoia Antracite TQ6 is Porcelain; table 438 gives Porcelain 46 cm deep 1/2" first.
    expect(lines.filter(({ group }) => group === "countertop" || group === "basin").map(({ sku }) => sku)).toEqual([
      "CT-URPOR-INTG-23.6W-.5H-18.1D-POR-TQ6",
      "CT-URPOR-COVER-.5H-POR-TQ6",
    ]);
    expect(gaps).toEqual([]);
  });

  it("cuts a vessel top once per sink base and keeps the vessel sink unpriced", () => {
    const { lines, gaps } = ulhOrder([sinkBase("ulh-sb-1"), sinkBase("ulh-sb-2")], {
      CountertopStyle: [at(countertop, "vessel")],
    });

    expect(lines.find(({ group }) => group === "countertop")?.sku).toBe("CT-URHPL-VES-47.2W-.5H-18.1D-HPL-TKF");
    expect(skusOf(lines, "holeCut")).toEqual([{ sku: "CT-URHPL-HCUT", quantity: 2 }]);
    expect(gaps.map(({ group }) => group)).toEqual(["vessel"]);
  });

  it("says so when the countertop table gives the material no thickness at the cabinets' depth", () => {
    const { lines, gaps } = ulhOrder([sinkBase("ulh-sb", 40)]);

    expect(lines.some(({ group }) => group === "countertop")).toBe(false);
    expect(gaps).toEqual([expect.objectContaining({ group: "countertop", blocksTotal: true })]);
  });
});

describe("Class and Mako reference orders", () => {
  it.each(Object.keys(EXPECTED) as CollectionPricingScenarioId[])(
    "the server charges the workbook price of every SKU of %s",
    (scenario) => {
      const recorded = Object.fromEntries(
        Object.entries(RECORDED[scenario].answers).flatMap(([sku, answer]) => {
          const price = resolvePriceFromResponse(answer);
          return typeof price === "number" ? [[sku, price]] : [];
        }),
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
