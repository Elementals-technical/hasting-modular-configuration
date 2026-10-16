// @vitest-environment jsdom
import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { resetConfiguration } from "@/entities/configuration";
import { addProductId, reset } from "@/entities/product/model/store/slice";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";

import { captureSnapshot } from "../lib/captureSnapshot";
import { useDeferredHistorySnapshot } from "../lib/useDeferredHistorySnapshot";
import { clearHistory, pushSnapshot, setHistoryRestoring, undo } from "../model/store/slice";

vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));

vi.mock("@/utils/functions/playcanvas/getConfig", () => ({
  getConfig: vi.fn(async () => ({ Width: 60 })),
}));

const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
const setUp = () => renderHook(() => useDeferredHistorySnapshot(), { wrapper }).result.current;
const history = () => store.getState().rootStateUI.history;
const pastIds = () => history().past.map(({ productIds }) => productIds);

describe("useDeferredHistorySnapshot", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setHistoryRestoring(false));
    store.dispatch(clearHistory());
    vi.mocked(getConfig).mockReset();
    vi.mocked(getConfig).mockImplementation(async () => ({ Width: 60 }));
    store.dispatch(addProductId("rt-a"));
  });

  it("writes the state the edit started from when the edit is applied", async () => {
    const deferred = setUp();

    await deferred.capture("cabinet-placement");
    store.dispatch(addProductId("rt-b"));
    expect(history().past).toEqual([]);

    deferred.commit("cabinet-placement");

    expect(pastIds()).toEqual([["rt-a"]]);
  });

  it("writes one entry for one edit, however often its end is reported", async () => {
    const deferred = setUp();
    await deferred.capture("countertop");

    deferred.commit("countertop");
    deferred.commit("countertop");

    expect(history().past).toHaveLength(1);
  });

  it("writes nothing for an edit that was cancelled", async () => {
    const deferred = setUp();
    await deferred.capture("cabinet-placement");

    deferred.discard("cabinet-placement");
    deferred.commit("cabinet-placement");

    expect(history().past).toEqual([]);
  });

  it("writes nothing for an edit whose start it never saw", () => {
    const deferred = setUp();

    deferred.commit("cabinet-placement");

    expect(history().past).toEqual([]);
  });

  it("keeps the edits of two owners apart", async () => {
    const deferred = setUp();
    await deferred.capture("cabinet-placement");
    await deferred.capture("countertop");

    deferred.discard("countertop");
    deferred.commit("cabinet-placement");

    expect(history().past).toHaveLength(1);
  });

  it("drops redo when the edit is applied", async () => {
    const deferred = setUp();
    store.dispatch(pushSnapshot(await captureSnapshot(store.getState)));
    store.dispatch(undo(await captureSnapshot(store.getState)));
    expect(history().future).toHaveLength(1);

    await deferred.capture("cabinet-placement");
    deferred.commit("cabinet-placement");

    expect(history().future).toEqual([]);
  });

  it("drops its entry when the history moved on while the edit was open", async () => {
    const deferred = setUp();
    await deferred.capture("cabinet-placement");
    store.dispatch(addProductId("rt-b"));
    store.dispatch(pushSnapshot(await captureSnapshot(store.getState)));

    deferred.commit("cabinet-placement");

    expect(pastIds()).toEqual([["rt-a", "rt-b"]]);
  });

  it("reads nothing while a snapshot is being restored", async () => {
    const deferred = setUp();
    store.dispatch(setHistoryRestoring(true));

    await deferred.capture("cabinet-placement");
    store.dispatch(setHistoryRestoring(false));
    deferred.commit("cabinet-placement");

    expect(getConfig).not.toHaveBeenCalled();
    expect(history().past).toEqual([]);
  });

  it("lets a newer start of the same edit win over a slower earlier read", async () => {
    const deferred = setUp();
    let release: (config: Record<string, unknown>) => void = () => undefined;
    vi.mocked(getConfig).mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));

    const slow = deferred.capture("cabinet-placement");
    store.dispatch(addProductId("rt-b"));
    await deferred.capture("cabinet-placement");
    release({ Width: 60 });
    await slow;
    deferred.commit("cabinet-placement");

    expect(pastIds()).toEqual([["rt-a", "rt-b"]]);
  });

  it("goes on without an entry when the state cannot be read", async () => {
    const deferred = setUp();
    const failure = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(getConfig).mockRejectedValueOnce(new Error("scene gone"));

    await expect(deferred.capture("cabinet-placement")).resolves.toBeUndefined();
    deferred.commit("cabinet-placement");

    expect(history().past).toEqual([]);
    failure.mockRestore();
  });
});
