// @vitest-environment jsdom
import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { resetConfiguration } from "@/entities/configuration";
import { addProductId, reset, setCabinetColor } from "@/entities/product/model/store/slice";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";

import { captureSnapshot } from "../lib/captureSnapshot";
import { isApplied, useHistoryStep } from "../lib/useHistoryStep";
import { clearHistory, pushSnapshot, setHistoryBlocked, setHistoryRestoring, undo } from "../model/store/slice";

vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));

vi.mock("@/utils/functions/playcanvas/getConfig", () => ({
  getConfig: vi.fn(async () => ({ Width: 60 })),
}));

const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
const setUp = () => renderHook(() => useHistoryStep(), { wrapper }).result.current;
const history = () => store.getState().rootStateUI.history;
const cabinetColor = () => store.getState().rootStateUI.product.productOptions.CabinetColor;

/** An action that records a cabinet colour, as a command does once the scene took it. */
const recordColor = (color: string) => async () => {
  store.dispatch(setCabinetColor(color));
  return { status: "applied" };
};

describe("useHistoryStep", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setHistoryRestoring(false));
    store.dispatch(setHistoryBlocked(false));
    store.dispatch(clearHistory());
    store.dispatch(addProductId("rt-a"));
    store.dispatch(setCabinetColor("Rox Black TKQ"));
  });

  /** One entry to undo and one to redo, as after an undo. */
  const withRedo = async () => {
    store.dispatch(pushSnapshot(await captureSnapshot(store.getState)));
    store.dispatch(undo(await captureSnapshot(store.getState)));
    expect(history().future).toHaveLength(1);
  };

  it("writes the state an action started from once the action changed the configuration, and drops redo", async () => {
    await withRedo();
    const step = setUp();

    await step.run(recordColor("Castagno chiaro 1C1"));

    expect(history().past).toHaveLength(1);
    expect(history().past[0].productOptions.CabinetColor).toBe("Rox Black TKQ");
    expect(history().future).toEqual([]);
  });

  it("writes nothing for an action that changed nothing, as a pick of the value already chosen, and keeps redo", async () => {
    await withRedo();
    const step = setUp();

    await step.run(recordColor("Rox Black TKQ"));
    await step.run(async () => ({ status: "blocked" }));

    expect(history().past).toEqual([]);
    expect(history().future).toHaveLength(1);
  });

  it("counts a result as a change when the action says its effect reaches the store later", async () => {
    const step = setUp();

    await step.run(async () => ({ status: "applied" }), isApplied);
    await step.run(async () => ({ status: "error" }), isApplied);

    expect(history().past).toHaveLength(1);
  });

  it("keeps what an action changed before it failed undoable, and passes the failure on", async () => {
    const step = setUp();

    await expect(
      step.run(async () => {
        throw new Error("scene gone");
      }),
    ).rejects.toThrow("scene gone");
    expect(history().past).toEqual([]);

    await expect(
      step.run(async () => {
        store.dispatch(setCabinetColor("Castagno chiaro 1C1"));
        throw new Error("scene gone");
      }),
    ).rejects.toThrow("scene gone");
    expect(history().past).toHaveLength(1);
    expect(cabinetColor()).toBe("Castagno chiaro 1C1");
  });

  it("runs an action started while another is still open after it, as a step of its own", async () => {
    const first = setUp();
    const second = setUp();
    const applied: string[] = [];
    const pick = (color: string) => async () => {
      applied.push(color);
      return recordColor(color)();
    };
    // The first action is still reading its starting state from the scene.
    let release: () => void = () => undefined;
    vi.mocked(getConfig).mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve({ Width: 60 }))),
    );

    const runningFirst = first.run(pick("Castagno chiaro 1C1"));
    const runningSecond = second.run(pick("Cemento Cenere 1A1"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    await Promise.all([runningFirst, runningSecond]);

    expect(applied).toEqual(["Castagno chiaro 1C1", "Cemento Cenere 1A1"]);
    expect(cabinetColor()).toBe("Cemento Cenere 1A1");
    expect(history().past.map(({ productOptions }) => productOptions.CabinetColor)).toEqual([
      "Rox Black TKQ",
      "Castagno chiaro 1C1",
    ]);
  });

  it("runs an action started during a restore only once the restore is over, as its own step", async () => {
    await withRedo();
    store.dispatch(setHistoryRestoring(true));
    const step = setUp();
    const pickColor = vi.fn(recordColor("Castagno chiaro 1C1"));

    const running = step.run(pickColor);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The restore still owns the scene and the state: the colour is not picked yet.
    expect(pickColor).not.toHaveBeenCalled();
    expect(cabinetColor()).toBe("Rox Black TKQ");

    store.dispatch(setHistoryRestoring(false));
    await running;

    expect(pickColor).toHaveBeenCalledOnce();
    expect(cabinetColor()).toBe("Castagno chiaro 1C1");
    expect(history().past).toHaveLength(1);
    expect(history().past[0].productOptions.CabinetColor).toBe("Rox Black TKQ");
    expect(history().future).toEqual([]);
  });
});
