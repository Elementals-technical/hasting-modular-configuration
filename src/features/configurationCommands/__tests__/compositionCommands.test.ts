import { beforeEach, describe, expect, it } from "vitest";

import urbanDuplexProfileDocument from "../../../../public/collections/urban-duplex/product-profile.json";
import urbanDuplexBindingsDocument from "../../../../public/collections/urban-duplex/runtime-bindings.json";
import { store } from "@/app/store";
import { parseProductProfile, parseRuntimeBindings } from "@/entities/collection";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import {
  getAttributeValue,
  getCabinetEntries,
  getRuntimeSyncState,
  getValuesByAttributeId,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setAttributeValue,
} from "@/entities/configuration";
import {
  getCabinetColor,
  getDrawerPanelFluting,
  getHandleGrooveColor,
  getVesselColor,
} from "@/entities/product/model/store/selectors";
import { recordComposition, reset, setActiveProfile } from "@/entities/product/model/store/slice";
import {
  createTestCompositionPort,
  createTestRuntimePort,
  createTestSidePanelPort,
  type TestCompositionPort,
} from "@/features/playCanvasAdapter";
import { buildCollectionPricingLines } from "@/shared/lib/pricing";
import { collectionPricingInput, MAKO } from "@/shared/lib/pricing/__tests__/fixtures/collectionPricingScenarios";

import { changeAttribute } from "../lib/changeAttribute";
import { selectOwnCabinetValues } from "../lib/compositionValues";
import {
  addCabinet,
  adoptComposition,
  applyPreset,
  clearComposition,
  removeCabinets,
  swapCabinets,
  type CompositionDeps,
} from "../lib/composition";

const product = () => store.getState().rootStateUI.product;

const setup = (placed: string[] = []) => {
  const composition = createTestCompositionPort(placed);
  const runtime = createTestRuntimePort();
  const sidePanels = createTestSidePanelPort();
  const deps: CompositionDeps = {
    getState: () => store.getState(),
    dispatch: (action) => store.dispatch(action),
    runtime: runtime.port,
    composition: composition.port,
    sidePanels: sidePanels.port,
    flow: "custom",
  };

  if (placed.length > 0) store.dispatch(recordComposition({ productIds: placed }));

  return { composition, runtime, sidePanels, deps };
};

const lastCall = (composition: TestCompositionPort) => composition.calls[composition.calls.length - 1];

