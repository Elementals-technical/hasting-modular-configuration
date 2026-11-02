import { configureStore, createListenerMiddleware } from "@reduxjs/toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { recordValues } from "@/features/configurationCommands/lib/replayValues";
import { store } from "@/app/store";
import { rootReducer } from "@/app/store/reducer";
import {
  clearRestore,
  getAttributeValue,
  getCabinetDimensions,
  getCabinetEntries,
  getDimensionsByCabinet,
  getRestoreState,
  requestSceneStateSync,
  resetConfiguration,
  setActiveCollectionId,
  setActivePrebuiltPresetId,
  setExplicitUserChoice,
  syncCabinets,
} from "@/entities/configuration";
import type { ConfigurationRecord, SceneRestoreMatch } from "@/entities/configuration";
import { clearHistory } from "@/entities/history/model/store/slice";
import { addProductId, reset, resetProducts, setActiveProfile } from "@/entities/product/model/store/slice";
import { setupSceneStateListener } from "@/features/configurationCommands";
import { createTestSceneReader } from "@/features/playCanvasAdapter";
import { createTestSceneRestorer } from "@/features/playCanvasAdapter/lib/testSceneRestorer";
import { isRestoreBlockingSave } from "@/features/saveConfiguration/lib/restoreSaveGuard";

import type { RestorePlan } from "../lib/buildRestorePlan";
import { restoreSavedConfiguration } from "../lib/restoreSavedConfiguration";

vi.mock("@/utils/functions/playcanvas/setConfigBatch", () => ({
  setConfigBatch: vi.fn(async () => ({ updatedIds: [] })),
  runInBatchQueue: vi.fn(async (task: () => Promise<unknown>) => task()),
}));

vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));

vi.mock("@/utils/functions/playcanvas/getConfig", () => ({
  getConfig: vi.fn(async () => ({ Width: 60 })),
}));

const USH = "urban-standard-height";
const CONFIG_ID = "13507";

const savedRecord = (): ConfigurationRecord => ({
  configuration: {
    "Sink-Base-aaa111": { ProductType: "Sink-Base", Width: 60 },
    "Sink-Cabinet-bbb222": { ProductType: "Sink-Cabinet", Width: 80 },
    "Top_Solid-ccc333": { productType: "Top_Solid", Width: 140 },
  },
  metadata: {
    path: "/custom/summary",
    orderedProductIds: ["Sink-Base-aaa111", "Sink-Cabinet-bbb222", "Top_Solid-ccc333"],
    collectionId: USH,
    uiState: {},
    configuration: {
      version: 1,
      collectionId: USH,
      cabinets: [
        { stableKey: "cab-4", index: 0 },
        { stableKey: "cab-7", index: 1 },
      ],
      values: { "cabinet:cab-7": { TestFinish: "Matte" }, "cabinet:cab-4": { TestFinish: "Gloss" } },
    },
  },
});

const setUp = (record: ConfigurationRecord = savedRecord()) => {
  const scene = createTestSceneRestorer();
  const loadRecord = vi.fn(async () => record);
  // Like a page: records the rebuilt products as its composition.
  const applyPage = vi.fn(async (_plan: RestorePlan, matches: SceneRestoreMatch[]) => {
    store.dispatch(resetProducts());
    matches.forEach(({ runtimeId }) => store.dispatch(addProductId(runtimeId)));
  });

  const restore = () =>
    restoreSavedConfiguration(CONFIG_ID, {
      dispatch: store.dispatch,
      getState: store.getState,
      loadRecord,
      restorer: scene.restorer,
      applyPage,
    });

  return { scene, loadRecord, applyPage, restore };
};

