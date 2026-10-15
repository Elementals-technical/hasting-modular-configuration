// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ulhManifest from "../../../../../../public/collections/urban-low-height/manifest.json";
import ulhPresets from "../../../../../../public/collections/urban-low-height/presets.json";
import ulhProfileDocument from "../../../../../../public/collections/urban-low-height/product-profile.json";
import ulhUi from "../../../../../../public/collections/urban-low-height/ui.json";
import ushUi from "../../../../../../public/collections/urban-standard-height/ui.json";
import { store } from "@/app/store";
import { parseProductProfile } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import cabinetTable439 from "@/entities/collection/__tests__/fixtures/remote/datatable-439.json";
import cabinetTable580 from "@/entities/collection/__tests__/fixtures/remote/datatable-580.json";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { ulhRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import {
  recordSceneState,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  syncCabinets,
} from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import { getCabinetBuilderProductConfig } from "@/entities/product/model/store/selectors";
import {
  addProductId,
  replaceCollectionData,
  reset,
  setActiveCabinetType,
  setSelectedDimensions,
  setSelectedProductConfig,
  setSelectedSceneProduct,
} from "@/entities/product/model/store/slice";
import { renderWithUshCollection } from "@/features/collectionCustomization/__tests__/testUtils/renderWithUshCollection";
import type { TestRuntimePort } from "@/features/playCanvasAdapter";
import { getPlacementButtonsVisible } from "@/features/sidebar/model/store/selectors";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";

import { RightCabinetStyleSidebar } from "../RightCabinetStyleSidebar";

/**
 * An Urban Low Height cabinet takes two heights per handle (upper groove 38/28 cm, push-to-open
 * 35/25 cm), so the sidebar lets the user choose a height; one of the other handle selects that
 * handle with it. Placed cabinets share one height: the choice goes to the command service once,
 * never straight to the scene.
 */

const scene = vi.hoisted(() => ({
  runtime: null as TestRuntimePort | null,
  directBatch: vi.fn(),
  saveSnapshot: vi.fn(async () => {}),
}));

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => false }));
vi.mock("@/entities/history/lib/useHistorySnapshot", () => ({ useHistorySnapshot: () => scene.saveSnapshot }));
vi.mock("@/utils/functions/playcanvas/setConfigBatch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/functions/playcanvas/setConfigBatch")>()),
  setConfigBatch: scene.directBatch,
}));
vi.mock("@/features/playCanvasAdapter", async (importOriginal) => {
  const adapter = await importOriginal<typeof import("@/features/playCanvasAdapter")>();
  return {
    ...adapter,
    createPlayCanvasRuntimePort: () => (scene.runtime ??= adapter.createTestRuntimePort()).port,
  };
});

const parsedUlhProfile = parseProductProfile(ulhProfileDocument);
if (!parsedUlhProfile.ok) throw new Error("Urban Low Height profile must parse");
const ulhProfile = parsedUlhProfile.profile;
// Built as the loader builds it, with the scene product of each cabinet type: a placed cabinet is
// known by its scene id.
const ulhCatalog = buildCabinetCatalogFromMatrix(cabinetTable580 as ProductDatatable, ulhProfile, ulhRuntimeBindings);
const ushCatalog = buildCabinetCatalogFromMatrix(cabinetTable439 as ProductDatatable, ushProfile);

const PLACED_CABINET = "ULH-sink-cabinet-test1";

const product = () => store.getState().rootStateUI.product;

/** The sidebar under the shipped ui.json, or under one that lists other selectors (`styleSidebar`). */
const renderUlhSidebar = (uiOverride: Record<string, unknown> = {}) =>
  renderWithUshCollection(<RightCabinetStyleSidebar />, {
    initialPath: "/?collectionId=urban-low-height",
    data: buildReadyCollection("urban-low-height", ulhManifest, { ...ulhUi, ...uiOverride }, ulhPresets),
  });

/** Titles of the selectors the sidebar shows, top to bottom. */
const selectorTitles = () =>
  Array.from(document.querySelectorAll('[class*="contentItem"]')).map((row) => row.firstElementChild?.textContent);

