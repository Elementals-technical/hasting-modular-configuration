// @vitest-environment jsdom
import type { ReactNode } from "react";
import { renderHook, cleanup } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { store } from "@/app/store";
import { resetConfiguration } from "@/entities/configuration";
import { addProductId, reset, setActiveProfile } from "@/entities/product/model/store/slice";
import { applyGroove } from "@/features/sidePanel";
import { createTestSceneRestorer } from "@/features/playCanvasAdapter/lib/testSceneRestorer";
import { LAME } from "@/shared/lib/pricing/__tests__/fixtures/collectionPricingScenarios";
import { moveInHistory } from "../lib/moveInHistory";
import { useHistoryStep } from "../lib/useHistoryStep";
import { clearHistory, setHistoryBlocked, setHistoryRestoring } from "../model/store/slice";

const scene = vi.hoisted(() => ({ applySceneConfig: vi.fn(async () => ({ status: "applied", updatedIds: null })) }));
vi.mock("@/utils/functions/playcanvas/sceneBridge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/functions/playcanvas/sceneBridge")>()),
  isSceneReady: () => true,
  applySceneConfig: scene.applySceneConfig,
}));
vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({
  getConfig: vi.fn(async () => ({ productType: "Lame-sink-cabinet", Width: 60, Height: 26, Depth: 52, Drawers: "1D" })),
}));

const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
const options = () => {
  const { SidePanels, SidePanelLeft, SidePanelRight } = store.getState().rootStateUI.product.productOptions;
  return [SidePanels, SidePanelLeft, SidePanelRight];
};
const move = (direction: "undo" | "redo") =>
  moveInHistory(direction, {
    dispatch: store.dispatch,
    getState: store.getState,
    getBindings: () => null,
    restorer: createTestSceneRestorer().restorer,
    replay: async () => ({ status: "applied" }),
    beforeRebuild: () => undefined,
  });

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(LAME.profile));
  store.dispatch(setHistoryRestoring(false));
  store.dispatch(setHistoryBlocked(false));
  store.dispatch(clearHistory());
  store.dispatch(addProductId("Lame-sink-cabinet-one"));
  scene.applySceneConfig.mockClear();
});
afterEach(cleanup);

it("restores Lamè panel-off/on through real history and replays the side-panel scene command", async () => {
  const step = renderHook(() => useHistoryStep(), { wrapper }).result.current;
  await step.run(() => applyGroove(store.dispatch, "NoG", "both", 1));
  expect(options()).toEqual(["NoG", "active", "active"]);
  expect(store.getState().rootStateUI.history.past).toHaveLength(1);
  await move("undo");
  expect(options().slice(1)).toEqual(["none", "none"]);
  await move("redo");
  expect(options()).toEqual(["NoG", "active", "active"]);
  expect(scene.applySceneConfig).toHaveBeenLastCalledWith({}, { SidePanel: "NoG", SidePanelSide: "both" });
  await step.run(() => applyGroove(store.dispatch, "None", "both", 1));
  expect(options()).toEqual(["None", "none", "none"]);
  await move("undo");
  expect(options()).toEqual(["NoG", "active", "active"]);
});