describe("restoreSavedConfiguration", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(clearRestore());
    store.dispatch(clearHistory());
    store.dispatch(setActiveCollectionId(USH));
  });

  it("rebuilds the cabinets, gives them their saved keys and values and starts the history over", async () => {
    store.dispatch(setActiveProfile(ushProfile));
    const record = savedRecord();
    record.metadata.uiState = { CabinetColor: "Rovere Moro 934", CountertopColor: "Automatic top" };
    store.dispatch(setExplicitUserChoice({ attributeId: "CabinetColor", chosen: true }));
    store.dispatch(setExplicitUserChoice({ attributeId: "HandleGrooveColor", chosen: true }));
    store.dispatch(setActivePrebuiltPresetId(13));
    const { scene, restore, applyPage } = setUp(record);
    const applyBase = applyPage.getMockImplementation();
    applyPage.mockImplementationOnce(async (plan, matches) => {
      await applyBase?.(plan, matches);
      recordValues({ CabinetColor: "Rovere Moro 934", CountertopColor: "Automatic top" }, {
        getState: store.getState, dispatch: store.dispatch, flow: "custom",
      });
    });

    const result = await restore();
    // Matching saved values carry no evidence that they were explicit user choices.
    expect(store.getState().rootStateUI.configuration.explicitUserChoices).toEqual({});
    expect(store.getState().rootStateUI.configuration.activePrebuiltPresetId).toBeNull();
    expect(store.getState().rootStateUI.product.productOptions).toMatchObject({
      CabinetColor: "Rovere Moro 934",
      CountertopColor: "Automatic top",
    });

    expect(result.status).toBe("restored");
    expect(scene.requests[0].products.map(({ sourceId }) => sourceId)).toEqual([
      "Sink-Base-aaa111",
      "Sink-Cabinet-bbb222",
    ]);
    expect(getCabinetEntries(store.getState())).toEqual([
      { stableKey: "cab-4", runtimeId: "new-Sink-Base-aaa111", index: 0 },
      { stableKey: "cab-7", runtimeId: "new-Sink-Cabinet-bbb222", index: 1 },
    ]);
    expect(getAttributeValue(store.getState(), "TestFinish", { scope: "cabinet", cabinetId: "cab-7" })).toBe("Matte");
    expect(getRestoreState(store.getState())).toEqual({
      configId: CONFIG_ID,
      status: "restored",
      reason: null,
      message: null,
    });
    // Nothing to undo yet: the first change writes the restored configuration.
    expect(store.getState().rootStateUI.history.past).toEqual([]);
    expect(store.getState().rootStateUI.history.isRestoring).toBe(false);
  });

  it("does not restore the same configuration twice", async () => {
    const { loadRecord, scene, restore } = setUp();

    const results = await Promise.all([restore(), restore()]);
    const again = await restore();

    expect(results.map(({ status }) => status)).toEqual(["restored", "skipped"]);
    expect(again.status).toBe("skipped");
    expect(loadRecord).toHaveBeenCalledTimes(1);
    expect(scene.requests).toHaveLength(1);
  });

  it.each([
    ["a payload without product configs", { ...savedRecord(), configuration: null }, "invalid"],
    [
      "a configuration of another collection",
      { ...savedRecord(), metadata: { ...savedRecord().metadata, collectionId: "mako" } },
      "collection",
    ],
    [
      "a configuration that names an empty collection",
      {
        ...savedRecord(),
        metadata: {
          ...savedRecord().metadata,
          collectionId: null,
          configuration: { ...(savedRecord().metadata.configuration as object), collectionId: "" },
        },
      },
      "collection",
    ],
  ])("fails on %s without touching the scene", async (_, record, reason) => {
    const { scene, applyPage, restore } = setUp(record as unknown as ConfigurationRecord);

    const result = await restore();

    expect(result).toMatchObject({ status: "failed", reason });
    expect(scene.requests).toEqual([]);
    expect(applyPage).not.toHaveBeenCalled();
    expect(getRestoreState(store.getState())).toMatchObject({ status: "failed", reason });
    expect(isRestoreBlockingSave(getRestoreState(store.getState()).status)).toBe(true);
  });

  it("reports a saved configuration that could not be loaded as not found", async () => {
    const { scene, loadRecord, restore } = setUp();
    loadRecord.mockRejectedValueOnce(new Error("404"));

    const result = await restore();

    expect(result).toMatchObject({ status: "failed", reason: "not-found" });
    expect(scene.requests).toEqual([]);
  });

  it("fails without changes when the restorer rejects the composition", async () => {
    const { scene, applyPage, restore } = setUp();
    scene.setIssues([{ code: "unknown-product-type", sourceId: "Sink-Base-aaa111", message: "no scene type" }]);

    const result = await restore();

    expect(result).toEqual({ status: "failed", reason: "scene", message: "no scene type" });
    expect(applyPage).not.toHaveBeenCalled();
    expect(store.getState().rootStateUI.history.past).toEqual([]);
  });

  it("restores a legacy payload as the default collection, without saved keys", async () => {
    const record = savedRecord();
    delete record.metadata.configuration;
    delete record.metadata.collectionId;
    const { restore } = setUp(record);

    const result = await restore();

    expect(result.status).toBe("restored");
    expect(getCabinetEntries(store.getState()).map(({ runtimeId }) => runtimeId)).toEqual([
      "new-Sink-Base-aaa111",
      "new-Sink-Cabinet-bbb222",
    ]);
  });

  it("records a partial restore, blocks Save and clears the status once the composition changes", async () => {
    const { scene, restore } = setUp();
    scene.answerWith({
      status: "partial",
      matches: [{ sourceId: "Sink-Cabinet-bbb222", runtimeId: "new-bbb222" }],
      failed: [{ sourceId: "Sink-Base-aaa111", code: "not-created", message: "no asset" }],
      scene: { status: "ready", order: ["new-bbb222"], cabinets: [] },
    });

    const result = await restore();

    expect(result.status).toBe("partial");
    expect(getCabinetEntries(store.getState())).toEqual([{ stableKey: "cab-7", runtimeId: "new-bbb222", index: 0 }]);
    expect(getAttributeValue(store.getState(), "TestFinish", { scope: "cabinet", cabinetId: "cab-4" })).toBeUndefined();
    expect(getRestoreState(store.getState())).toMatchObject({
      status: "partial",
      reason: "partial",
      message: "no asset",
    });
    expect(isRestoreBlockingSave("partial")).toBe(true);

    store.dispatch(addProductId("Sink-Base-user01"));

    expect(getRestoreState(store.getState()).status).toBe("idle");
  });

  it("asks the scene to put the cabinets back where the configuration was saved", async () => {
    const record = savedRecord();
    const sceneLayout = {
      version: 1,
      document: {
        presetSchemaVersion: 2,
        collection: {},
        presetProducts: [{ key: "cabinet0" }, { key: "cabinet1" }],
        presetLayout: {},
      },
      cabinetIds: { cabinet0: "Sink-Base-aaa111", cabinet1: "Sink-Cabinet-bbb222" },
    };
    record.metadata.sceneLayout = sceneLayout;
    const { scene, restore } = setUp(record);

    const result = await restore();

    expect(result.status).toBe("restored");
    expect(scene.requests[0].layout).toEqual(sceneLayout);
  });

  it("asks for one row when the configuration was saved without a layout", async () => {
    const { scene, restore } = setUp();

    await restore();

    expect("layout" in scene.requests[0]).toBe(false);
  });
});

