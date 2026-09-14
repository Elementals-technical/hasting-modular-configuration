import { configureStore, createListenerMiddleware } from "@reduxjs/toolkit";
import { describe, expect, it, vi } from "vitest";

import { rootReducer } from "@/app/store/reducer";
import {
  getCabinetDimensions,
  getCabinetEntries,
  getDimensionsByCabinet,
} from "@/entities/configuration/model/store/selectors";
import { restoreCabinets, syncCabinets } from "@/entities/configuration/model/store/slice";
import {
  setSelectedProductConfig,
  swapProductIds,
  syncSelectedDimensionsFromScene,
} from "@/entities/product/model/store/slice";
import { createTestSceneReader } from "@/features/playCanvasAdapter/lib/testSceneReader";

import { isSceneStateTrigger, setupSceneStateListener } from "../lib/sceneStateSync";

const LOW = { width: 60, height: 50, depth: 46 };
const HIGH = { width: 80, height: 56, depth: 50.5 };

const setUp = (settleMs = 0) => {
  const scene = createTestSceneReader();
  const listener = createListenerMiddleware();
  setupSceneStateListener(listener.startListening, { reader: scene.reader, settleMs });

  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }).prepend(listener.middleware),
  });

  return { scene, store };
};

describe("isSceneStateTrigger", () => {
  it("matches the actions after which the scene's sizes or order may differ", () => {
    expect(isSceneStateTrigger(swapProductIds({ idA: "rt-a", idB: "rt-b" }))).toBe(true);
    expect(isSceneStateTrigger(syncSelectedDimensionsFromScene({ width: 80 }))).toBe(true);
    expect(isSceneStateTrigger(setSelectedProductConfig(null))).toBe(false);
    expect(isSceneStateTrigger(syncCabinets(["rt-a"]))).toBe(false);
  });
});

describe("scene state sync", () => {
  it("records the actual size of each cabinet after restore, without one borrowing another's", async () => {
    const { scene, store } = setUp();
    scene.setScene(["rt-a", "rt-b"], { "rt-a": LOW, "rt-b": HIGH });

    store.dispatch(restoreCabinets({ stableKeys: ["cab-1", "cab-2"], runtimeIds: ["rt-a", "rt-b"] }));

    await vi.waitFor(() => expect(getCabinetDimensions(store.getState(), "cab-2")).toEqual(HIGH));
    expect(getCabinetDimensions(store.getState(), "cab-1")).toEqual(LOW);
    expect(scene.calls).toEqual([["rt-a", "rt-b"]]);
  });

  it("records a swapped order and a resize reported by the scene", async () => {
    const { scene, store } = setUp();
    scene.setScene(["rt-a", "rt-b"], { "rt-a": LOW, "rt-b": HIGH });
    store.dispatch(restoreCabinets({ stableKeys: ["cab-1", "cab-2"], runtimeIds: ["rt-a", "rt-b"] }));
    await vi.waitFor(() => expect(scene.calls).toHaveLength(1));

    scene.setScene(["rt-b", "rt-a"], { "rt-a": { ...LOW, width: 70 }, "rt-b": HIGH });
    store.dispatch(syncSelectedDimensionsFromScene({ width: 70 }));

    await vi.waitFor(() => expect(getCabinetDimensions(store.getState(), "cab-1")?.width).toBe(70));
    expect(getCabinetEntries(store.getState()).map(({ runtimeId }) => runtimeId)).toEqual(["rt-b", "rt-a"]);
    expect(getCabinetDimensions(store.getState(), "cab-2")).toEqual(HIGH);
  });

  it("reads once after a burst of events", async () => {
    const { scene, store } = setUp(20);
    scene.setScene(["rt-a"], { "rt-a": LOW });
    store.dispatch(syncCabinets(["rt-a"]));

    store.dispatch(syncSelectedDimensionsFromScene({ width: 60 }));
    store.dispatch(syncSelectedDimensionsFromScene({ height: 50 }));
    store.dispatch(syncSelectedDimensionsFromScene({ depth: 46 }));

    await vi.waitFor(() => expect(getCabinetDimensions(store.getState(), "cab-1")).toEqual(LOW));
    expect(scene.calls).toHaveLength(1);
  });

  it("keeps what it recorded while the scene is not ready", async () => {
    const { scene, store } = setUp();
    scene.setReady(false);
    store.dispatch(syncCabinets(["rt-a"]));

    store.dispatch(syncSelectedDimensionsFromScene({ width: 60 }));

    await vi.waitFor(() => expect(scene.calls).toHaveLength(1));
    expect(getDimensionsByCabinet(store.getState())).toEqual({});
  });

  it("does not read while no cabinet is placed", async () => {
    const { scene, store } = setUp();

    store.dispatch(syncSelectedDimensionsFromScene({ width: 60 }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(scene.calls).toEqual([]);
  });
});
