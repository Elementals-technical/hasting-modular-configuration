import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SceneCallResult, SceneSelector } from "@/utils/functions/playcanvas/sceneBridge";

const sceneMocks = vi.hoisted(() => ({
  applySceneConfig: vi.fn<(selector: SceneSelector, patch: Record<string, unknown>) => Promise<SceneCallResult>>(
    async () => ({ status: "applied", updatedIds: null }),
  ),
}));

vi.mock("@/utils/functions/playcanvas/sceneBridge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/functions/playcanvas/sceneBridge")>()),
  isSceneReady: () => true,
  applySceneConfig: sceneMocks.applySceneConfig,
}));

import { store } from "@/app/store";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { reset, setSidePanelsOption, setSidePanelSideStatus } from "@/entities/product/model/store/slice";
import {
  getSidePanelLeftStatus,
  getSidePanelRightStatus,
  getSidePanelsOption,
} from "@/features/sidePanel/model/selectors";

import { applyGrooveToActiveSides, reapplySidePanelsForPreset, restoreSidePanelState } from "../sidePanelService";

/** The panels the scene was sent, one [panel, side] pair per call. */
const sentPanels = () =>
  sceneMocks.applySceneConfig.mock.calls.map(([, patch]) => [patch.SidePanel, patch.SidePanelSide]);

