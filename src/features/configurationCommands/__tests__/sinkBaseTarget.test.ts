import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { classRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/classRuntimeBindingsFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { ulhRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import datatable438 from "@/entities/collection/__tests__/fixtures/remote/datatable-438.json";
import { countertopDatatableSchema } from "@/entities/collection/model/schemas";
import type { RuntimeBindingSet } from "@/entities/collection/model/runtimeBindings";
import { parseCountertopMatrix, type CountertopMatrixRule } from "@/features/configurator-rule-core/countertop";
import {
  getAttributeValue,
  getCabinetEntries,
  getValuesByAttributeId,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setAttributeValue,
  syncCabinets,
} from "@/entities/configuration";
import {
  addProductPreset,
  replaceCollectionData,
  reset,
  resetProducts,
  setActiveCabinetType,
  setActiveProfile,
} from "@/entities/product/model/store/slice";
import {
  createTestCompositionPort,
  createTestRuntimePort,
  createTestSidePanelPort,
} from "@/features/playCanvasAdapter";
import { buildAddedCabinetRequest } from "@/features/sidebar/lib/buildAddedCabinetRequest";
import { buildCollectionPricingLines } from "@/shared/lib/pricing/buildCollectionPricingLines";
import {
  CLASS,
  collectionPricingInput,
  MAKO,
  URBAN_LOW_HEIGHT,
} from "@/shared/lib/pricing/__tests__/fixtures/collectionPricingScenarios";

import { changeAttribute } from "../lib/changeAttribute";
import { createCommandRunner } from "../lib/createCommandRunner";
import { evaluateChange } from "../lib/evaluateChange";
import { resolveChangeRequest } from "../lib/resolveChangeRequest";

/**
 * The scene names a product after its scene type (`Mako-sink-cabinet-k3j4h5g6f`), so a Mako
 * Sink Base is found through the runtime bindings, not by a "sink-base" in its id.
 */

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(makoProfile));
  store.dispatch(setActiveCollectionId("mako"));
  store.dispatch(setActiveRuntimeBindings(makoRuntimeBindings));
  // The builder's last pick is a Side Cabinet, so only the placed products can name the Sink Base.
  store.dispatch(setActiveCabinetType("Sink-Cabinet"));
  store.dispatch(syncCabinets(["Mako-side-cabinet-a1b2c3d4e", "Mako-sink-cabinet-k3j4h5g6f"]));
});

describe("a Mako basin value", () => {
  it("is planned for the placed Sink Base, not the Side Cabinet", () => {
    const request = resolveChangeRequest(store.getState(), "sinkType", "LB440");
    if (!request) throw new Error("a placed Sink Base names the basin");

    // The composition's basin too, which a Sink Base without a basin of its own reads.
    expect(evaluateChange(request, store.getState())).toMatchObject({
      kind: "planned",
      plan: [
        { attributeId: "sinkType", target: { scope: "basin" }, value: "LB440" },
        { attributeId: "sinkType", target: { scope: "basin", sinkBaseId: "cab-2" }, value: "LB440" },
      ],
    });
  });

  it("is planned for that Sink Base", () => {
    const evaluation = evaluateChange(
      { attributeId: "sinkType", value: "LB440", scope: "basin", sinkBaseId: "cab-2" },
      store.getState(),
    );

    expect(evaluation).toMatchObject({ kind: "planned" });
  });
});

describe("a basin picked for a Mako composition of two Sink Bases", () => {
  beforeEach(() => {
    store.dispatch(syncCabinets(["Mako-sink-cabinet-k3j4h5g6f", "Mako-sink-cabinet-m7n8p9q0r"]));
    // Placing a model records the basin of the whole composition: here the Mako default.
    store.dispatch(setAttributeValue({ attributeId: "sinkType", target: { scope: "basin" }, value: "VA005" }));
  });

  it("goes on every Sink Base, so none keeps the basin it had", async () => {
    const request = resolveChangeRequest(store.getState(), "sinkType", "VA024");
    if (!request) throw new Error("a placed Sink Base names the basin");

    const result = await changeAttribute(request, {
      getState: () => store.getState(),
      dispatch: (action) => store.dispatch(action),
      runtime: createTestRuntimePort().port,
      flow: "custom",
    });

    // The price reads the basin of each Sink Base before the composition's.
    const state = store.getState();
    expect(result.status).toBe("applied");
    expect(
      getCabinetEntries(state).map(({ stableKey }) =>
        getAttributeValue(state, "sinkType", { scope: "basin", sinkBaseId: stableKey }),
      ),
    ).toEqual(["VA024", "VA024"]);
  });
});

