import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SceneCallResult, SceneSelector } from "@/utils/functions/playcanvas/sceneBridge";
import type { EdgeCabinets } from "@/utils/functions/playcanvas/getEdgeCabinets";

const mocks = vi.hoisted(() => ({
  edges: { leftCabinetId: null, rightCabinetId: null } as EdgeCabinets,
  applySceneConfig: vi.fn<(selector: SceneSelector, patch: Record<string, unknown>) => Promise<SceneCallResult>>(
    async () => ({ status: "applied", updatedIds: null }),
  ),
}));

vi.mock("@/utils/functions/playcanvas/sceneBridge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/functions/playcanvas/sceneBridge")>()),
  isSceneReady: () => true,
  applySceneConfig: mocks.applySceneConfig,
}));
vi.mock("@/utils/functions/playcanvas/getEdgeCabinets", () => ({ getEdgeCabinets: () => mocks.edges }));
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({ getConfig: vi.fn(async () => null) }));

import { store } from "@/app/store";
import type { ProductProfile } from "@/entities/collection";
import { tricotProfile } from "@/entities/collection/__tests__/tricotFixtures";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { reset } from "@/entities/product/model/store/slice";
import { getSidePanelLeftStatus, getSidePanelRightStatus } from "@/features/sidePanel/model/selectors";
import { rememberSidePanelSelection } from "@/utils/functions/playcanvas/sidePanels";

import { enforceSidePanelEligibility, settleSavedSideStatuses } from "../sidePanelEnforce";
import type { SidePanelStatus } from "../sidePanelService";

const SINK_BASE = "Sink-Base-aaa111";
const OPEN_SHELF = "Open-Shelf-bbb222";
const TRICOT_SINK = "Tricot-sink-cabinet-aaa111";
const TRICOT_SIDE = "Tricot-side-cabinet-bbb222";

const noSidePanelData: ProductProfile = {
  ...ushProfile,
  ruleData: { ...ushProfile.ruleData, sidePanels: undefined },
};

/** The panels the scene was sent, one [panel, side] pair per call. */
const sentPanels = () => mocks.applySceneConfig.mock.calls.map(([, patch]) => [patch.SidePanel, patch.SidePanelSide]);

beforeEach(() => {
  mocks.applySceneConfig.mockClear();
  mocks.edges = { leftCabinetId: null, rightCabinetId: null };
  store.dispatch(reset());
  rememberSidePanelSelection("None");
});

describe("settleSavedSideStatuses", () => {
  it("turns auto-removed into none on a Tricot edge, as Tricot blocks no cabinet", async () => {
    mocks.edges = { leftCabinetId: TRICOT_SINK, rightCabinetId: TRICOT_SIDE };

    expect(await settleSavedSideStatuses(tricotProfile, "active", "auto-removed")).toEqual({
      left: "active",
      right: "none",
    });
  });

  it("turns auto-removed into none on an eligible USH edge and keeps it on a blocked one", async () => {
    mocks.edges = { leftCabinetId: OPEN_SHELF, rightCabinetId: SINK_BASE };

    expect(await settleSavedSideStatuses(ushProfile, "auto-removed", "auto-removed")).toEqual({
      left: "auto-removed",
      right: "none",
    });
  });

  it.each<[SidePanelStatus, SidePanelStatus]>([
    ["active", "active"],
    ["none", "none"],
    ["active", "none"],
  ])("leaves left %s and right %s untouched", async (left, right) => {
    mocks.edges = { leftCabinetId: OPEN_SHELF, rightCabinetId: SINK_BASE };

    expect(await settleSavedSideStatuses(ushProfile, left, right)).toEqual({ left, right });
  });

  it.each([
    ["a profile without side panel data", noSidePanelData],
    ["no profile", null],
  ])("returns the statuses unchanged with %s", async (_label, profile) => {
    mocks.edges = { leftCabinetId: SINK_BASE, rightCabinetId: SINK_BASE };

    expect(await settleSavedSideStatuses(profile, "auto-removed", "active")).toEqual({
      left: "auto-removed",
      right: "active",
    });
  });
});

describe("enforceSidePanelEligibility", () => {
  it("brings the panel back on an edge that became eligible after an auto-removal", async () => {
    mocks.edges = { leftCabinetId: SINK_BASE, rightCabinetId: SINK_BASE.replace("aaa", "ccc") };

    await enforceSidePanelEligibility(store.dispatch, ushProfile, "UpperG", "active", "auto-removed", 2);

    expect(sentPanels()).toEqual([["UpperG", "right"]]);
    expect(getSidePanelRightStatus(store.getState())).toBe("active");
  });

  it("leaves a side the settled statuses marked none without a panel", async () => {
    mocks.edges = { leftCabinetId: TRICOT_SINK, rightCabinetId: TRICOT_SIDE };

    const settled = await settleSavedSideStatuses(tricotProfile, "active", "auto-removed");
    await enforceSidePanelEligibility(store.dispatch, tricotProfile, "NoG", settled.left, settled.right, 2);

    expect(sentPanels()).toEqual([]);
  });

  it("removes a panel from a blocked edge and marks it auto-removed", async () => {
    mocks.edges = { leftCabinetId: OPEN_SHELF, rightCabinetId: SINK_BASE };
    rememberSidePanelSelection("UpperG", "left");

    await enforceSidePanelEligibility(store.dispatch, ushProfile, "UpperG", "active", "none", 2);

    expect(sentPanels()).toEqual([["None", "left"]]);
    expect(getSidePanelLeftStatus(store.getState())).toBe("auto-removed");
  });
});
