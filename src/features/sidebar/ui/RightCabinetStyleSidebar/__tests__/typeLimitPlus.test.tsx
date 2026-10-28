// @vitest-environment jsdom
import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ulhManifest from "../../../../../../public/collections/urban-low-height/manifest.json";
import ulhPresets from "../../../../../../public/collections/urban-low-height/presets.json";
import ulhProfileDocument from "../../../../../../public/collections/urban-low-height/product-profile.json";
import ulhUi from "../../../../../../public/collections/urban-low-height/ui.json";
import { store } from "@/app/store";
import { parseProductProfile } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import cabinetTable580 from "@/entities/collection/__tests__/fixtures/remote/datatable-580.json";
import { ulhRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import {
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  syncCabinets,
} from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  recordComposition,
  replaceCollectionData,
  reset,
  setActiveCabinetType,
  setDrawerProduct,
  setSelectedDimensions,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { renderWithUshCollection } from "@/features/collectionCustomization/__tests__/testUtils/renderWithUshCollection";
import type { TestCompositionPort } from "@/features/playCanvasAdapter";
import { getPlacementButtonsVisible } from "@/features/sidebar/model/store/selectors";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";
import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";
import type { ScenePlusKind, SceneSupportGroups } from "@/utils/functions/playcanvas/sceneBridge";
import { setVisibleButtons } from "@/utils/functions/playcanvas/setVisibleButtons";

import { RightCabinetStyleSidebar } from "../RightCabinetStyleSidebar";

/**
 * A vanity takes two Sink Bases. With two standing, the style sidebar for one more shows no "+" and no
 * Drag to Place, and a "+" clicked all the same adds nothing and says why. With one standing, its "+"
 * adds the second.
 */

type PlusClick = (entityId: string, side: ScenePlusKind) => void | Promise<void>;

const scene = vi.hoisted(() => ({
  composition: null as TestCompositionPort | null,
  click: null as PlusClick | null,
  groups: null as SceneSupportGroups | null,
  refusals: [] as unknown[],
  placed: [] as string[],
}));

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => true }));
vi.mock("@/utils/functions/playcanvas/setHandleButtonClick", () => ({
  setHandleButtonClick: (callback: PlusClick) => {
    scene.click = callback;
  },
}));
vi.mock("@/utils/functions/playcanvas/setVisibleButtons", () => ({ setVisibleButtons: vi.fn() }));
vi.mock("@/utils/functions/playcanvas/emptyButton", () => ({ showEmptyButton: vi.fn(), hideEmptyButton: vi.fn() }));
vi.mock("@/utils/functions/playcanvas/sceneBridge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/functions/playcanvas/sceneBridge")>()),
  readSceneSupportGroups: () => scene.groups,
  setScenePlusFilter: () => true,
}));
vi.mock("@/features/sceneRefusalNotice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/sceneRefusalNotice")>()),
  reportAddRefusal: (reason: unknown) => {
    scene.refusals.push(reason);
  },
}));
vi.mock("@/features/configurator-rule-core/countertop/hooks/useMaxCountertopLength", () => ({
  useMaxCountertopLength: () => 270,
}));
vi.mock("@/entities/history/lib/useHistoryStep", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/entities/history/lib/useHistoryStep")>()),
  useHistoryStep: () => ({ run: <T,>(change: () => Promise<T>) => change() }),
}));
vi.mock("@/features/playCanvasAdapter", async (importOriginal) => {
  const adapter = await importOriginal<typeof import("@/features/playCanvasAdapter")>();
  return {
    ...adapter,
    createCompositionPort: () => (scene.composition ??= adapter.createTestCompositionPort(scene.placed)).port,
  };
});

const parsedUlhProfile = parseProductProfile(ulhProfileDocument);
if (!parsedUlhProfile.ok) throw new Error("Urban Low Height profile must parse");
const ulhProfile = parsedUlhProfile.profile;
const ulhCatalog = buildCabinetCatalogFromMatrix(cabinetTable580 as ProductDatatable, ulhProfile, ulhRuntimeBindings);

const SIDE_CABINET = "ULH-side-cabinet-c3";

/** `sinkBases` Sink Bases and a Side Cabinet, 60 cm each, under the countertop; another Sink Base is being added. */
const standing = (sinkBases: number) => {
  scene.placed = [...Array.from({ length: sinkBases }, (_, index) => `ULH-sink-cabinet-s${index + 1}`), SIDE_CABINET];
  scene.groups = {
    layout: "rows",
    countertopGroupId: "group-1",
    cabinets: scene.placed.map((id) => ({ id, supportGroupId: "group-1", widthCm: 60 })),
    sidePanelsByGroup: {},
  };
  store.dispatch(recordComposition({ productIds: scene.placed }));
  store.dispatch(syncCabinets(scene.placed));
  store.dispatch(setActiveCabinetType("Sink-Base"));
  store.dispatch(setDrawerProduct("Sink-Base"));
  store.dispatch(setSelectedProductConfig({ Handle: "handle_urban_topcut", Drawers: "1" }));
  store.dispatch(setSelectedDimensions({ width: 60, depth: 46, height: 38 }));
  store.dispatch(setOpenStyleSidebar(true));
  act(() =>
    setCountertopRuntimeState({
      readiness: "ready",
      productId: "Top_Solid-1",
      compositionId: "c-1",
      autoLength: (sinkBases + 1) * 0.6,
    }),
  );
};

const renderUlhSidebar = () =>
  renderWithUshCollection(<RightCabinetStyleSidebar />, {
    initialPath: "/?collectionId=urban-low-height",
    data: buildReadyCollection("urban-low-height", ulhManifest, ulhUi, ulhPresets),
  });

/** Whether the scene was last told to show the "+". */
const showsPlus = () => vi.mocked(setVisibleButtons).mock.calls.at(-1)?.[0];

const added = () => (scene.composition?.calls ?? []).filter((call) => call.op === "add");

const clickPlus = async () => {
  await waitFor(() => expect(scene.click).not.toBeNull());
  await act(async () => {
    await scene.click?.(SIDE_CABINET, "right");
  });
};

beforeEach(() => {
  scene.composition = null;
  scene.click = null;
  scene.refusals = [];
  vi.mocked(setVisibleButtons).mockClear();

  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(replaceCollectionData({ profile: ulhProfile, cabinetCatalog: ulhCatalog }));
  store.dispatch(setActiveCollectionId("urban-low-height"));
  store.dispatch(setActiveRuntimeBindings(ulhRuntimeBindings));
});

afterEach(() => {
  cleanup();
  act(() => setCountertopRuntimeState(null));
});

describe("the style sidebar's + for a Sink Base", () => {
  it("adds the second one", async () => {
    standing(1);
    renderUlhSidebar();

    await waitFor(() => expect(showsPlus()).toBe(true));
    expect(getPlacementButtonsVisible(store.getState())).toBe(true);
    await clickPlus();

    expect(added()).toHaveLength(1);
    expect(scene.refusals).toEqual([]);
  });

  it("is not shown beside two, and neither is Drag to Place", async () => {
    standing(2);
    renderUlhSidebar();

    await waitFor(() => expect(scene.click).not.toBeNull());
    expect(showsPlus()).toBe(false);
    expect(getPlacementButtonsVisible(store.getState())).toBe(false);
  });

  it("adds no third one when clicked all the same, and says why", async () => {
    standing(2);
    renderUlhSidebar();

    await clickPlus();

    expect(added()).toEqual([]);
    expect(scene.refusals).toEqual([
      { code: "cabinet.sinkBaseLimit", text: "Vanity configurations allow a maximum of two Sink Base units." },
    ]);
  });
});
