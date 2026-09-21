import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { getAttributeValue, getCabinetEntries, resetConfiguration, setAttributeValue } from "@/entities/configuration";
import { addProductId, removeProductId, reset, swapProductIds } from "@/entities/product/model/store/slice";

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
