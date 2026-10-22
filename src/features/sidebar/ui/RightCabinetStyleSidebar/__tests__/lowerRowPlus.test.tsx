// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
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
import type { TestCompositionPort, TestRuntimePort } from "@/features/playCanvasAdapter";
import { getPlacementButtonsVisible } from "@/features/sidebar/model/store/selectors";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";
import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";
import type { ScenePlus, ScenePlusKind, SceneSupportGroups } from "@/utils/functions/playcanvas/sceneBridge";

import { RightCabinetStyleSidebar } from "../RightCabinetStyleSidebar";

/**
 * The client's Urban Low Height Multi-Level composition (22.10): the countertop row is 265 cm of a
 * 270 cm maximum, the lower row 165 cm. The "+" of the lower row adds a cabinet there, as wide as that
 * row has room for; the "+" of the countertop's row is refused with the reason, and so is a Sink Base
 * anywhere but the countertop's row. Drag to Place stays with the countertop's row, which has no room.
 */

const UPPER = ["ULH-sink-cabinet-a1", "ULH-side-cabinet-b2", "ULH-side-cabinet-c3", "ULH-side-cabinet-d4"];
const LOWER = ["ULH-side-cabinet-f6", "ULH-side-cabinet-g7", "ULH-side-cabinet-h8"];

type PlusClick = (entityId: string, side: ScenePlusKind) => void | Promise<void>;

const scene = vi.hoisted(() => ({
  runtime: null as TestRuntimePort | null,
  composition: null as TestCompositionPort | null,
  click: null as PlusClick | null,
  filter: null as ((plus: ScenePlus) => boolean) | null,
  groups: null as SceneSupportGroups | null,
  refusals: [] as unknown[],
  placed: [
    "ULH-sink-cabinet-a1",
    "ULH-side-cabinet-b2",
    "ULH-side-cabinet-c3",
    "ULH-side-cabinet-d4",
    "ULH-side-cabinet-f6",
    "ULH-side-cabinet-g7",
    "ULH-side-cabinet-h8",
  ],
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
  setScenePlusFilter: (filter: ((plus: ScenePlus) => boolean) | null) => {
    scene.filter = filter;
    return true;
  },
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
    createPlayCanvasRuntimePort: () => (scene.runtime ??= adapter.createTestRuntimePort()).port,
    createCompositionPort: () => (scene.composition ??= adapter.createTestCompositionPort(scene.placed)).port,
  };
});

const parsedUlhProfile = parseProductProfile(ulhProfileDocument);
if (!parsedUlhProfile.ok) throw new Error("Urban Low Height profile must parse");
const ulhProfile = parsedUlhProfile.profile;
const ulhCatalog = buildCabinetCatalogFromMatrix(cabinetTable580 as ProductDatatable, ulhProfile, ulhRuntimeBindings);

const widthsOf = (ids: string[], widths: number[]) => ids.map((id, index) => [id, widths[index] ?? 0] as const);

/** Upper 120 + 25 + 60 + 60 = 265 cm under the countertop; lower 25 + 70 + 70 = 165 cm in a row of its own. */
const clientGroups = (): SceneSupportGroups => ({
  layout: "rows",
  countertopGroupId: "group-1",
  cabinets: [
    ...widthsOf(UPPER, [120, 25, 60, 60]).map(([id, widthCm]) => ({ id, supportGroupId: "group-1", widthCm })),
    ...widthsOf(LOWER, [25, 70, 70]).map(([id, widthCm]) => ({ id, supportGroupId: "layout-lower", widthCm })),
  ],
  sidePanelsByGroup: {},
});

const plus = (cabinetId: string, kind: ScenePlusKind = "right"): ScenePlus => ({
  id: `${kind}:${cabinetId}`,
  kind,
  cabinetId,
});

const renderUlhSidebar = () =>
  renderWithUshCollection(<RightCabinetStyleSidebar />, {
    initialPath: "/?collectionId=urban-low-height",
    data: buildReadyCollection("urban-low-height", ulhManifest, ulhUi, ulhPresets),
  });