/** A selector of the sidebar: its title, and the options its menu lists once opened. */
const selectorTitle = (name: string) => screen.queryByText(name, { selector: "div" });
const heightTitle = () => selectorTitle("Height");

const openMenu = (name: string) => {
  const title = selectorTitle(name);
  if (!title?.parentElement) throw new Error(`The sidebar shows no ${name} selector`);

  fireEvent.click(within(title.parentElement).getByRole("button"));
  return screen.getByRole("listbox", { name });
};

/** Each option reads as its height in inches. */
const heightOptions = () =>
  within(openMenu("Height"))
    .getAllByRole("option")
    .map((option) => option.textContent);

const chooseOption = (name: string, label: string) => {
  const option = within(openMenu(name))
    .getAllByRole("option")
    .find((node) => node.textContent === label);
  if (!option) throw new Error(`The ${name} selector offers no ${label}`);

  fireEvent.click(option);
};

const chooseHeight = (inches: string) => chooseOption("Height", inches);

const placeCabinet = () => {
  store.dispatch(addProductId(PLACED_CABINET));
  store.dispatch(syncCabinets([PLACED_CABINET]));
  store.dispatch(
    recordSceneState({
      order: [PLACED_CABINET],
      cabinets: [{ runtimeId: PLACED_CABINET, dimensions: { width: 60, height: 38, depth: 46 } }],
    }),
  );
  store.dispatch(setSelectedSceneProduct(PLACED_CABINET));
};

beforeEach(() => {
  scene.runtime = null;
  scene.directBatch.mockClear();
  scene.saveSnapshot.mockClear();

  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(replaceCollectionData({ profile: ulhProfile, cabinetCatalog: ulhCatalog }));
  store.dispatch(setActiveCollectionId("urban-low-height"));
  store.dispatch(setActiveRuntimeBindings(ulhRuntimeBindings));
  store.dispatch(setActiveCabinetType("Sink-Base"));
  store.dispatch(setSelectedProductConfig({ Handle: "handle_urban_topcut", Drawers: "1" }));
  store.dispatch(setSelectedDimensions({ width: 60 }));
  store.dispatch(setSelectedDimensions({ depth: 46 }));
  store.dispatch(setOpenStyleSidebar(true));
});

afterEach(cleanup);

describe("height of an Urban Low Height cabinet in the style sidebar", () => {
  it("offers the two heights of the chosen handle, in inches as the price list writes them", () => {
    renderUlhSidebar();

    expect(heightOptions()).toEqual(['11"', '15"']);
  });

  it("keeps the choice for the next cabinet while none is placed", () => {
    renderUlhSidebar();
    expect(product().selectedDimensions.height).toBe(38);

    chooseHeight('11"');

    expect(product().selectedDimensions.height).toBe(28);
    expect(getCabinetBuilderProductConfig(store.getState())?.Height).toBe(28);
    expect(product().selectedProductConfig?.Handle).toBe("handle_urban_topcut");
    expect(scene.runtime?.calls ?? []).toEqual([]);
    expect(scene.directBatch).not.toHaveBeenCalled();
  });

  it("offers the heights of push-to-open once that handle is chosen, and moves to the nearest", async () => {
    renderUlhSidebar();

    chooseOption("Handle", "Push to open");

    await waitFor(() => expect(product().selectedProductConfig?.Handle).toBe("handle_pto"));
    expect(product().selectedDimensions.height).toBe(35);
    expect(getCabinetBuilderProductConfig(store.getState())).toMatchObject({ Height: 35, Handle: "handle_pto" });
    expect(heightOptions()).toEqual(['9.8"', '13.8"']);
    expect(scene.runtime?.calls ?? []).toEqual([]);
    expect(scene.directBatch).not.toHaveBeenCalled();
  });

  it("resizes the placed cabinets through the command service, once, and not past it", async () => {
    placeCabinet();
    renderUlhSidebar();

    chooseHeight('11"');

    await waitFor(() => expect(product().selectedDimensions.height).toBe(28));
    expect(scene.saveSnapshot).toHaveBeenCalledTimes(1);
    expect(scene.runtime?.calls).toEqual([
      [expect.objectContaining({ attributeId: "Height", target: { scope: "global" }, value: 28 })],
    ]);
    expect(scene.directBatch).not.toHaveBeenCalled();
  });

  it("moves the placed cabinets to the nearest height of a new handle, after asking", async () => {
    placeCabinet();
    renderUlhSidebar();

    chooseOption("Handle", "Push to open");

    // Nothing is sent or recorded until the user confirms the handle change.
    await screen.findByText("Update Handle Style?");
    expect(scene.runtime?.calls ?? []).toEqual([]);
    expect(product().selectedDimensions.height).toBe(38);

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(product().selectedDimensions.height).toBe(35));
    expect(product().selectedProductConfig?.Handle).toBe("handle_pto");
    // One set: the handle, and the nearest height it takes.
    expect(scene.runtime?.calls).toHaveLength(1);
    expect(scene.runtime?.calls[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ attributeId: "Handle", value: "handle_pto" }),
        expect.objectContaining({ attributeId: "Height", target: { scope: "global" }, value: 35 }),
      ]),
    );
    expect(scene.directBatch).not.toHaveBeenCalled();
    expect(heightOptions()).toEqual(['9.8"', '13.8"']);
  });
});

