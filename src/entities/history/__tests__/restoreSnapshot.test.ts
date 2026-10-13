import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import {
  getAttributeValue,
  getCabinetEntries,
  resetConfiguration,
  setAttributeValue,
  type SceneLayout,
} from "@/entities/configuration";
import { addProductId, reset, setCabinetColor, setTowelBarOption } from "@/entities/product/model/store/slice";
import { createTestSceneRestorer } from "@/features/playCanvasAdapter/lib/testSceneRestorer";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";

import { captureSnapshot } from "../lib/captureSnapshot";
import { buildSnapshotRestoreRequest, restoreSnapshot } from "../lib/restoreSnapshot";
import type { SceneSnapshot } from "../model/store/slice";

vi.mock("@/utils/functions/playcanvas/setConfigBatch", () => ({
  setConfigBatch: vi.fn(async () => ({ updatedIds: [] })),
  runInBatchQueue: vi.fn(async (task: () => Promise<unknown>) => task()),
}));

vi.mock("@/features/sidePanel", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/sidePanel")>()),
  restoreSidePanelState: vi.fn(async () => undefined),
}));

vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));

vi.mock("@/utils/functions/playcanvas/getConfig", () => ({
  getConfig: vi.fn(async (productId: string) => ({ Width: productId === "rt-a" ? 60 : 80, Drawers: "1D" })),
}));

const HANDLE_FINISH = "TestFinish";
const getState = () => store.getState();
const replay = vi.fn(async () => undefined);

const placeTwoCabinets = () => {
  store.dispatch(addProductId("rt-a"));
  store.dispatch(addProductId("rt-b"));
  store.dispatch(
    setAttributeValue({ attributeId: HANDLE_FINISH, target: { scope: "cabinet", cabinetId: "cab-2" }, value: "Matte" }),
  );
};

