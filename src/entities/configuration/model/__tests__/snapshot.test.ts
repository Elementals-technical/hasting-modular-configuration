import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { reset } from "@/entities/product/model/store/slice";

import {
  getActiveCollectionId,
  getAttributeValue,
  getCabinetEntries,
  getConfigurationSnapshot,
  getStableKeyForRuntimeId,
} from "../store/selectors";
import {
  dropValuesForCabinet,
  resetConfiguration,
  restoreConfigurationFragment,
  setActiveCollectionId,
  setAttributeValue,
  syncCabinetOrder,
  syncCabinets,
} from "../store/slice";
import { ATTRIBUTE_OWNERSHIP } from "../ownership";

describe("configuration state", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveCollectionId(null));
  });

  it("addresses the same attribute separately per product", () => {
    store.dispatch(syncCabinets(["rt-a", "rt-b"]));

    store.dispatch(
      setAttributeValue({ attributeId: "Drawers", target: { scope: "cabinet", cabinetId: "cab-1" }, value: "1" }),
    );
    store.dispatch(
      setAttributeValue({ attributeId: "Drawers", target: { scope: "cabinet", cabinetId: "cab-2" }, value: "2" }),
    );

    const state = store.getState();
    expect(getAttributeValue(state, "Drawers", { scope: "cabinet", cabinetId: "cab-1" })).toBe("1");
    expect(getAttributeValue(state, "Drawers", { scope: "cabinet", cabinetId: "cab-2" })).toBe("2");
  });

  it("keeps drawer-scoped values apart within one product", () => {
    store.dispatch(syncCabinets(["rt-a"]));

    store.dispatch(
      setAttributeValue({
        attributeId: "DividersStyle",
        target: { scope: "drawer", cabinetId: "cab-1", drawerType: "Top" },
        value: "Option A",
      }),
    );
    store.dispatch(
      setAttributeValue({
        attributeId: "DividersStyle",
        target: { scope: "drawer", cabinetId: "cab-1", drawerType: "Bot" },
        value: "Option B",
      }),
    );

    const state = store.getState();
    expect(
      getAttributeValue(state, "DividersStyle", { scope: "drawer", cabinetId: "cab-1", drawerType: "Top" }),
    ).toBe("Option A");
    expect(
      getAttributeValue(state, "DividersStyle", { scope: "drawer", cabinetId: "cab-1", drawerType: "Bot" }),
    ).toBe("Option B");
  });

  it("overwrites the value of the same target instead of appending a second entry", () => {
    store.dispatch(syncCabinets(["rt-a"]));

    store.dispatch(
      setAttributeValue({ attributeId: "Handle", target: { scope: "cabinet", cabinetId: "cab-1" }, value: "a" }),
    );
    store.dispatch(
      setAttributeValue({ attributeId: "Handle", target: { scope: "cabinet", cabinetId: "cab-1" }, value: "b" }),
    );

    expect(store.getState().rootStateUI.configuration.valuesByAttributeId.Handle).toHaveLength(1);
    expect(getAttributeValue(store.getState(), "Handle", { scope: "cabinet", cabinetId: "cab-1" })).toBe("b");
  });

  it("drops per-product values when the product is gone", () => {
    store.dispatch(syncCabinets(["rt-a", "rt-b"]));
    store.dispatch(
      setAttributeValue({ attributeId: "Handle", target: { scope: "cabinet", cabinetId: "cab-1" }, value: "a" }),
    );
    store.dispatch(
      setAttributeValue({ attributeId: "Handle", target: { scope: "cabinet", cabinetId: "cab-2" }, value: "b" }),
    );

    store.dispatch(dropValuesForCabinet("cab-1"));

    const state = store.getState();
    expect(getAttributeValue(state, "Handle", { scope: "cabinet", cabinetId: "cab-1" })).toBeUndefined();
    expect(getAttributeValue(state, "Handle", { scope: "cabinet", cabinetId: "cab-2" })).toBe("b");
  });

  it("maps runtime ids to stable keys and follows the scene order", () => {
    store.dispatch(syncCabinets(["rt-a", "rt-b"]));
    expect(getStableKeyForRuntimeId(store.getState(), "rt-b")).toBe("cab-2");

    store.dispatch(syncCabinetOrder(["rt-b", "rt-a"]));
    expect(getCabinetEntries(store.getState()).map((entry) => entry.stableKey)).toEqual(["cab-2", "cab-1"]);
  });
});