describe("selectors of the style sidebar, as the collection's ui.json lists them", () => {
  it("shows Height for Urban Low Height, whose ui.json lists it", () => {
    expect(ulhUi.styleSidebar.fields).toEqual(["Width", "Depth", "Height", "Handle"]);
    renderUlhSidebar();

    expect(selectorTitles()).toEqual(["Width", "Depth", "Height", "Handle"]);
  });

  it("shows Width, Depth and Handle when ui.json lists nothing, although the cabinets take several heights", () => {
    renderUlhSidebar({ styleSidebar: undefined });

    expect(selectorTitles()).toEqual(["Width", "Depth", "Handle"]);
    expect(heightTitle()).toBeNull();
  });

  it("shows the listed selectors only, in the listed order", () => {
    renderUlhSidebar({ styleSidebar: { fields: ["Height", "Width"] } });

    expect(selectorTitles()).toEqual(["Height", "Width"]);
  });
});

describe("height in the style sidebar of Urban Standard Height", () => {
  it("is not offered: the handle and the drawers decide the one height of a cabinet", () => {
    store.dispatch(replaceCollectionData({ profile: ushProfile, cabinetCatalog: ushCatalog }));
    store.dispatch(setActiveCollectionId("urban-standard-height"));
    store.dispatch(setActiveCabinetType("Sink-Cabinet"));
    renderWithUshCollection(<RightCabinetStyleSidebar />);

    expect(screen.getByText("Width", { selector: "div" })).toBeTruthy();
    expect(heightTitle()).toBeNull();
  });

  it("is not offered even when ui.json lists it: there is one height, so nothing to choose", () => {
    store.dispatch(replaceCollectionData({ profile: ushProfile, cabinetCatalog: ushCatalog }));
    store.dispatch(setActiveCollectionId("urban-standard-height"));
    store.dispatch(setActiveCabinetType("Sink-Cabinet"));
    renderWithUshCollection(<RightCabinetStyleSidebar />, {
      uiDocument: { ...ushUi, styleSidebar: { fields: ["Width", "Depth", "Height", "Handle"] } },
    });

    expect(selectorTitles()).toEqual(["Width", "Depth", "Handle"]);
  });
});

describe("the scene's + buttons of the style sidebar", () => {
  // The player offers Drag to Place beside them, so it reads whether they show.
  it("are published while the sidebar shows them for the cabinet being added, and withdrawn after", async () => {
    const { unmount } = renderUlhSidebar();
    await waitFor(() => expect(getPlacementButtonsVisible(store.getState())).toBe(true));

    act(() => {
      store.dispatch(setOpenStyleSidebar(false));
    });
    expect(getPlacementButtonsVisible(store.getState())).toBe(false);

    act(() => {
      store.dispatch(setOpenStyleSidebar(true));
    });
    await waitFor(() => expect(getPlacementButtonsVisible(store.getState())).toBe(true));
    unmount();
    expect(getPlacementButtonsVisible(store.getState())).toBe(false);
  });
});
