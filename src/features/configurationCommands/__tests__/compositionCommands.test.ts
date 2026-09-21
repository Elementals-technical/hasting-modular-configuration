import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import {
  getAttributeValue,
  getCabinetEntries,
  getRuntimeSyncState,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setAttributeValue,
} from "@/entities/configuration";
import { getCabinetColor, getVesselColor } from "@/entities/product/model/store/selectors";
import { recordComposition, reset, setActiveProfile } from "@/entities/product/model/store/slice";
import {
  createTestCompositionPort,
  createTestRuntimePort,
  createTestSidePanelPort,
  type TestCompositionPort,
} from "@/features/playCanvasAdapter";

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