describe("configuration snapshot", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
  });

  it("carries the collection, the order and the values", () => {
    store.dispatch(setActiveCollectionId("urban-standard-height"));
    store.dispatch(syncCabinets(["rt-a", "rt-b"]));
    store.dispatch(
      setAttributeValue({ attributeId: "Handle", target: { scope: "cabinet", cabinetId: "cab-2" }, value: "x" }),
    );

    const snapshot = getConfigurationSnapshot(store.getState());

    expect(snapshot.collectionId).toBe("urban-standard-height");
    expect(snapshot.version).toBe(1);
    expect(snapshot.cabinets.map((entry) => entry.stableKey)).toEqual(["cab-1", "cab-2"]);
    expect(snapshot.values.Handle).toEqual([{ target: { scope: "cabinet", cabinetId: "cab-2" }, value: "x" }]);
  });

  it("round-trips an attribute that has no typed field anywhere", () => {
    // TESTING §2 proof 3: a declared attribute must survive Save/restore without a
    // reducer field or a save whitelist of its own.
    expect(ATTRIBUTE_OWNERSHIP.TestGrooveFinish).toBeUndefined();

    store.dispatch(setActiveCollectionId("fixture-ui"));
    store.dispatch(syncCabinets(["rt-a"]));
    store.dispatch(
      setAttributeValue({ attributeId: "TestGrooveFinish", target: { scope: "global" }, value: "None" }),
    );

    const snapshot = getConfigurationSnapshot(store.getState());

    store.dispatch(resetConfiguration());
    expect(getAttributeValue(store.getState(), "TestGrooveFinish", { scope: "global" })).toBeUndefined();

    store.dispatch(restoreConfigurationFragment({ values: snapshot.values, cabinets: snapshot.cabinets }));

    expect(getAttributeValue(store.getState(), "TestGrooveFinish", { scope: "global" })).toBe("None");
    expect(getCabinetEntries(store.getState()).map((entry) => entry.stableKey)).toEqual(["cab-1"]);
  });

  it("does not hand out a live reference to state", () => {
    store.dispatch(syncCabinets(["rt-a"]));
    const snapshot = getConfigurationSnapshot(store.getState());
    snapshot.cabinets[0].index = 99;

    expect(getCabinetEntries(store.getState())[0].index).toBe(0);
  });

  it("keeps the collection across a configuration reset", () => {
    store.dispatch(setActiveCollectionId("urban-standard-height"));
    store.dispatch(syncCabinets(["rt-a"]));
    store.dispatch(resetConfiguration());

    expect(getActiveCollectionId(store.getState())).toBe("urban-standard-height");
    expect(getCabinetEntries(store.getState())).toEqual([]);
  });
});

describe("single-owner invariant", () => {
  it("never stores an attribute in both the typed core and the dynamic map", () => {
    store.dispatch(resetConfiguration());
    store.dispatch(syncCabinets(["rt-a"]));
    store.dispatch(
      setAttributeValue({ attributeId: "TestGrooveFinish", target: { scope: "global" }, value: "None" }),
    );

    const core = Object.keys(store.getState().rootStateUI.product.productOptions);
    const dynamic = Object.keys(store.getState().rootStateUI.configuration.valuesByAttributeId);
    const both = core.filter((attributeId) => dynamic.includes(attributeId));

    expect(both, `attributes with two independent copies: ${both.join(", ")}`).toEqual([]);
  });
});
