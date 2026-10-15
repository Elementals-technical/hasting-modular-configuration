// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import urbanDuplexManifest from "../../../../../../public/collections/urban-duplex/manifest.json";
import urbanDuplexProfileDocument from "../../../../../../public/collections/urban-duplex/product-profile.json";
import urbanDuplexBindingsDocument from "../../../../../../public/collections/urban-duplex/runtime-bindings.json";
import urbanDuplexUi from "../../../../../../public/collections/urban-duplex/ui.json";
import { store } from "@/app/store";
import { parseProductProfile, parseRuntimeBindings } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import cabinetTable594 from "@/entities/collection/__tests__/fixtures/remote/datatable-594.json";
import {
  getAttributeValue,
  getCabinetEntries,
  recordSceneState,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setAttributeValue,
  syncCabinets,
} from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import { getCabinetBuilderProductConfig } from "@/entities/product/model/store/selectors";
import {
  recordComposition,
  replaceCollectionData,
  reset,
  setActiveCabinetType,
  setSelectedDimensions,
  setSelectedProductConfig,
  setSelectedSceneProduct,
} from "@/entities/product/model/store/slice";
import { renderWithUshCollection } from "@/features/collectionCustomization/__tests__/testUtils/renderWithUshCollection";
import type { TestRuntimePort } from "@/features/playCanvasAdapter";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";

import { RightCabinetStyleSidebar } from "../RightCabinetStyleSidebar";

/**
 * Each Urban Duplex cabinet has its lateral panel on a side of its own. The style sidebar offers
 * the side after its own selectors (`styleSidebar.attributes` of the collection's ui.json): for
 * the cabinet selected in the scene it changes that cabinet alone; with none selected it is the
 * choice for the cabinet being added.
 */

const scene = vi.hoisted(() => ({
  runtime: null as TestRuntimePort | null,
  // Each undo step the sidebar takes runs its change; the step's own rules are useHistoryStep's tests.
  runStep: vi.fn(<T,>(change: () => Promise<T>) => change()),
  select: vi.fn(),
}));

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => false }));
vi.mock("@/entities/history/lib/useHistoryStep", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/entities/history/lib/useHistoryStep")>()),
  useHistoryStep: () => ({ run: scene.runStep }),
}));
vi.mock("@/utils/functions/playcanvas/setConfigBatch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/functions/playcanvas/setConfigBatch")>()),
  setConfigBatch: vi.fn(),
}));
vi.mock("@/utils/functions/playcanvas/getSelectTool", () => ({
  getSelectTool: () => ({ setSelectedByName: scene.select }),
}));
vi.mock("@/features/playCanvasAdapter", async (importOriginal) => {
  const adapter = await importOriginal<typeof import("@/features/playCanvasAdapter")>();
  return {
    ...adapter,
    createPlayCanvasRuntimePort: () => (scene.runtime ??= adapter.createTestRuntimePort()).port,
  };
});

const parsedProfile = parseProductProfile(urbanDuplexProfileDocument);
const parsedBindings = parseRuntimeBindings(urbanDuplexBindingsDocument);
if (!parsedProfile.ok || !parsedBindings.ok) throw new Error("the packaged Urban Duplex data must parse");
const profile = parsedProfile.profile;
const bindings = parsedBindings.bindings;
// Built as the loader builds it, with the scene product of each cabinet type.
const catalog = buildCabinetCatalogFromMatrix(cabinetTable594 as ProductDatatable, profile, bindings);

const SINK_BASE = "UD-sink-cabinet-test1";
const SIDE_CABINET = "UD-side-cabinet-test2";

const product = () => store.getState().rootStateUI.product;

const renderSidebar = (uiOverride: Record<string, unknown> = {}) =>
  renderWithUshCollection(<RightCabinetStyleSidebar />, {
    initialPath: "/?collectionId=urban-duplex",
    data: buildReadyCollection("urban-duplex", urbanDuplexManifest, { ...urbanDuplexUi, ...uiOverride }),
  });

const selectorTitles = () =>
  Array.from(document.querySelectorAll('[class*="contentItem"]')).map((row) => row.firstElementChild?.textContent);

const sideSelector = () => {
  const title = screen.queryByText("Lateral Panel", { selector: "div" });
  if (!title?.parentElement) throw new Error("The sidebar shows no Lateral Panel selector");
  return within(title.parentElement).getByRole("button");
};

const chooseSide = (label: string) => {
  fireEvent.click(sideSelector());
  const option = within(screen.getByRole("listbox", { name: "Lateral Panel" }))
    .getAllByRole("option")
    .find((node) => node.textContent === label);
  if (!option) throw new Error(`The Lateral Panel selector offers no ${label}`);
  fireEvent.click(option);
};