describe("composition commands", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(setActiveCollectionId("urban-standard-height"));
    store.dispatch(setActiveRuntimeBindings(ushRuntimeBindings));
  });

  describe("applyPreset", () => {
    it("places the preset once and records its products, their drawer styles and stable keys", async () => {
      const { composition, runtime, deps } = setup();

      const result = await applyPreset(
        {
          products: [
            { productType: "Sink-Base", config: { Width: 60, Drawers: "2D" } },
            { productType: "Sink-Cabinet", config: { Width: 40, Drawers: "1DWID" } },
          ],
          shared: { CountertopStyle: "Vessel", CabinetColor: "Ardesia DD GL" },
          afterPlacement: { Thickness: "2.4" },
        },
        deps,
      );

      expect(result).toMatchObject({ status: "applied", productIds: ["Sink-Base-new-1", "Sink-Cabinet-new-2"] });
      expect(composition.calls).toHaveLength(1);
      // A value map is keyed by the canonical option; the port translates it for the scene.
      expect(lastCall(composition)).toMatchObject({
        op: "replace",
        request: { shared: { CountertopStyle: "vessel", CabinetColor: "Ardesia DD GL" }, flow: "custom" },
      });
      expect(product().productIds).toEqual(["Sink-Base-new-1", "Sink-Cabinet-new-2"]);
      expect(product().placedCabinetStyles).toEqual({ "Sink-Base-new-1": "2", "Sink-Cabinet-new-2": "1+inner" });
      expect(getCabinetEntries(store.getState()).map(({ runtimeId }) => runtimeId)).toEqual([
        "Sink-Base-new-1",
        "Sink-Cabinet-new-2",
      ]);
      expect(runtime.calls).toHaveLength(1);
      expect(runtime.calls[0].map(({ attributeId, value }) => [attributeId, value])).toEqual([["Thickness", "2.4"]]);
    });

    it("records nothing when the scene is not ready", async () => {
      const { composition, runtime, deps } = setup(["old-a"]);
      composition.setReady(false);

      const result = await applyPreset({ products: [{ productType: "Sink-Base", config: {} }] }, deps);

      expect(result).toMatchObject({ status: "error", code: "runtime-not-ready" });
      expect(product().productIds).toEqual(["old-a"]);
      expect(runtime.calls).toHaveLength(0);
    });

    it("records nothing when the runtime refuses the preset", async () => {
      const { composition, deps } = setup(["old-a"]);
      composition.answerNext({
        status: "rejected",
        issues: [{ code: "unknown-product-type", message: 'The collection has no scene type for "Tower".' }],
      });

      const result = await applyPreset({ products: [{ productType: "Tower", config: {} }] }, deps);

      expect(result).toMatchObject({ status: "error", code: "composition-rejected" });
      expect(product().productIds).toEqual(["old-a"]);
    });

    it("records what a partly placed preset left and holds Save", async () => {
      const { composition, deps } = setup(["old-a"]);
      composition.answerNext({
        status: "partial",
        placed: ["Sink-Base-9"],
        message: "The scene placed 1 of 2 products.",
        scene: { status: "ready", order: ["Sink-Base-9"], cabinets: [] },
      });

      const result = await applyPreset(
        {
          products: [
            { productType: "Sink-Base", config: {} },
            { productType: "Sink-Cabinet", config: {} },
          ],
        },
        deps,
      );

      expect(result.status).toBe("partial");
      expect(product().productIds).toEqual(["Sink-Base-9"]);
      expect(getRuntimeSyncState(store.getState()).needsSync).toBe(true);
    });
  });

  it("records the values the preset brings along, without sending them again", async () => {
    const { runtime, deps } = setup();

    await applyPreset(
      {
        products: [{ productType: "Sink-Base", config: { Drawers: "1D" } }],
        record: { CabinetColor: "Ardesia DD GL" },
      },
      deps,
    );

    expect(getCabinetColor(store.getState())).toBe("Ardesia DD GL");
    expect(runtime.calls).toHaveLength(0);
  });

  it("records a composition the scene already holds, without a scene call", async () => {
    const { composition, runtime, deps } = setup();

    const result = await adoptComposition(
      {
        runtimeIds: ["restored-a", "restored-b"],
        products: [
          { productType: "Sink-Base", config: { Drawers: "2D" } },
          { productType: "Open-Shelf", config: {} },
        ],
        record: { VesselColor: "Bianco" },
      },
      deps,
    );

    expect(result).toMatchObject({ status: "applied", productIds: ["restored-a", "restored-b"] });
    expect(product().productIds).toEqual(["restored-a", "restored-b"]);
    expect(product().placedCabinetStyles).toEqual({ "restored-a": "2" });
    expect(getVesselColor(store.getState())).toBe("Bianco");
    expect(composition.calls).toHaveLength(0);
    expect(runtime.calls).toHaveLength(0);
  });

  describe("addCabinet", () => {
    it("places a cabinet beside another and records it at that position with its drawer style", async () => {
      const { composition, runtime, deps } = setup(["cab-a", "cab-b"]);

      const result = await addCabinet(
        {
          product: { productType: "Sink-Base", config: { Drawers: "1D" } },
          placement: { kind: "beside", anchorRuntimeId: "cab-b", side: "left" },
          afterPlacement: { VesselColor: "Bianco" },
        },
        deps,
      );

      expect(result).toMatchObject({ status: "applied", placed: ["Sink-Base-new-1"] });
      expect(composition.order()).toEqual(["cab-a", "Sink-Base-new-1", "cab-b"]);
      expect(product().productIds).toEqual(["cab-a", "Sink-Base-new-1", "cab-b"]);
      expect(product().placedCabinetStyles["Sink-Base-new-1"]).toBe("1");
      expect(runtime.calls[0].map(({ attributeId }) => attributeId)).toEqual(["VesselColor"]);
    });

    it("places a cabinet after the last one", async () => {
      const { deps } = setup(["cab-a"]);

      await addCabinet({ product: { productType: "Side-Shelf", config: {} }, placement: { kind: "end" } }, deps);

      expect(product().productIds).toEqual(["cab-a", "Side-Shelf-new-1"]);
    });
  });

  describe("a Mako cabinet", () => {
    beforeEach(() => {
      store.dispatch(setActiveProfile(makoProfile));
      store.dispatch(setActiveCollectionId("mako"));
      store.dispatch(setActiveRuntimeBindings(makoRuntimeBindings));
    });

    it("reaches the port with its drawer style as the option the Mako bindings map", async () => {
      const { composition, deps } = setup();

      await addCabinet(
        { product: { productType: "Sink-Base", config: { Width: 60, Drawers: "2D" } }, placement: { kind: "end" } },
        deps,
      );

      expect(lastCall(composition)).toMatchObject({
        op: "add",
        product: { productType: "Sink-Base", config: { Width: 60, Drawers: "2" } },
      });
      expect(product().placedCabinetStyles).toEqual({ "Sink-Base-new-1": "2" });
    });

    it("places a preset the same way", async () => {
      const { composition, deps } = setup();

      await applyPreset(
        {
          products: [
            { productType: "Sink-Cabinet", config: { Width: 40, Drawers: "1D" } },
            { productType: "Sink-Base", config: { Width: 60, Drawers: "1D" } },
          ],
        },
        deps,
      );

      const call = lastCall(composition);
      expect(call.op === "replace" && call.request.products.map(({ config }) => config.Drawers)).toEqual(["1", "1"]);
      expect(Object.values(product().placedCabinetStyles)).toEqual(["1", "1"]);
    });
  });

  describe("values the products carry", () => {
    const cabinetValue = (attributeId: string, cabinetId: string) =>
      getAttributeValue(store.getState(), attributeId, { scope: "cabinet", cabinetId });

    const makoModel = [
      {
        productType: "Sink-Cabinet",
        config: { Width: 40, Drawers: "2D", Handle: "G57", HandleColor: "Silver", LegColor: "Antracite 400 MT" },
      },
      {
        productType: "Sink-Base",
        config: { Width: 60, Drawers: "2D", Handle: "G57", HandleColor: "Silver", LegColor: "Antracite 400 MT" },
      },
      {
        productType: "Sink-Cabinet",
        config: { Width: 40, Drawers: "2D", Handle: "G57", HandleColor: "Silver", LegColor: "Antracite 400 MT" },
      },
    ];

    describe("a Mako model", () => {
      beforeEach(() => {
        store.dispatch(setActiveProfile(makoProfile));
        store.dispatch(setActiveCollectionId("mako"));
        store.dispatch(setActiveRuntimeBindings(makoRuntimeBindings));
      });

      it("records each cabinet's handle and leg colour at that cabinet, and the handle once for the model", async () => {
        const { composition, runtime, deps } = setup();

        await applyPreset({ products: makoModel }, deps);

        const cabinets = getCabinetEntries(store.getState());
        expect(cabinets).toHaveLength(3);
        cabinets.forEach(({ stableKey }) => {
          expect(cabinetValue("HandleColor", stableKey)).toBe("Silver");
          expect(cabinetValue("LegColor", stableKey)).toBe("Antracite 400 MT");
        });
        // The handle is one for the composition, as the scene and the handle command hold it.
        expect(product().selectedProductConfig?.Handle).toBe("G57");
        expect(composition.calls).toHaveLength(1);
        expect(runtime.calls).toHaveLength(0);
      });

      it("prices every cabinet of the model with its handle and handle finish", async () => {
        const { deps } = setup();

        await applyPreset({ products: makoModel }, deps);

        const state = store.getState();
        const widths = makoModel.map(({ config }) => config.Width);
        const input = collectionPricingInput(
          MAKO,
          getCabinetEntries(state).map(({ stableKey, runtimeId }, index) => ({
            stableKey,
            runtimeId,
            size: { width: widths[index], height: 52, depth: 52 },
          })),
          { ...getValuesByAttributeId(state) },
          {
            runtimeBindings: makoRuntimeBindings,
            selectedProductConfig: product().selectedProductConfig,
            placedCabinetStyles: product().placedCabinetStyles,
          },
        );

        const cabinetSkus = buildCollectionPricingLines(input)
          .lines.filter(({ group }) => group === "cabinet")
          .map(({ sku }) => sku);

        expect(cabinetSkus).toEqual([
          "VAN-MAKOV-SC/2DW/G57-15.7W-20.5H-20.5D-HDL-MTL-SLV",
          "VAN-MAKOV-SB/2DW/G57-23.6W-20.5H-20.5D-HDL-MTL-SLV",
          "VAN-MAKOV-SC/2DW/G57-15.7W-20.5H-20.5D-HDL-MTL-SLV",
        ]);
      });

      it("records no handle for a model whose cabinets carry different ones", async () => {
        const { deps } = setup();

        await applyPreset(
          {
            products: [
              { productType: "Sink-Base", config: { Handle: "G57" } },
              { productType: "Sink-Cabinet", config: { Handle: "G50" } },
            ],
          },
          deps,
        );

        expect(product().selectedProductConfig?.Handle).toBeUndefined();
      });

      it("keeps a value the caller records over the one the products carry", async () => {
        const { deps } = setup();

        await applyPreset({ products: makoModel, record: { Handle: "G50" } }, deps);

        expect(product().selectedProductConfig?.Handle).toBe("G50");
      });

      it("records no cabinet's own values when the scene placed only part of the model", async () => {
        const { composition, deps } = setup();
        composition.answerNext({
          status: "partial",
          placed: ["Sink-Cabinet-9"],
          message: "The scene placed 1 of 3 products.",
          scene: { status: "ready", order: ["Sink-Cabinet-9"], cabinets: [] },
        });

        await applyPreset({ products: makoModel }, deps);

        expect(getValuesByAttributeId(store.getState()).HandleColor).toBeUndefined();
        expect(product().placedCabinetStyles).toEqual({});
      });

      it("records the cabinets' own values of a composition the scene already holds", async () => {
        const { deps } = setup();

        await adoptComposition({ runtimeIds: ["kept-a", "kept-b", "kept-c"], products: makoModel }, deps);

        getCabinetEntries(store.getState()).forEach(({ stableKey }) => {
          expect(cabinetValue("HandleColor", stableKey)).toBe("Silver");
        });
        // Adopting keeps the composition's values to the caller: a restore adopts saved scene configs.
        expect(product().selectedProductConfig?.Handle).toBeUndefined();
      });
    });

    /**
     * The Mako scene paints the handles and legs of every cabinet at once. The state holds such a
     * value at every cabinet too, so the order names the colour the scene shows for each of them.
     */
    describe("a value the scene gives every cabinet", () => {
      beforeEach(() => {
        store.dispatch(setActiveProfile(makoProfile));
        store.dispatch(setActiveCollectionId("mako"));
        store.dispatch(setActiveRuntimeBindings(makoRuntimeBindings));
      });

      const heldBy = (attributeId: string) =>
        getCabinetEntries(store.getState()).map(({ stableKey }) => cabinetValue(attributeId, stableKey));

      /** Cabinet SKUs without their size, which these tests do not vary. */
      const handleBlocks = () => {
        const state = store.getState();
        const input = collectionPricingInput(
          MAKO,
          getCabinetEntries(state).map(({ stableKey, runtimeId }) => ({
            stableKey,
            runtimeId,
            size: { width: 60, height: 52, depth: 52 },
          })),
          { ...getValuesByAttributeId(state) },
          {
            runtimeBindings: makoRuntimeBindings,
            selectedProductConfig: product().selectedProductConfig,
            placedCabinetStyles: product().placedCabinetStyles,
          },
        );

        return buildCollectionPricingLines(input)
          .lines.filter(({ group }) => group === "cabinet")
          .map(({ sku }) => sku.replace(/^.*?-(HDL-.*)$/, "$1"));
      };

      const chooseHandleColor = async (
        { runtime, deps }: ReturnType<typeof setup>,
        value: string,
        cabinet = getCabinetEntries(store.getState())[0],
      ) =>
        changeAttribute(
          { attributeId: "HandleColor", value, scope: "cabinet", cabinetId: cabinet.stableKey },
          { getState: deps.getState, dispatch: deps.dispatch, runtime: runtime.port, flow: "custom" },
        );

      it("is recorded at every cabinet when a field changes it, and sent to the scene once", async () => {
        const fixture = setup();
        await applyPreset({ products: makoModel }, fixture.deps);

        const result = await chooseHandleColor(fixture, "Gold");

        expect(result.status).toBe("applied");
        expect(fixture.runtime.calls).toHaveLength(1);
        expect(fixture.runtime.calls[0].map(({ attributeId, value }) => [attributeId, value])).toEqual([
          ["HandleColor", "Gold"],
        ]);
        // Before, only the first cabinet took the new colour and the others kept the model's.
        expect(heldBy("HandleColor")).toEqual(["Gold", "Gold", "Gold"]);
        expect(handleBlocks()).toEqual(["HDL-MTL", "HDL-MTL", "HDL-MTL"]);
      });

      it("is recorded at every cabinet whichever cabinet the change names", async () => {
        const fixture = setup();
        await applyPreset({ products: makoModel }, fixture.deps);

        await chooseHandleColor(fixture, "Gold", getCabinetEntries(store.getState())[2]);

        expect(heldBy("HandleColor")).toEqual(["Gold", "Gold", "Gold"]);
      });

      it("stays with the composition when its first cabinet is removed", async () => {
        const fixture = setup();
        await applyPreset({ products: makoModel }, fixture.deps);
        await chooseHandleColor(fixture, "Gold");

        await removeCabinets([product().productIds[0]], fixture.deps);

        expect(heldBy("HandleColor")).toEqual(["Gold", "Gold"]);
        expect(handleBlocks()).toEqual(["HDL-MTL", "HDL-MTL"]);
      });

      it("goes to a cabinet added later, in the scene and in the state", async () => {
        const fixture = setup();
        await applyPreset({ products: makoModel }, fixture.deps);
        await chooseHandleColor(fixture, "Gold");

        await addCabinet(
          {
            product: { productType: "Sink-Cabinet", config: { Width: 40, Drawers: "2D" } },
            placement: { kind: "end" },
          },
          fixture.deps,
        );

        // The model stands on legs in their own colour, and so does the cabinet that joins it.
        expect(lastCall(fixture.composition)).toMatchObject({
          op: "add",
          product: { config: { Width: 40, Drawers: "2", HandleColor: "Gold", LegColor: "Antracite 400 MT" } },
        });
        expect(heldBy("HandleColor")).toEqual(["Gold", "Gold", "Gold", "Gold"]);
        expect(heldBy("LegColor")).toEqual([
          "Antracite 400 MT",
          "Antracite 400 MT",
          "Antracite 400 MT",
          "Antracite 400 MT",
        ]);
        expect(handleBlocks()).toEqual(["HDL-MTL", "HDL-MTL", "HDL-MTL", "HDL-MTL"]);
      });

      it("starts the first cabinet of an empty composition at the collection's handle colour", async () => {
        const { composition, deps } = setup();

        await addCabinet(
          { product: { productType: "Sink-Base", config: { Width: 60, Drawers: "2D" } }, placement: { kind: "end" } },
          deps,
        );

        const call = lastCall(composition);
        expect(call.op === "add" && call.product.config).toEqual({
          Width: 60,
          Drawers: "2",
          HandleColor: "Antracite 400 MT",
        });
        expect(heldBy("HandleColor")).toEqual(["Antracite 400 MT"]);
        // Legs have no starting value: a cabinet stands on them only once they are chosen.
        expect(heldBy("LegColor")).toEqual([undefined]);
        expect(handleBlocks()).toEqual(["HDL-LACM-400"]);
      });

      it("keeps the value a copied cabinet carries, and records the composition's", async () => {
        const fixture = setup();
        await applyPreset({ products: makoModel }, fixture.deps);
        await chooseHandleColor(fixture, "Gold");

        // A duplicate is placed with the scene config of its source, which names the scene material.
        await addCabinet(
          {
            product: { productType: "Sink-Cabinet", config: { Drawers: "2D", HandleColor: "Gold", LegColor: "" } },
            placement: { kind: "end" },
          },
          fixture.deps,
        );

        const call = lastCall(fixture.composition);
        expect(call.op === "add" && call.product.config).toMatchObject({
          HandleColor: "Gold",
          LegColor: "Antracite 400 MT",
        });
        expect(heldBy("HandleColor")).toEqual(["Gold", "Gold", "Gold", "Gold"]);
      });

      it("does not put legs back on a cabinet that joins a composition whose legs were switched off", async () => {
        const fixture = setup();
        await applyPreset({ products: makoModel }, fixture.deps);
        await changeAttribute(
          {
            attributeId: "LegColor",
            value: "",
            scope: "cabinet",
            cabinetId: getCabinetEntries(store.getState())[0].stableKey,
          },
          {
            getState: fixture.deps.getState,
            dispatch: fixture.deps.dispatch,
            runtime: fixture.runtime.port,
            flow: "custom",
          },
        );
        expect(heldBy("LegColor")).toEqual(["", "", ""]);

        await addCabinet(
          { product: { productType: "Sink-Cabinet", config: { Drawers: "2D" } }, placement: { kind: "end" } },
          fixture.deps,
        );

        const call = lastCall(fixture.composition);
        expect(call.op === "add" && Object.keys(call.product.config)).not.toContain("LegColor");
      });

      it("adds nothing to a cabinet of a collection without such values", async () => {
        store.dispatch(setActiveProfile(ushProfile));
        store.dispatch(setActiveCollectionId("urban-standard-height"));
        store.dispatch(setActiveRuntimeBindings(ushRuntimeBindings));
        const { composition, deps } = setup(["cab-a"]);

        await addCabinet(
          { product: { productType: "Sink-Base", config: { Width: 60, Drawers: "1D" } }, placement: { kind: "end" } },
          deps,
        );

        const call = lastCall(composition);
        expect(call.op === "add" && call.product.config).toEqual({ Width: 60, Drawers: "1" });
        expect(getValuesByAttributeId(store.getState())).toEqual({});
      });
    });

    describe("a colour the scene keeps per product (Urban Duplex)", () => {
      beforeEach(() => {
        const profile = parseProductProfile(urbanDuplexProfileDocument);
        const bindings = parseRuntimeBindings(urbanDuplexBindingsDocument);
        if (!profile.ok || !bindings.ok) throw new Error("the packaged Urban Duplex data must parse");

        store.dispatch(setActiveProfile(profile.profile));
        store.dispatch(setActiveCollectionId("urban-duplex"));
        store.dispatch(setActiveRuntimeBindings(bindings.bindings));
      });

      const add = (deps: CompositionDeps, productType: string, config: Record<string, unknown>) =>
        addCabinet({ product: { productType, config }, placement: { kind: "end" } }, deps);

      it("starts the first cabinet in the collection's panel colours, with its lateral panel on the right", async () => {
        const { composition, deps } = setup();

        await add(deps, "Sink-Base", { Width: 60, Drawers: "2D" });

        const call = lastCall(composition);
        expect(call.op === "add" && call.product.config).toEqual({
          Width: 60,
          Drawers: "2",
          BasePanelColor: "Bianco Calce DA ST",
          LateralPanelColor: "Pulpis Chiaro TKH",
          LateralPanelSide: "R",
        });
        // The colours stay the configuration's own; only the side is held by each cabinet.
        const values = getValuesByAttributeId(store.getState());
        expect(values.BasePanelColor).toBeUndefined();
        expect(values.LateralPanelColor).toBeUndefined();
        expect(values.LateralPanelSide?.map(({ value }) => value)).toEqual(["R"]);
      });

      it("places a model picked after a colour was chosen in that colour, and in its own otherwise", async () => {
        const model = [
          {
            productType: "Side-Shelf",
            config: { Width: 15, BasePanelColor: "Bianco Calce DA ST", LateralPanelColor: "Pulpis Chiaro TKH" },
          },
          {
            productType: "Sink-Base",
            config: { Width: 70, BasePanelColor: "Bianco Calce DA ST", LateralPanelColor: "Pulpis Chiaro TKH" },
          },
        ];
        const { composition, deps } = setup();

        await applyPreset({ products: model }, deps);
        expect(lastCall(composition)).toMatchObject({ op: "replace", request: { products: model } });

        store.dispatch(
          setAttributeValue({
            attributeId: "BasePanelColor",
            target: { scope: "global" },
            value: "Castagno Scuro 1C3",
          }),
        );
        await applyPreset({ products: model }, deps);

        // The price reads the chosen base colour for every product, so the scene shows it too.
        const call = lastCall(composition);
        expect(call.op === "replace" && call.request.products.map(({ config }) => config)).toEqual([
          { Width: 15, BasePanelColor: "Castagno Scuro 1C3", LateralPanelColor: "Pulpis Chiaro TKH" },
          { Width: 70, BasePanelColor: "Castagno Scuro 1C3", LateralPanelColor: "Pulpis Chiaro TKH" },
        ]);
      });

      /** Two placed drawer cabinets, each holding the side of its lateral panel. */
      const placeTwo = (sides: [string, string] = ["R", "R"]) => {
        const placed = setup(["UD-sink-cabinet-a1b2c3d4e", "UD-side-cabinet-f5g6h7i8j"]);
        const cabinetIds = getCabinetEntries(store.getState()).map(({ stableKey }) => stableKey);
        cabinetIds.forEach((cabinetId, index) =>
          store.dispatch(
            setAttributeValue({
              attributeId: "LateralPanelSide",
              target: { scope: "cabinet", cabinetId },
              value: sides[index],
            }),
          ),
        );
        return { ...placed, cabinetIds };
      };
      const sides = () => {
        const order = getCabinetEntries(store.getState()).map(({ stableKey }) => stableKey);
        return order.map((cabinetId) =>
          getAttributeValue(store.getState(), "LateralPanelSide", { scope: "cabinet", cabinetId }),
        );
      };

      it("turns the lateral panel of one cabinet alone when the change asks for that cabinet", async () => {
        const { runtime, deps, cabinetIds } = placeTwo();

        const result = await changeAttribute(
          {
            attributeId: "LateralPanelSide",
            value: "L",
            scope: "cabinet",
            cabinetId: cabinetIds[1],
            onlyThisCabinet: true,
          },
          deps,
        );

        expect(result.status).toBe("applied");
        // One change for the scene, marked for the cabinet it names; the other cabinet keeps its side.
        expect(runtime.calls).toEqual([
          [
            expect.objectContaining({
              attributeId: "LateralPanelSide",
              target: { scope: "cabinet", cabinetId: cabinetIds[1] },
              value: "L",
              onlyThisCabinet: true,
            }),
          ],
        ]);
        expect(sides()).toEqual(["R", "L"]);
      });

      it("turns them all when a field sets the side, whatever cabinet it names", async () => {
        const { deps, cabinetIds } = placeTwo(["R", "L"]);

        await changeAttribute(
          { attributeId: "LateralPanelSide", value: "L", scope: "cabinet", cabinetId: cabinetIds[0] },
          deps,
        );

        expect(sides()).toEqual(["L", "L"]);
      });

      it("refuses one cabinet alone for a value the scene keeps once for them all", async () => {
        const { runtime, deps, cabinetIds } = placeTwo();

        const result = await changeAttribute(
          { attributeId: "Handle", value: "UG", scope: "cabinet", cabinetId: cabinetIds[1], onlyThisCabinet: true },
          deps,
        );

        expect(result).toMatchObject({ status: "error", code: "scope-mismatch" });
        expect(runtime.calls).toEqual([]);
      });

      it("records a cabinet that joins with the side chosen for it, and with the composition's otherwise", async () => {
        const { composition, deps } = placeTwo(["R", "R"]);

        await add(deps, "Sink-Cabinet", { Width: 60, Drawers: "2D", LateralPanelSide: "L" });

        const call = lastCall(composition);
        expect(call.op === "add" && call.product.config).toMatchObject({ LateralPanelSide: "L" });
        expect(sides()).toEqual(["R", "R", "L"]);

        await add(deps, "Sink-Cabinet", { Width: 60, Drawers: "2D" });

        expect(sides()).toEqual(["R", "R", "L", "R"]);
      });

      const seriesHeld = () => {
        const order = getCabinetEntries(store.getState()).map(({ stableKey }) => stableKey);
        return order.map((cabinetId) => getAttributeValue(store.getState(), "Series", { scope: "cabinet", cabinetId }));
      };

      it("records the series of a cabinet that joins: the one it was placed as, else the collection's", async () => {
        const { composition, deps } = setup();

        await add(deps, "Sink-Base", { Width: 60, Drawers: "2D" });
        // A side cabinet Urban Standard Height supplies, picked as a style of that series.
        await add(deps, "Sink-Cabinet", { Width: 35, Drawers: "2D", Series: "URSTD" });
        await add(deps, "Open-Shelf", { Width: 35 });

        // The scene is told the series of that one product; its binding turns it into the full handles.
        const calls = composition.calls.flatMap((call) => (call.op === "add" ? [call.product.config.Series] : []));
        expect(calls).toEqual([undefined, "URSTD", undefined]);
        // Each cabinet holds its own, so none reads the series of the one beside it.
        expect(seriesHeld()).toEqual(["URDPX", "URSTD", "URDPX"]);
      });

      it("records the collection's series at the cabinets that held none, once one of another series joins", async () => {
        // Placed before the state kept the series of each cabinet.
        const { deps } = setup(["UD-sink-cabinet-a1b2c3d4e", "UD-side-cabinet-f5g6h7i8j"]);
        expect(seriesHeld()).toEqual([undefined, undefined]);

        await addCabinet(
          {
            product: { productType: "Sink-Cabinet", config: { Width: 25, Drawers: "1D", Series: "URLH" } },
            placement: { kind: "beside", anchorRuntimeId: "UD-sink-cabinet-a1b2c3d4e", side: "left" },
          },
          deps,
        );

        // The newcomer stands first, where the composition's values are read: the others keep their own.
        expect(seriesHeld()).toEqual(["URLH", "URDPX", "URDPX"]);
      });

      it("reads back what a cabinet holds of its own, for a copy of it and for its rules", async () => {
        const { deps } = placeTwo(["R", "L"]);
        await add(deps, "Sink-Cabinet", { Width: 35, Drawers: "2D", Series: "URSTD", LateralPanelSide: "L" });
        const [sinkBase, , added] = product().productIds;

        // The series alone decides the rules of a selected cabinet; a copy also takes the side.
        expect(selectOwnCabinetValues(store.getState(), added)).toEqual({ Series: "URSTD" });
        expect(selectOwnCabinetValues(store.getState(), added, { sentToOne: true })).toEqual({
          Series: "URSTD",
          LateralPanelSide: "L",
        });
        expect(selectOwnCabinetValues(store.getState(), sinkBase, { sentToOne: true })).toEqual({
          Series: "URDPX",
          LateralPanelSide: "R",
        });
        expect(selectOwnCabinetValues(store.getState(), "not-placed")).toEqual({});
      });

      it("gives a shelf that joins later the colours chosen for the configuration", async () => {
        const { composition, deps } = setup(["UD-sink-cabinet-a1b2c3d4e"]);
        store.dispatch(
          setAttributeValue({
            attributeId: "BasePanelColor",
            target: { scope: "global" },
            value: "Castagno Scuro 1C3",
          }),
        );
        store.dispatch(
          setAttributeValue({
            attributeId: "LateralPanelColor",
            target: { scope: "global" },
            value: "Metal bronzo 2MD",
          }),
        );

        await add(deps, "Side-Shelf", { Width: 15 });

        expect(lastCall(composition)).toMatchObject({
          op: "add",
          product: {
            productType: "Side-Shelf",
            config: { Width: 15, BasePanelColor: "Castagno Scuro 1C3", LateralPanelColor: "Metal bronzo 2MD" },
          },
        });
      });
    });

    describe("a USH model", () => {
      it("records the model's handle as the composition's and nothing per cabinet", async () => {
        const { deps } = setup();

        await applyPreset(
          {
            products: [
              { productType: "Sink-Base", config: { Width: 60, Drawers: "1D", Handle: "handle_urban_topcut" } },
              { productType: "Open-Shelf", config: { Width: 40 } },
            ],
          },
          deps,
        );

        expect(product().selectedProductConfig?.Handle).toBe("handle_urban_topcut");
        // Only the handle, at the first cabinet, as the handle command records it.
        expect(Object.keys(getValuesByAttributeId(store.getState()))).toEqual(["Handle"]);
        expect(product().placedCabinetStyles).toEqual({ "Sink-Base-new-1": "1" });
      });

      it("leaves the shared values of adopted scene configs to the restore", async () => {
        const { deps } = setup();

        await adoptComposition(
          {
            runtimeIds: ["restored-a"],
            products: [
              {
                productType: "Sink-Base",
                config: {
                  Drawers: "2D",
                  Handle: "handle_pto",
                  HandleGrooveColor: "None",
                  DrawerPanelFluting: "None",
                },
              },
            ],
          },
          deps,
        );

        expect(product().selectedProductConfig?.Handle).toBeUndefined();
        expect(getHandleGrooveColor(store.getState())).toBe("");
        expect(getDrawerPanelFluting(store.getState())).toBe("");
        expect(getValuesByAttributeId(store.getState())).toEqual({});
      });
    });
  });

  describe("removeCabinets", () => {
    it("removes the cabinets and the values addressed to them", async () => {
      const { composition, deps } = setup(["cab-a", "cab-b"]);
      const [, removed] = getCabinetEntries(store.getState());
      const target = { scope: "cabinet" as const, cabinetId: removed.stableKey };
      store.dispatch(setAttributeValue({ attributeId: "TestFinish", target, value: "Matte" }));

      const result = await removeCabinets(["cab-b"], deps);

      expect(result.status).toBe("applied");
      expect(lastCall(composition)).toEqual({ op: "remove", runtimeIds: ["cab-b"] });
      expect(product().productIds).toEqual(["cab-a"]);
      expect(getAttributeValue(store.getState(), "TestFinish", target)).toBeUndefined();
    });

    it("sends nothing for a cabinet that is not in the composition", async () => {
      const { composition, deps } = setup(["cab-a"]);

      const result = await removeCabinets(["cab-z"], deps);

      expect(result).toMatchObject({ status: "error", code: "unknown-target" });
      expect(composition.calls).toHaveLength(0);
    });
  });

  it("swaps two cabinets and keeps their stable keys", async () => {
    const { deps } = setup(["cab-a", "cab-b"]);
    const keysBefore = getCabinetEntries(store.getState()).map(({ runtimeId, stableKey }) => [runtimeId, stableKey]);

    await swapCabinets("cab-a", "cab-b", deps);

    expect(product().productIds).toEqual(["cab-b", "cab-a"]);
    expect(getCabinetEntries(store.getState()).map(({ runtimeId, stableKey }) => [runtimeId, stableKey])).toEqual(
      [...keysBefore].reverse(),
    );
  });

  describe("clearComposition", () => {
    it("takes the towel bar and the side panels off before the products", async () => {
      const { composition, runtime, sidePanels, deps } = setup(["cab-a"]);

      const result = await clearComposition({ resetAddOns: true }, deps);

      expect(result).toMatchObject({ status: "applied", productIds: [] });
      expect(runtime.calls.map((set) => set.map(({ attributeId, value }) => [attributeId, value]))).toEqual([
        [["TowelBarOption", "None"]],
      ]);
      expect(sidePanels.calls).toEqual([{ placements: [{ panel: "None", side: "both" }], cabinetCount: undefined }]);
      expect(lastCall(composition)).toEqual({ op: "clear" });
      expect(product().productIds).toEqual([]);
    });

    it("leaves the add-ons when asked only to clear the products", async () => {
      const { runtime, sidePanels, deps } = setup(["cab-a"]);

      await clearComposition({ resetAddOns: false }, deps);

      expect(runtime.calls).toHaveLength(0);
      expect(sidePanels.calls).toHaveLength(0);
      expect(product().productIds).toEqual([]);
    });

    it("sends nothing while the scene is not ready", async () => {
      const { composition, runtime, deps } = setup(["cab-a"]);
      composition.setReady(false);

      const result = await clearComposition({ resetAddOns: true }, deps);

      expect(result).toMatchObject({ status: "error", code: "runtime-not-ready" });
      expect(runtime.calls).toHaveLength(0);
      expect(product().productIds).toEqual(["cab-a"]);
    });
  });
});
