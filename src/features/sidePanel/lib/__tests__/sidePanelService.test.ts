import { beforeEach, describe, expect, it, vi } from "vitest";

const sidePanelMocks = vi.hoisted(() => ({
  setSidePanel: vi.fn<(type: string, side: "left" | "right" | "both", cabinetCount?: number) => Promise<void>>(),
}));

vi.mock("@/utils/functions/playcanvas/sidePanels", () => ({
  setSidePanel: sidePanelMocks.setSidePanel,
}));

import { store } from "@/app/store";
import { reset, setSidePanelsOption, setSidePanelSideStatus } from "@/entities/product/model/store/slice";
import {
  getSidePanelLeftStatus,
  getSidePanelRightStatus,
  getSidePanelsOption,
} from "@/features/sidePanel/model/selectors";

import { applyGrooveToActiveSides, reapplySidePanelsForPreset, restoreSidePanelState } from "../sidePanelService";

describe("sidePanelService", () => {
  beforeEach(() => {
    sidePanelMocks.setSidePanel.mockReset();
    sidePanelMocks.setSidePanel.mockResolvedValue(undefined);
    store.dispatch(reset());
  });

  it("marks active sides as auto-removed when availability forces groove to None", async () => {
    store.dispatch(setSidePanelsOption("UpperG"));
    store.dispatch(setSidePanelSideStatus({ side: "left", status: "active" }));
    store.dispatch(setSidePanelSideStatus({ side: "right", status: "active" }));

    await applyGrooveToActiveSides(store.dispatch, "None", "active", "active", 2);

    expect(sidePanelMocks.setSidePanel).toHaveBeenCalledTimes(2);
    expect(sidePanelMocks.setSidePanel).toHaveBeenNthCalledWith(1, "None", "left", 2);
    expect(sidePanelMocks.setSidePanel).toHaveBeenNthCalledWith(2, "None", "right", 2);

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

    expect(sidePanelMocks.setSidePanel).toHaveBeenCalledTimes(1);
    expect(sidePanelMocks.setSidePanel).toHaveBeenCalledWith("None", "left", 2);

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

    expect(sidePanelMocks.setSidePanel).toHaveBeenCalledTimes(1);
    expect(sidePanelMocks.setSidePanel).toHaveBeenCalledWith("CenterG", "left", 2);

    const state = store.getState();
    expect(getSidePanelsOption(state)).toBe("CenterG");
    expect(getSidePanelLeftStatus(state)).toBe("active");
    expect(getSidePanelRightStatus(state)).toBe("auto-removed");
  });

  it("restores both active side panels explicitly for multi-cabinet scenes", async () => {
    await restoreSidePanelState("DoubleG", "active", "active", 3);

    expect(sidePanelMocks.setSidePanel).toHaveBeenCalledTimes(3);
    expect(sidePanelMocks.setSidePanel).toHaveBeenNthCalledWith(1, "None", "both", 3);
    expect(sidePanelMocks.setSidePanel).toHaveBeenNthCalledWith(2, "DoubleG", "left", 3);
    expect(sidePanelMocks.setSidePanel).toHaveBeenNthCalledWith(3, "DoubleG", "right", 3);
  });

  it("restores both active side panels with a single both-side call for single-cabinet scenes", async () => {
    await restoreSidePanelState("DoubleG", "active", "active", 1);

    expect(sidePanelMocks.setSidePanel).toHaveBeenCalledTimes(1);
    expect(sidePanelMocks.setSidePanel).toHaveBeenCalledWith("DoubleG", "both", 1);
  });

  it("marks a preset edge Open Shelf side as auto-removed while keeping the eligible side active", async () => {
    store.dispatch(setSidePanelsOption("UpperG"));
    store.dispatch(setSidePanelSideStatus({ side: "left", status: "active" }));
    store.dispatch(setSidePanelSideStatus({ side: "right", status: "active" }));

    await reapplySidePanelsForPreset(
      store.dispatch,
      "UpperG",
      [
        { name: "Open-Shelf", Height: 56 },
        { name: "Sink-Cabinet", Height: 56, Drawers: "2D", Handle: "handle_urban_topcut" },
        { name: "Sink-Base", Height: 56, Drawers: "2D", Handle: "handle_urban_topcut" },
      ],
      3,
      ["open-shelf-left", "sink-cabinet-center", "sink-base-right"],
    );

    expect(sidePanelMocks.setSidePanel).toHaveBeenCalledTimes(2);
    expect(sidePanelMocks.setSidePanel).toHaveBeenNthCalledWith(1, "None", "both", 3);
    expect(sidePanelMocks.setSidePanel).toHaveBeenNthCalledWith(2, "DoubleG", "right", 3);

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
      "UpperG",
      [
        { name: "Sink-Base", Height: 56, Drawers: "2D", Handle: "handle_urban_topcut" },
        { name: "Sink-Cabinet", Height: 56, Drawers: "2D", Handle: "handle_urban_topcut" },
        { name: "Open-Shelf", Height: 56 },
      ],
      3,
      ["sink-base-left", "sink-cabinet-center", "open-shelf-right"],
    );

    expect(sidePanelMocks.setSidePanel).toHaveBeenCalledTimes(2);
    expect(sidePanelMocks.setSidePanel).toHaveBeenNthCalledWith(1, "None", "both", 3);
    expect(sidePanelMocks.setSidePanel).toHaveBeenNthCalledWith(2, "DoubleG", "left", 3);

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
      "UpperG",
      [
        { name: "Open-Shelf", Height: 56 },
        { name: "Sink-Base", Height: 56, Drawers: "2D", Handle: "handle_urban_topcut" },
        { name: "Side-Shelf", Height: 56 },
      ],
      3,
      ["open-shelf-left", "sink-base-center", "side-shelf-right"],
    );

    expect(sidePanelMocks.setSidePanel).toHaveBeenCalledTimes(1);
    expect(sidePanelMocks.setSidePanel).toHaveBeenCalledWith("None", "both", 3);

    const state = store.getState();
    expect(getSidePanelsOption(state)).toBe("UpperG");
    expect(getSidePanelLeftStatus(state)).toBe("auto-removed");
    expect(getSidePanelRightStatus(state)).toBe("auto-removed");
  });
});