/** A Sink Base and a Side Cabinet in the scene, with the lateral panel of each on the side given. */
const placeCabinets = (sides: [string, string]) => {
  const placed = [SINK_BASE, SIDE_CABINET];
  store.dispatch(
    recordComposition({ productIds: placed, placedCabinetStyles: { [SINK_BASE]: "2", [SIDE_CABINET]: "2" } }),
  );
  store.dispatch(syncCabinets(placed));
  store.dispatch(
    recordSceneState({
      order: placed,
      cabinets: placed.map((runtimeId) => ({ runtimeId, dimensions: { width: 60, height: 56, depth: 50 } })),
    }),
  );
  const cabinetIds = getCabinetEntries(store.getState()).map(({ stableKey }) => stableKey);
  cabinetIds.forEach((cabinetId, index) =>
    store.dispatch(
      setAttributeValue({
        attributeId: "LateralPanelSide",
        target: { scope: "cabinet", cabinetId },
        value: sides[index],
      }),
    ),
  );
  return cabinetIds;
};

const sides = () =>
  getCabinetEntries(store.getState()).map(({ stableKey }) =>
    getAttributeValue(store.getState(), "LateralPanelSide", { scope: "cabinet", cabinetId: stableKey }),
  );

beforeEach(() => {
  scene.runtime = null;
  scene.runStep.mockClear();
  scene.select.mockClear();

  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(replaceCollectionData({ profile, cabinetCatalog: catalog }));
  store.dispatch(setActiveCollectionId("urban-duplex"));
  store.dispatch(setActiveRuntimeBindings(bindings));
  // A two-drawer Side Cabinet is being added: its style was picked, which opens the sidebar.
  store.dispatch(setActiveCabinetType("Sink-Cabinet"));
  store.dispatch(setSelectedProductConfig({ Handle: "UG", Drawers: "2D" }));
  store.dispatch(setSelectedDimensions({ width: 60 }));
  store.dispatch(setSelectedDimensions({ depth: 50 }));
  store.dispatch(setOpenStyleSidebar(true));
});

afterEach(cleanup);

describe("the side of the lateral panel in the style sidebar", () => {
  it("is offered after the sidebar's own selectors, on the collection's starting side", () => {
    renderSidebar();

    expect(selectorTitles()).toEqual(["Width", "Depth", "Handle", "Lateral Panel"]);
    expect(sideSelector().textContent).toContain("Right");
  });

  it("is the choice for the cabinet being added while no cabinet is selected", () => {
    placeCabinets(["R", "R"]);
    renderSidebar();

    chooseSide("Left");

    // The cabinet the plus button adds takes it; the placed ones are not touched.
    expect(sideSelector().textContent).toContain("Left");
    expect(getCabinetBuilderProductConfig(store.getState())).toMatchObject({ LateralPanelSide: "L" });
    expect(scene.runtime?.calls ?? []).toEqual([]);
    expect(scene.runStep).not.toHaveBeenCalled();
    expect(sides()).toEqual(["R", "R"]);
  });

  it("shows the side of the cabinet selected in the scene", () => {
    placeCabinets(["R", "L"]);
    store.dispatch(setSelectedSceneProduct(SIDE_CABINET));
    renderSidebar();

    expect(sideSelector().textContent).toContain("Left");
  });

  it("turns the lateral panel of the selected cabinet alone, and keeps it selected", async () => {
    const [, sideCabinetId] = placeCabinets(["R", "R"]);
    store.dispatch(setSelectedSceneProduct(SIDE_CABINET));
    renderSidebar();

    chooseSide("Left");

    await waitFor(() => expect(sides()).toEqual(["R", "L"]));
    expect(scene.runStep).toHaveBeenCalledTimes(1);
    expect(scene.runtime?.calls).toEqual([
      [
        expect.objectContaining({
          attributeId: "LateralPanelSide",
          target: { scope: "cabinet", cabinetId: sideCabinetId },
          value: "L",
          onlyThisCabinet: true,
        }),
      ],
    ]);
    // The scene drops its selection as it rebuilds the cabinet.
    await waitFor(() => expect(scene.select).toHaveBeenCalledWith(SIDE_CABINET, { mode: "replace" }));
    // The choice was for that cabinet, not for the next one to add.
    expect(product().selectedProductConfig).not.toHaveProperty("LateralPanelSide");
  });

  it("is not offered for an open shelf, which has no lateral panel", () => {
    placeCabinets(["R", "R"]);
    store.dispatch(setActiveCabinetType("Open-Shelf"));
    renderSidebar();

    expect(selectorTitles()).not.toContain("Lateral Panel");
  });

  it("is not offered by a collection that lists no such value", () => {
    renderSidebar({ styleSidebar: { fields: ["Width", "Depth", "Height", "Handle"] } });

    expect(selectorTitles()).toEqual(["Width", "Depth", "Handle"]);
  });
});
