import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { getAttributeValue, getCabinetEntries, resetConfiguration, setAttributeValue } from "@/entities/configuration";
import {
  addProductId,
  commitRuleSelection,
  removeProductId,
  reset,
  setActiveProfile,
  setSelectedProductConfig,
  swapProductIds,
} from "@/entities/product/model/store/slice";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";

vi.mock("@/utils/functions/playcanvas/setConfigBatch", () => ({
  setConfigBatch: vi.fn(async () => ({ updatedIds: [] })),
  runInBatchQueue: vi.fn(async (task: () => Promise<unknown>) => task()),
}));

const runtimeIds = () => getCabinetEntries(store.getState()).map(({ runtimeId }) => runtimeId);

describe("cabinet sync", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
  });

  it("registers placed products as cabinets in composition order", () => {
    store.dispatch(addProductId("rt-a"));
    store.dispatch(addProductId("rt-b"));

    expect(runtimeIds()).toEqual(["rt-a", "rt-b"]);

    store.dispatch(swapProductIds({ idA: "rt-a", idB: "rt-b" }));

    expect(runtimeIds()).toEqual(["rt-b", "rt-a"]);
  });

  it("keeps the stable key of a remaining cabinet and drops the values of a removed one", () => {
    store.dispatch(addProductId("rt-a"));
    store.dispatch(addProductId("rt-b"));
    const [first, second] = getCabinetEntries(store.getState());
    const target = { scope: "cabinet" as const, cabinetId: first.stableKey };
    store.dispatch(setAttributeValue({ attributeId: "TestFinish", target, value: "Matte" }));

    store.dispatch(removeProductId("rt-a"));

    expect(getCabinetEntries(store.getState())).toEqual([{ ...second, index: 0 }]);
    expect(getAttributeValue(store.getState(), "TestFinish", target)).toBeUndefined();
  });
});

describe("handle scene sync", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
    vi.mocked(setConfigBatch).mockClear();
  });

  it("sends a handle the state changed on its own to the scene once", async () => {
    store.dispatch(addProductId("rt-a"));
    store.dispatch(setSelectedProductConfig({ Handle: "handle_pto" }));

    await vi.waitFor(() => expect(setConfigBatch).toHaveBeenCalledTimes(1));
    expect(setConfigBatch).toHaveBeenCalledWith({}, expect.objectContaining({ Handle: "handle_pto" }));
  });

  it("does not send a handle the command service already applied", async () => {
    store.dispatch(addProductId("rt-a"));
    store.dispatch(commitRuleSelection({ handle: "handle_pto" }));

    await Promise.resolve();
    expect(setConfigBatch).not.toHaveBeenCalled();
    expect(store.getState().rootStateUI.product.selectedProductConfig?.Handle).toBe("handle_pto");
  });

  it("has nothing to send while no product is placed", async () => {
    store.dispatch(setSelectedProductConfig({ Handle: "handle_pto" }));

    await Promise.resolve();
    expect(setConfigBatch).not.toHaveBeenCalled();
  });
});
