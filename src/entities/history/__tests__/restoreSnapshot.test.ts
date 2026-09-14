import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { getAttributeValue, getCabinetEntries, resetConfiguration, setAttributeValue } from "@/entities/configuration";
import { addProductId, reset } from "@/entities/product/model/store/slice";
import { createTestSceneRestorer } from "@/features/playCanvasAdapter/lib/testSceneRestorer";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";

import { captureSnapshot } from "../lib/captureSnapshot";
import { restoreSnapshot } from "../lib/restoreSnapshot";
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

    const result = await restoreSnapshot(snapshot, { dispatch: store.dispatch, getState, restorer });

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

  it("changes neither the scene add-ons nor the state when the restorer rejects the snapshot", async () => {
    placeTwoCabinets();
    const snapshot: SceneSnapshot = { ...(await captureSnapshot(getState)), productConfigs: {} };
    const { restorer, setIssues } = createTestSceneRestorer();
    setIssues([{ code: "invalid-config", sourceId: "rt-a", message: "no config" }]);

    const result = await restoreSnapshot(snapshot, { dispatch: store.dispatch, getState, restorer });

    expect(result.status).toBe("rejected");
    expect(store.getState().rootStateUI.product.productIds).toEqual(["rt-a", "rt-b"]);
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

    const result = await restoreSnapshot(snapshot, { dispatch: store.dispatch, getState, restorer });

    expect(result.status).toBe("partial");
    expect(store.getState().rootStateUI.product.productIds).toEqual(["new-rt-b"]);
    expect(getCabinetEntries(store.getState())).toEqual([{ stableKey: "cab-2", runtimeId: "new-rt-b", index: 0 }]);
  });
});
