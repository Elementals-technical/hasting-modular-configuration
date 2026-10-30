import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { reset } from "@/entities/product/model/store/slice";

import {
  getCabinetDimensions,
  getCabinetDimensionsByRuntimeId,
  getCabinetEntries,
  getConfigurationSnapshot,
  getDimensionsByCabinet,
} from "../store/selectors";
import { recordSceneState, resetConfiguration, syncCabinets } from "../store/slice";

const LOW = { width: 60, height: 50, depth: 46 };
const HIGH = { width: 80, height: 56, depth: 50.5 };

describe("recorded scene state", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(syncCabinets(["rt-a", "rt-b"]));
  });

  it("keeps the actual size of each of two different cabinets", () => {
    store.dispatch(
      recordSceneState({
        order: ["rt-a", "rt-b"],
        cabinets: [
          { runtimeId: "rt-a", dimensions: LOW },
          { runtimeId: "rt-b", dimensions: HIGH },
        ],
      }),
    );

    const state = store.getState();
    expect(getCabinetDimensions(state, "cab-1")).toEqual(LOW);
    expect(getCabinetDimensions(state, "cab-2")).toEqual(HIGH);
    expect(getCabinetDimensionsByRuntimeId(state, "rt-b")).toEqual(HIGH);
  });

  it("follows the scene's order while each size stays with its own cabinet", () => {
    store.dispatch(
      recordSceneState({
        order: ["countertop-1", "rt-b", "rt-a"],
        cabinets: [
          { runtimeId: "rt-a", dimensions: LOW },
          { runtimeId: "rt-b", dimensions: HIGH },
        ],
      }),
    );

    const state = store.getState();
    expect(getCabinetEntries(state)).toEqual([
      { stableKey: "cab-2", runtimeId: "rt-b", index: 0 },
      { stableKey: "cab-1", runtimeId: "rt-a", index: 1 },
    ]);
    expect(getCabinetDimensions(state, "cab-1")).toEqual(LOW);
  });

  it("ignores a product with no stable key and keeps the size of one the scene did not report", () => {
    store.dispatch(recordSceneState({ order: [], cabinets: [{ runtimeId: "rt-a", dimensions: LOW }] }));
    store.dispatch(recordSceneState({ order: [], cabinets: [{ runtimeId: "countertop-1", dimensions: HIGH }] }));

    expect(getDimensionsByCabinet(store.getState())).toEqual({ "cab-1": LOW });
  });

  it("keeps the reference of an unchanged order", () => {
    const before = getCabinetEntries(store.getState());

    store.dispatch(recordSceneState({ order: ["rt-a", "countertop-1", "rt-b"], cabinets: [] }));

    expect(getCabinetEntries(store.getState())).toBe(before);
  });

  it("keeps the reference of an unchanged size", () => {
    store.dispatch(recordSceneState({ order: [], cabinets: [{ runtimeId: "rt-a", dimensions: LOW }] }));
    const before = getDimensionsByCabinet(store.getState());

    store.dispatch(recordSceneState({ order: [], cabinets: [{ runtimeId: "rt-a", dimensions: { ...LOW } }] }));

    expect(getDimensionsByCabinet(store.getState())).toBe(before);
  });

  it("drops the size of a removed cabinet and never saves sizes in the snapshot", () => {
    store.dispatch(
      recordSceneState({
        order: [],
        cabinets: [
          { runtimeId: "rt-a", dimensions: LOW },
          { runtimeId: "rt-b", dimensions: HIGH },
        ],
      }),
    );

    store.dispatch(syncCabinets(["rt-b"]));

    expect(getDimensionsByCabinet(store.getState())).toEqual({ "cab-2": HIGH });
    expect(getConfigurationSnapshot(store.getState())).not.toHaveProperty("dimensionsByCabinet");
  });
});