describe("restoreSavedConfiguration with a scene reader", () => {
  const LOW = { width: 60, height: 50, depth: 46 };
  const HIGH = { width: 80, height: 56, depth: 50.5 };

  it("reads the sizes again when the saved keys differ from the session's", async () => {
    const reader = createTestSceneReader();
    reader.setScene(["new-Sink-Base-aaa111", "new-Sink-Cabinet-bbb222"], {
      "new-Sink-Base-aaa111": LOW,
      "new-Sink-Cabinet-bbb222": HIGH,
    });

    // Its own store: the app store's listener reads the real scene, not this one.
    const listener = createListenerMiddleware();
    setupSceneStateListener(listener.startListening, { reader: reader.reader, settleMs: 0 });
    const isolated = configureStore({
      reducer: rootReducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }).prepend(listener.middleware),
    });
    isolated.dispatch(setActiveCollectionId(USH));

    const result = await restoreSavedConfiguration(CONFIG_ID, {
      dispatch: isolated.dispatch,
      getState: isolated.getState,
      loadRecord: async () => savedRecord(),
      restorer: createTestSceneRestorer().restorer,
      // Like a page: the rebuilt products get session keys, and their sizes are read under those.
      applyPage: async (_plan, matches) => {
        isolated.dispatch(syncCabinets(matches.map(({ runtimeId }) => runtimeId)));
        isolated.dispatch(requestSceneStateSync());
        await vi.waitFor(() => expect(getCabinetDimensions(isolated.getState(), "cab-2")).toEqual(HIGH));
      },
    });

    expect(result.status).toBe("restored");
    await vi.waitFor(() =>
      expect(getDimensionsByCabinet(isolated.getState())).toEqual({ "cab-4": LOW, "cab-7": HIGH }),
    );
  });
});