const widthMenuOptions = () => {
  const title = screen.getByText("Width", { selector: "div" });
  fireEvent.click(within(title.parentElement as HTMLElement).getByRole("button"));
  return within(screen.getByRole("listbox", { name: "Width" }))
    .getAllByRole("option")
    .map((option) => option.textContent);
};

const addedWidths = () =>
  (scene.composition?.calls ?? []).flatMap((call) => (call.op === "add" ? [call.product.config.Width] : []));

const clickPlus = async (cabinetId: string, kind: ScenePlusKind = "right") => {
  await waitFor(() => expect(scene.click).not.toBeNull());
  await act(async () => {
    await scene.click?.(cabinetId, kind);
  });
};

const addingCabinet = (cabinetType: string, width: number) => {
  store.dispatch(setActiveCabinetType(cabinetType));
  store.dispatch(setDrawerProduct(cabinetType));
  store.dispatch(setSelectedProductConfig({ Handle: "handle_urban_topcut", Drawers: "1" }));
  store.dispatch(setSelectedDimensions({ width, depth: 46, height: 38 }));
};

beforeEach(() => {
  scene.runtime = null;
  scene.composition = null;
  scene.click = null;
  scene.filter = null;
  scene.groups = clientGroups();
  scene.refusals = [];

  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(replaceCollectionData({ profile: ulhProfile, cabinetCatalog: ulhCatalog }));
  store.dispatch(setActiveCollectionId("urban-low-height"));
  store.dispatch(setActiveRuntimeBindings(ulhRuntimeBindings));
  store.dispatch(recordComposition({ productIds: [...UPPER, ...LOWER] }));
  store.dispatch(syncCabinets([...UPPER, ...LOWER]));
  addingCabinet("Side-Cabinet", 120);
  store.dispatch(setOpenStyleSidebar(true));
  act(() =>
    setCountertopRuntimeState({ readiness: "ready", productId: "Top_Solid-1", compositionId: "c-1", autoLength: 2.65 }),
  );
});

afterEach(() => {
  cleanup();
  act(() => setCountertopRuntimeState(null));
});

describe("the style sidebar's + with the countertop row full", () => {
  it("offers the widths the lower row has room for, and shows only the lower row's +", async () => {
    renderUlhSidebar();

    expect(widthMenuOptions()).toEqual(['9.8"', '13.8"', '19.7"', '23.6"', '27.6"', '31.5"', '35.4"', '41.3"']);
    await waitFor(() => expect(scene.filter).not.toBeNull());
    expect(scene.filter?.(plus("ULH-side-cabinet-h8"))).toBe(true);
    expect(scene.filter?.(plus("ULH-side-cabinet-f6", "left"))).toBe(true);
    expect(scene.filter?.(plus("ULH-side-cabinet-d4"))).toBe(false);
    expect(scene.filter?.(plus("ULH-sink-cabinet-a1", "left"))).toBe(false);
  });

  it("does not offer Drag to Place, which keeps to the countertop's row", async () => {
    renderUlhSidebar();

    await waitFor(() => expect(scene.filter).not.toBeNull());
    expect(getPlacementButtonsVisible(store.getState())).toBe(false);
  });

  it("adds the cabinet to the lower row as wide as that row has room for", async () => {
    renderUlhSidebar();

    await clickPlus("ULH-side-cabinet-h8");

    expect(addedWidths()).toEqual([105]);
    expect(scene.refusals).toEqual([]);
  });

  it("refuses the countertop row's + with the composition length reason, and adds nothing", async () => {
    renderUlhSidebar();

    await clickPlus("ULH-side-cabinet-d4");

    expect(addedWidths()).toEqual([]);
    expect(scene.refusals).toEqual([
      expect.objectContaining({ code: "countertop.compositionLengthReached", params: { maxCm: 270, maxIn: "106.3" } }),
    ]);
  });

  it("refuses a Sink Base in the lower row, where it would fit", async () => {
    addingCabinet("Sink-Base", 60);
    renderUlhSidebar();

    await clickPlus("ULH-side-cabinet-h8");

    expect(addedWidths()).toEqual([]);
    expect(scene.refusals).toEqual([{ code: "cabinet.sinkBaseInCountertopRow" }]);
  });
});