describe("history snapshot restore", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    vi.mocked(setConfigBatch).mockClear();
    replay.mockClear();
  });

  it("records the stable key of every product", async () => {
    placeTwoCabinets();

    const snapshot = await captureSnapshot(getState);

    expect(snapshot.cabinetKeys).toEqual({ "rt-a": "cab-1", "rt-b": "cab-2" });
  });

  it("gives rebuilt products their stable keys and per-cabinet values back", async () => {
    placeTwoCabinets();
    const snapshot = await captureSnapshot(getState);
    const { restorer, requests } = createTestSceneRestorer();

    const result = await restoreSnapshot(snapshot, {
      dispatch: store.dispatch,
      getState,
      getBindings: () => null,
      restorer,
      replay,
    });

    expect(result.status).toBe("restored");
    expect(requests[0].products.map(({ sourceId, config }) => [sourceId, config?.Width])).toEqual([
      ["rt-a", 60],
      ["rt-b", 80],
    ]);
    expect(store.getState().rootStateUI.product.productIds).toEqual(["new-rt-a", "new-rt-b"]);
    expect(getCabinetEntries(store.getState())).toEqual([
      { stableKey: "cab-1", runtimeId: "new-rt-a", index: 0 },
      { stableKey: "cab-2", runtimeId: "new-rt-b", index: 1 },
    ]);
    expect(getAttributeValue(store.getState(), HANDLE_FINISH, { scope: "cabinet", cabinetId: "cab-2" })).toBe("Matte");
  });

  it("rebuilds Mako cabinets as the Mako products they were, with their drawer styles", async () => {
    store.dispatch(addProductId("Mako-sink-cabinet-k3j4h5g6f"));
    store.dispatch(addProductId("Mako-side-cabinet-a1b2c3d4e"));
    const snapshot = await captureSnapshot(getState);
    const { restorer } = createTestSceneRestorer();

    expect(buildSnapshotRestoreRequest(snapshot).products.map(({ productType }) => productType)).toEqual([
      "Mako-sink-cabinet",
      "Mako-side-cabinet",
    ]);

    await restoreSnapshot(snapshot, { dispatch: store.dispatch, getState, getBindings: () => null, restorer, replay });

    expect(Object.values(store.getState().rootStateUI.product.placedCabinetStyles)).toEqual(["1", "1"]);
  });

  it("shows the snapshot's values on the rebuilt scene through the command service only", async () => {
    placeTwoCabinets();
    store.dispatch(setCabinetColor("Pulpis Chiaro TKH"));
    store.dispatch(setTowelBarOption("Right"));
    const snapshot = await captureSnapshot(getState);
    const { restorer } = createTestSceneRestorer();

    await restoreSnapshot(snapshot, { dispatch: store.dispatch, getState, getBindings: () => null, restorer, replay });

    expect(replay).toHaveBeenCalledTimes(1);
    expect(replay).toHaveBeenCalledWith(
      expect.objectContaining({ CabinetColor: "Pulpis Chiaro TKH", TowelBarOption: "Right" }),
    );
    expect(setConfigBatch).not.toHaveBeenCalled();
  });

  it("changes neither the scene add-ons nor the state when the restorer rejects the snapshot", async () => {
    placeTwoCabinets();
    const snapshot: SceneSnapshot = { ...(await captureSnapshot(getState)), productConfigs: {} };
    const { restorer, setIssues } = createTestSceneRestorer();
    setIssues([{ code: "invalid-config", sourceId: "rt-a", message: "no config" }]);

    const result = await restoreSnapshot(snapshot, {
      dispatch: store.dispatch,
      getState,
      getBindings: () => null,
      restorer,
      replay,
    });

    expect(result.status).toBe("rejected");
    expect(store.getState().rootStateUI.product.productIds).toEqual(["rt-a", "rt-b"]);
    expect(replay).not.toHaveBeenCalled();
    expect(setConfigBatch).not.toHaveBeenCalled();
  });

  it("records only the products a partial restore created", async () => {
    placeTwoCabinets();
    const snapshot = await captureSnapshot(getState);
    const { restorer, answerWith } = createTestSceneRestorer();
    answerWith({
      status: "partial",
      matches: [{ sourceId: "rt-b", runtimeId: "new-rt-b" }],
      failed: [{ sourceId: "rt-a", code: "not-created", message: "no asset" }],
      scene: { status: "ready", order: ["new-rt-b"], cabinets: [] },
    });

    const result = await restoreSnapshot(snapshot, {
      dispatch: store.dispatch,
      getState,
      getBindings: () => null,
      restorer,
      replay,
    });

    expect(result.status).toBe("partial");
    expect(store.getState().rootStateUI.product.productIds).toEqual(["new-rt-b"]);
    expect(getCabinetEntries(store.getState())).toEqual([{ stableKey: "cab-2", runtimeId: "new-rt-b", index: 0 }]);
  });

  describe("with the layout of the scene", () => {
    const layoutOf = (...ids: string[]): SceneLayout => ({
      version: 1,
      document: { presetSchemaVersion: 2, collection: {}, presetProducts: [], presetLayout: {} },
      cabinetIds: Object.fromEntries(ids.map((id, index) => [`cabinet${index}`, id])),
    });

    it("keeps the layout the scene reports for the products of the snapshot", async () => {
      placeTwoCabinets();
      const layout = layoutOf("rt-b", "rt-a");
      const captureLayout = vi.fn(async () => layout);

      const snapshot = await captureSnapshot(getState, { captureLayout });

      expect(snapshot.sceneLayout).toBe(layout);
      expect(buildSnapshotRestoreRequest(snapshot).layout).toBe(layout);
    });

    it.each([
      ["the scene has none", async () => null],
      ["the scene fails to read it", async () => Promise.reject(new Error("busy"))],
      ["it describes other products", async () => layoutOf("rt-a", "rt-x")],
      ["it describes fewer products", async () => layoutOf("rt-a")],
    ])("captures the snapshot without a layout when %s", async (_, captureLayout) => {
      placeTwoCabinets();

      const snapshot = await captureSnapshot(getState, { captureLayout });

      expect(snapshot.productIds).toEqual(["rt-a", "rt-b"]);
      expect("sceneLayout" in snapshot).toBe(false);
      expect("layout" in buildSnapshotRestoreRequest(snapshot)).toBe(false);
    });

    it("does not ask for a layout of an empty composition", async () => {
      const captureLayout = vi.fn(async () => layoutOf("rt-a"));

      const snapshot = await captureSnapshot(getState, { captureLayout });

      expect(captureLayout).not.toHaveBeenCalled();
      expect("sceneLayout" in snapshot).toBe(false);
    });

    it("gives each cabinet its own key back when the scene lists the rows in another order", async () => {
      placeTwoCabinets();
      const snapshot = await captureSnapshot(getState, { captureLayout: async () => layoutOf("rt-a", "rt-b") });
      const { restorer, answerWith } = createTestSceneRestorer();
      answerWith({
        status: "restored",
        matches: [
          { sourceId: "rt-b", runtimeId: "new-rt-b" },
          { sourceId: "rt-a", runtimeId: "new-rt-a" },
        ],
        scene: { status: "ready", order: ["new-rt-b", "new-rt-a"], cabinets: [] },
      });

      await restoreSnapshot(snapshot, {
        dispatch: store.dispatch,
        getState,
        getBindings: () => null,
        restorer,
        replay,
      });

      expect(store.getState().rootStateUI.product.productIds).toEqual(["new-rt-b", "new-rt-a"]);
      expect(getCabinetEntries(store.getState())).toEqual([
        { stableKey: "cab-2", runtimeId: "new-rt-b", index: 0 },
        { stableKey: "cab-1", runtimeId: "new-rt-a", index: 1 },
      ]);
      expect(getAttributeValue(store.getState(), HANDLE_FINISH, { scope: "cabinet", cabinetId: "cab-2" })).toBe(
        "Matte",
      );
    });
  });
});