type Collection = typeof CLASS | typeof MAKO | typeof URBAN_LOW_HEIGHT;

/** A collection's command runner over test scene ports, with the order its state prices. */
const basinHarness = (
  collectionId: string,
  collection: Collection,
  bindings: RuntimeBindingSet,
  { color, depth, countertopRules = [] }: { color: string; depth: number; countertopRules?: CountertopMatrixRule[] },
) => {
  const sinkBase = { name: "Sink-Base", Width: 80, Height: 52, Depth: depth, Drawers: "2D" };
  const product = () => store.getState().rootStateUI.product;

  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(replaceCollectionData({ profile: collection.profile, cabinetCatalog: null }));
  store.dispatch(setActiveCollectionId(collectionId));
  store.dispatch(setActiveRuntimeBindings(bindings));
  const composition = createTestCompositionPort();
  const runner = createCommandRunner({
    getState: () => store.getState(),
    dispatch: (action) => store.dispatch(action),
    getFlow: () => "custom",
    runtime: createTestRuntimePort().port,
    composition: composition.port,
    sidePanels: createTestSidePanelPort().port,
    configurator: collection.configurator ?? null,
  });

  const pick = async (attributeId: string, value: string) => {
    const request = resolveChangeRequest(store.getState(), attributeId, value);
    if (!request) throw new Error(`${attributeId} has nothing to address`);
    expect((await runner.change(request)).status).toBe("applied");
  };

  const order = () => {
    const state = store.getState();
    const options = product().productOptions;
    return buildCollectionPricingLines(
      collectionPricingInput(
        collection,
        getCabinetEntries(state).map(({ stableKey, runtimeId }) => ({
          stableKey,
          runtimeId,
          size: { width: 80, height: 52, depth },
        })),
        { ...getValuesByAttributeId(state) },
        {
          runtimeBindings: bindings,
          countertopRules,
          sinkType: options.sinkType,
          countertopStyle: options.CountertopStyle,
          countertopColor: options.CountertopColor,
          vesselColor: options.VesselColor,
        },
      ),
    );
  };
  const skusOf = (group: string) =>
    order()
      .lines.filter((line) => line.group === group)
      .map(({ sku }) => sku);

  return {
    composition,
    product,
    pick,
    /** A model as the model page places it: its products, then its countertop recorded for the composition. */
    placeModel: async (sinkType: string, countertopStyle = "Integrated") => {
      await runner.composition.applyPreset({
        products: [{ productType: sinkBase.name, config: { ...sinkBase, sinkType } }],
      });
      store.dispatch(addProductPreset([{ ...sinkBase, sinkType }] as never));
      runner.record({ CountertopColor: color, sinkType, CountertopStyle: countertopStyle });
    },
    /** Custom opened on the products Prebuilt placed (CabinetBuilderPage): the same products, new keys. */
    openCustom: async () => {
      store.dispatch(resetProducts());
      await runner.composition.adopt({
        runtimeIds: composition.order(),
        products: product().productsPresets.map((preset) => ({ productType: preset.name, config: { ...preset } })),
        record: { CountertopColor: color },
      });
    },
    /** The sidebar's plus button beside a placed Sink Base. */
    addSinkBaseBeside: async (anchorRuntimeId: string) => {
      const options = product().productOptions;
      const added = await runner.composition.addCabinet(
        buildAddedCabinetRequest({
          cabinetType: "Sink-Base",
          config: { Width: 80, Height: 52, Depth: depth, Drawers: "2D" },
          width: 80,
          sinkType: options.sinkType,
          countertopStyle: options.CountertopStyle,
          vesselColor: options.VesselColor,
          anchorRuntimeId,
          side: "right",
        }),
      );
      if (added.status === "error") throw new Error(added.message);
    },
    removeCabinets: (runtimeIds: string[]) => runner.composition.removeCabinets(runtimeIds),
    skusOf,
    gapGroups: () => order().gaps.map(({ group }) => group),
  };
};

