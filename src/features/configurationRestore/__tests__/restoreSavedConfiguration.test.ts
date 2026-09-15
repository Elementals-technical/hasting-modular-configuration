import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import {
  clearRestore,
  getAttributeValue,
  getCabinetEntries,
  getRestoreState,
  resetConfiguration,
  setActiveCollectionId,
} from "@/entities/configuration";
import type { ConfigurationRecord, SceneRestoreMatch } from "@/entities/configuration";
import { clearHistory } from "@/entities/history/model/store/slice";
import { addProductId, reset, resetProducts } from "@/entities/product/model/store/slice";
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
    const { scene, restore } = setUp();

    const result = await restore();

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
    expect(getRestoreState(store.getState())).toEqual({ configId: CONFIG_ID, status: "restored", message: null });
    expect(store.getState().rootStateUI.history.past).toHaveLength(1);
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
    ["a payload without product configs", { ...savedRecord(), configuration: null }],
    [
      "a configuration of another collection",
      { ...savedRecord(), metadata: { ...savedRecord().metadata, collectionId: "mako" } },
    ],
  ])("fails on %s without touching the scene", async (_, record) => {
    const { scene, applyPage, restore } = setUp(record as unknown as ConfigurationRecord);

    const result = await restore();

    expect(result.status).toBe("failed");
    expect(scene.requests).toEqual([]);
    expect(applyPage).not.toHaveBeenCalled();
    expect(getRestoreState(store.getState()).status).toBe("failed");
    expect(isRestoreBlockingSave(getRestoreState(store.getState()).status)).toBe(true);
  });

  it("fails without changes when the restorer rejects the composition", async () => {
    const { scene, applyPage, restore } = setUp();
    scene.setIssues([{ code: "unknown-product-type", sourceId: "Sink-Base-aaa111", message: "no scene type" }]);

    const result = await restore();

    expect(result).toEqual({ status: "failed", message: "no scene type" });
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
    expect(getRestoreState(store.getState())).toMatchObject({ status: "partial", message: "no asset" });
    expect(isRestoreBlockingSave("partial")).toBe(true);

    store.dispatch(addProductId("Sink-Base-user01"));

    expect(getRestoreState(store.getState()).status).toBe("idle");
  });
});
