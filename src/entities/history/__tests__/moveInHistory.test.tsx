// @vitest-environment jsdom
import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { resetConfiguration } from "@/entities/configuration";
import { addProductId, reset, setCabinetColor } from "@/entities/product/model/store/slice";
import { createTestSceneRestorer } from "@/features/playCanvasAdapter/lib/testSceneRestorer";

import { moveInHistory, type HistoryDirection } from "../lib/moveInHistory";
import { useHistoryStep } from "../lib/useHistoryStep";
import { clearHistory, setHistoryBlocked, setHistoryRestoring, type SceneSnapshot } from "../model/store/slice";

vi.mock("@/features/sidePanel", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/sidePanel")>()),
  restoreSidePanelState: vi.fn(async () => undefined),
}));

vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));

vi.mock("@/utils/functions/playcanvas/getConfig", () => ({
  getConfig: vi.fn(async () => ({ Width: 60 })),
}));

const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
const history = () => store.getState().rootStateUI.history;
const cabinetColor = () => store.getState().rootStateUI.product.productOptions.CabinetColor;
const colorsOf = (snapshots: readonly SceneSnapshot[]) =>
  snapshots.map(({ productOptions }) => productOptions.CabinetColor);

const move = (direction: HistoryDirection) =>
  moveInHistory(direction, {
    dispatch: store.dispatch,
    getState: () => store.getState(),
    getBindings: () => null,
    restorer: createTestSceneRestorer().restorer,
    replay: async () => ({ status: "applied" }),
    beforeRebuild: () => undefined,
  });

/** A colour the scene takes at once, as one step. */
const pickColor = (color: string) =>
  renderHook(() => useHistoryStep(), { wrapper }).result.current.run(async () => {
    store.dispatch(setCabinetColor(color));
    return { status: "applied" };
  });

/** A colour step that has recorded its value and still waits for the scene until `finish`. */
const startColorStep = async (color: string) => {
  let release: () => void = () => undefined;
  const running = renderHook(() => useHistoryStep(), { wrapper }).result.current.run(async () => {
    store.dispatch(setCabinetColor(color));
    await new Promise<void>((resolve) => (release = resolve));
    return { status: "applied" };
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  return { running, finish: () => release() };
};

describe("undo and redo in the order of the actions", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setHistoryRestoring(false));
    store.dispatch(setHistoryBlocked(false));
    store.dispatch(clearHistory());
    store.dispatch(addProductId("rt-a"));
    store.dispatch(setCabinetColor("Rox Black TKQ"));
  });

  it("takes back the action that was still running when undo was asked for", async () => {
    await pickColor("Castagno chiaro 1C1");
    const step = await startColorStep("Cemento Cenere 1A1");

    const undone = move("undo");
    step.finish();
    await Promise.all([step.running, undone]);

    expect(cabinetColor()).toBe("Castagno chiaro 1C1");
    expect(colorsOf(history().past)).toEqual(["Rox Black TKQ"]);
    expect(colorsOf(history().future)).toEqual(["Cemento Cenere 1A1"]);
  });

  it("redoes nothing once an action started before it has dropped redo", async () => {
    await pickColor("Castagno chiaro 1C1");
    await move("undo");
    const step = await startColorStep("Cemento Cenere 1A1");

    const redone = move("redo");
    step.finish();
    await Promise.all([step.running, redone]);

    expect(await redone).toBe(false);
    expect(cabinetColor()).toBe("Cemento Cenere 1A1");
    expect(colorsOf(history().past)).toEqual(["Rox Black TKQ"]);
    expect(history().future).toEqual([]);
  });
});