/**
 * A basin a field picks is the composition's as well as each placed Sink Base's: Prebuilt opening
 * Custom gives the same Sink Base a new key, and a Sink Base added with + or a later model records
 * none of its own, so they read the composition's.
 */
describe.each([
  ["Class", "class", CLASS, classRuntimeBindings],
  ["Mako", "mako", MAKO, makoRuntimeBindings],
] as const)("the basin a %s field picks", (_label, collectionId, collection, bindings) => {
  let harness: ReturnType<typeof basinHarness>;

  beforeEach(() => {
    harness = basinHarness(collectionId, collection, bindings, { color: "Nero 433 GL", depth: 52 });
  });

  it("stays the composition's, which a Sink Base without a basin of its own reads", async () => {
    await harness.placeModel("VA005");
    await harness.pick("sinkType", "VA002");

    expect(getAttributeValue(store.getState(), "sinkType", { scope: "basin" })).toBe("VA002");
  });

  it("is priced after Prebuilt opens Custom, which gives the same Sink Base a new key", async () => {
    await harness.placeModel("VA005");
    await harness.pick("sinkType", "VA002");
    await harness.openCustom();

    expect(harness.product().productOptions.sinkType).toBe("VA002");
    expect(harness.skusOf("basin")).toEqual(["CT-GBGLSG-VA002-.5H"]);
  });

  it("keeps the vessel the order has not priced after Prebuilt opens Custom", async () => {
    await harness.placeModel("VA005");
    await harness.pick("CountertopStyle", "vessel");
    await harness.pick("sinkType", "Iris");
    await harness.openCustom();

    expect(harness.gapGroups()).toContain("vessel");
  });

  it("reaches a Sink Base added beside the first, which keeps it when the first is removed", async () => {
    await harness.placeModel("VA005");
    await harness.openCustom();
    await harness.pick("CountertopStyle", "vessel");
    await harness.pick("sinkType", "Iris");
    const [first] = harness.composition.order();
    await harness.addSinkBaseBeside(first);
    await harness.removeCabinets([first]);

    expect(harness.gapGroups()).toContain("vessel");
  });

  it("replaces the vessel a model was placed with for a Sink Base added later", async () => {
    await harness.placeModel("VA005");
    await harness.pick("CountertopStyle", "vessel");
    await harness.pick("sinkType", "Iris");
    // Another model, placed with the vessel kept: its countertop is recorded for the composition.
    await harness.placeModel("Iris", "Vessel");
    await harness.pick("CountertopStyle", "integrated");
    await harness.pick("sinkType", "VA002");
    await harness.addSinkBaseBeside(harness.composition.order()[0]);

    expect(harness.skusOf("basin")).toEqual(["CT-GBGLSG-VA002-.5H", "CT-GBGLSG-VA002-.5H"]);
    expect(harness.gapGroups()).not.toContain("vessel");
  });
});

// Urban Low Height prices its countertop as Urban Standard Height's, table 438 giving the thickness.
describe("the basin an Urban Low Height field picks", () => {
  let harness: ReturnType<typeof basinHarness>;

  beforeEach(() => {
    harness = basinHarness("urban-low-height", URBAN_LOW_HEIGHT, ulhRuntimeBindings, {
      color: "Ardesia TKF",
      depth: 46,
      countertopRules: parseCountertopMatrix(countertopDatatableSchema.parse(datatable438)),
    });
  });

  it("is priced after Prebuilt opens Custom", async () => {
    await harness.placeModel("Top_HPLPrisma");
    await harness.pick("sinkType", "Top_HPLQuadra");
    await harness.openCustom();

    expect(harness.skusOf("basin")).toEqual(["CT-URHPL-QUAD-.5H-HPL-TKF"]);
  });

  it("orders the vessel, and no basin, after Prebuilt opens Custom", async () => {
    await harness.placeModel("Top_HPLPrisma");
    await harness.pick("CountertopStyle", "vessel");
    await harness.pick("sinkType", "Vessel_Blade11");
    await harness.pick("VesselColor", "Antracite Matte OCF");
    await harness.openCustom();

    expect(harness.skusOf("basin")).toEqual([]);
    expect(harness.skusOf("vessel")).toEqual(["VES-BLD11-X-19.7W-6.1H-15D-CER-OCF"]);
  });
});