describe("sidePanelService", () => {
  beforeEach(() => {
    sceneMocks.applySceneConfig.mockClear();
    store.dispatch(reset());
  });

  it("marks active sides as auto-removed when availability forces groove to None", async () => {
    store.dispatch(setSidePanelsOption("UpperG"));
    store.dispatch(setSidePanelSideStatus({ side: "left", status: "active" }));
    store.dispatch(setSidePanelSideStatus({ side: "right", status: "active" }));

    await applyGrooveToActiveSides(store.dispatch, "None", "active", "active", 2);

    expect(sentPanels()).toEqual([
      ["None", "left"],
      ["None", "right"],
    ]);

    const state = store.getState();
    expect(getSidePanelsOption(state)).toBe("None");
    expect(getSidePanelLeftStatus(state)).toBe("auto-removed");
    expect(getSidePanelRightStatus(state)).toBe("auto-removed");
  });

  it("does not convert user-removed sides when availability forces groove to None", async () => {
    store.dispatch(setSidePanelsOption("UpperG"));
    store.dispatch(setSidePanelSideStatus({ side: "left", status: "active" }));
    store.dispatch(setSidePanelSideStatus({ side: "right", status: "none" }));

    await applyGrooveToActiveSides(store.dispatch, "None", "active", "none", 2);

    expect(sentPanels()).toEqual([["None", "left"]]);

    const state = store.getState();
    expect(getSidePanelsOption(state)).toBe("None");
    expect(getSidePanelLeftStatus(state)).toBe("auto-removed");
    expect(getSidePanelRightStatus(state)).toBe("none");
  });

  it("keeps active statuses when middleware only changes the active groove type", async () => {
    store.dispatch(setSidePanelsOption("UpperG"));
    store.dispatch(setSidePanelSideStatus({ side: "left", status: "active" }));
    store.dispatch(setSidePanelSideStatus({ side: "right", status: "auto-removed" }));

    await applyGrooveToActiveSides(store.dispatch, "CenterG", "active", "auto-removed", 2);

    expect(sentPanels()).toEqual([["CenterG", "left"]]);

    const state = store.getState();
    expect(getSidePanelsOption(state)).toBe("CenterG");
    expect(getSidePanelLeftStatus(state)).toBe("active");
    expect(getSidePanelRightStatus(state)).toBe("auto-removed");
  });

  it("restores both active side panels explicitly for multi-cabinet scenes", async () => {
    await restoreSidePanelState(store.dispatch, "DoubleG", "active", "active", 3);

    expect(sentPanels()).toEqual([
      ["None", "left"],
      ["None", "right"],
      ["DoubleG", "left"],
      ["DoubleG", "right"],
    ]);
  });

  it("restores both active side panels with a single both-side call for single-cabinet scenes", async () => {
    await restoreSidePanelState(store.dispatch, "DoubleG", "active", "active", 1);

    expect(sentPanels()).toEqual([["DoubleG", "both"]]);
  });

  it("marks a preset edge Open Shelf side as auto-removed while keeping the eligible side active", async () => {
    store.dispatch(setSidePanelsOption("UpperG"));
    store.dispatch(setSidePanelSideStatus({ side: "left", status: "active" }));
    store.dispatch(setSidePanelSideStatus({ side: "right", status: "active" }));

    await reapplySidePanelsForPreset(
      store.dispatch,
      ushProfile,
      "UpperG",
      [
        { name: "Open-Shelf", Height: 56 },
        { name: "Sink-Cabinet", Height: 56, Drawers: "2D", Handle: "handle_urban_topcut" },
        { name: "Sink-Base", Height: 56, Drawers: "2D", Handle: "handle_urban_topcut" },
      ],
      3,
      ["open-shelf-left", "sink-cabinet-center", "sink-base-right"],
    );

    expect(sentPanels()).toEqual([
      ["None", "left"],
      ["None", "right"],
      ["DoubleG", "right"],
    ]);

    const state = store.getState();
    expect(getSidePanelsOption(state)).toBe("DoubleG");
    expect(getSidePanelLeftStatus(state)).toBe("auto-removed");
    expect(getSidePanelRightStatus(state)).toBe("active");
  });

  it("marks a right edge Open Shelf as auto-removed while keeping the left side active", async () => {
    store.dispatch(setSidePanelsOption("UpperG"));
    store.dispatch(setSidePanelSideStatus({ side: "left", status: "active" }));
    store.dispatch(setSidePanelSideStatus({ side: "right", status: "active" }));

    await reapplySidePanelsForPreset(
      store.dispatch,
      ushProfile,
      "UpperG",
      [
        { name: "Sink-Base", Height: 56, Drawers: "2D", Handle: "handle_urban_topcut" },
        { name: "Sink-Cabinet", Height: 56, Drawers: "2D", Handle: "handle_urban_topcut" },
        { name: "Open-Shelf", Height: 56 },
      ],
      3,
      ["sink-base-left", "sink-cabinet-center", "open-shelf-right"],
    );

    expect(sentPanels()).toEqual([
      ["None", "left"],
      ["None", "right"],
      ["DoubleG", "left"],
    ]);

    const state = store.getState();
    expect(getSidePanelsOption(state)).toBe("DoubleG");
    expect(getSidePanelLeftStatus(state)).toBe("active");
    expect(getSidePanelRightStatus(state)).toBe("auto-removed");
  });

  it("clears stale physical panels when no preset edge can receive side panels", async () => {
    store.dispatch(setSidePanelsOption("UpperG"));
    store.dispatch(setSidePanelSideStatus({ side: "left", status: "active" }));
    store.dispatch(setSidePanelSideStatus({ side: "right", status: "active" }));

    await reapplySidePanelsForPreset(
      store.dispatch,
      ushProfile,
      "UpperG",
      [
        { name: "Open-Shelf", Height: 56 },
        { name: "Sink-Base", Height: 56, Drawers: "2D", Handle: "handle_urban_topcut" },
        { name: "Side-Shelf", Height: 56 },
      ],
      3,
      ["open-shelf-left", "sink-base-center", "side-shelf-right"],
    );

    expect(sentPanels()).toEqual([
      ["None", "left"],
      ["None", "right"],
    ]);

    const state = store.getState();
    expect(getSidePanelsOption(state)).toBe("UpperG");
    expect(getSidePanelLeftStatus(state)).toBe("auto-removed");
    expect(getSidePanelRightStatus(state)).toBe("auto-removed");
  });
});

describe("sidePanelService through the command", () => {
  beforeEach(() => {
    sceneMocks.applySceneConfig.mockClear();
    store.dispatch(reset());
  });

  it("records nothing when the scene did not take the panel", async () => {
    store.dispatch(setSidePanelsOption("UpperG"));
    store.dispatch(setSidePanelSideStatus({ side: "left", status: "active" }));
    sceneMocks.applySceneConfig.mockResolvedValueOnce({
      status: "failed",
      code: "scene-rejected",
      message: "no panel",
    });

    await applyGrooveToActiveSides(store.dispatch, "CenterG", "active", "none", 2);

    expect(getSidePanelsOption(store.getState())).toBe("UpperG");
  });

  it("records the restored values with the panels when asked", async () => {
    await restoreSidePanelState(store.dispatch, "DoubleG", "active", "none", 2, {
      panels: "DoubleG",
      left: "active",
      right: "none",
    });

    const state = store.getState();
    expect(sentPanels()).toEqual([
      ["None", "left"],
      ["None", "right"],
      ["DoubleG", "left"],
    ]);
    expect(getSidePanelsOption(state)).toBe("DoubleG");
    expect(getSidePanelLeftStatus(state)).toBe("active");
    expect(getSidePanelRightStatus(state)).toBe("none");
  });
});
