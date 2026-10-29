// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import tricotManifest from "../../../../../../public/collections/tricot/manifest.json";
import tricotUiDocument from "../../../../../../public/collections/tricot/ui.json";
import { store } from "@/app/store";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import cabinetTable592 from "@/entities/collection/__tests__/fixtures/remote/datatable-592.json";
import {
  tricotConfigurator,
  tricotMatrixProfile,
  tricotTestBindings,
} from "@/entities/collection/__tests__/tricotFixtures";
import { resetConfiguration, setActiveCollectionId, setActiveRuntimeBindings } from "@/entities/configuration";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  replaceCollectionData,
  reset,
  setActiveCabinetType,
  setDrawerProduct,
  setSelectedDimensions,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { renderWithUshCollection } from "@/features/collectionCustomization/__tests__/testUtils/renderWithUshCollection";
import type { TestRuntimePort } from "@/features/playCanvasAdapter";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";

import { RightCabinetStyleSidebar } from "../RightCabinetStyleSidebar";

/**
 * An integrated Tricot countertop does not take a 60 cm Sink Base with an inner drawer (table 592:
 * `60:1DWID`). With the inner drawer chosen, the width selector asks before 60 cm: approved, the
 * countertop becomes a vessel one and the width is 60 cm; cancelled, the width stays.
 */

const scene = vi.hoisted(() => ({
  runtime: null as TestRuntimePort | null,
}));

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => true }));
vi.mock("@/utils/functions/playcanvas/setHandleButtonClick", () => ({ setHandleButtonClick: vi.fn() }));
vi.mock("@/utils/functions/playcanvas/setVisibleButtons", () => ({ setVisibleButtons: vi.fn() }));
vi.mock("@/utils/functions/playcanvas/emptyButton", () => ({ showEmptyButton: vi.fn(), hideEmptyButton: vi.fn() }));
vi.mock("@/utils/functions/playcanvas/sceneBridge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/functions/playcanvas/sceneBridge")>()),
  setScenePlusFilter: () => true,
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
  };
});

const catalog = buildCabinetCatalogFromMatrix(cabinetTable592, tricotMatrixProfile, tricotTestBindings);
const collection = buildReadyCollection("tricot", tricotManifest, tricotUiDocument);

const VESSEL_PROMPT = "Switch to Vessel Countertop?";
const LEFT_OUT_WIDTH =
  'A 60 cm (23.6") Sink Base with 1 Drawer + Inner Drawer is not available with an Integrated countertop.';

const product = () => store.getState().rootStateUI.product;

/** A Sink Base of 80 cm with `drawers` is being added on the countertop the builder starts with, integrated. */
const chooseSinkBase = (drawers: string) => {
  store.dispatch(setActiveCabinetType("Sink-Base"));
  store.dispatch(setDrawerProduct("Sink-Base"));
  store.dispatch(setSelectedProductConfig({ Drawers: drawers }));
  store.dispatch(setSelectedDimensions({ width: 80, depth: 52, height: 40 }));
  store.dispatch(setOpenStyleSidebar(true));
};

/** What the page hears of a width the sidebar takes. */
const onWidthChange = vi.fn();

const renderSidebar = () =>
  renderWithUshCollection(<RightCabinetStyleSidebar onWidthChange={onWidthChange} />, {
    initialPath: "/?collectionId=tricot",
    data: { ...collection, catalog: { ...collection.catalog, configurator: tricotConfigurator } },
  });

const pickWidth = (label: string) => {
  const title = screen.getByText("Width", { selector: "div" });
  fireEvent.click(within(title.parentElement as HTMLElement).getByRole("button"));
  fireEvent.click(within(screen.getByRole("listbox", { name: "Width" })).getByText(label));
};

beforeEach(() => {
  scene.runtime = null;
  onWidthChange.mockClear();

  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(replaceCollectionData({ profile: tricotMatrixProfile, cabinetCatalog: catalog }));
  store.dispatch(setActiveCollectionId("tricot"));
  store.dispatch(setActiveRuntimeBindings(tricotTestBindings));
});

afterEach(cleanup);

describe("Tricot style sidebar width for a Sink Base with an inner drawer", () => {
  it("asks before 60 cm, which the integrated countertop leaves out, and keeps the width till then", async () => {
    chooseSinkBase("1DWID");
    renderSidebar();

    pickWidth('23.6"');

    await screen.findByText(VESSEL_PROMPT);
    expect(screen.getByText(LEFT_OUT_WIDTH)).toBeTruthy();
    expect(product().selectedDimensions.width).toBe(80);
    expect(onWidthChange).not.toHaveBeenCalled();
    expect(scene.runtime?.calls ?? []).toEqual([]);
  });

  it("takes the vessel countertop and 60 cm once approved", async () => {
    chooseSinkBase("1DWID");
    renderSidebar();

    pickWidth('23.6"');
    await screen.findByText(VESSEL_PROMPT);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(product().selectedDimensions.width).toBe(60));
    expect(product().productOptions.CountertopStyle).toBe("vessel");
    expect(onWidthChange).toHaveBeenCalledWith(60);
  });

  it("keeps the width and the countertop when cancelled", async () => {
    chooseSinkBase("1DWID");
    renderSidebar();
    const countertopStyle = product().productOptions.CountertopStyle;

    pickWidth('23.6"');
    await screen.findByText(VESSEL_PROMPT);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByText(VESSEL_PROMPT)).toBeNull());
    expect(product().selectedDimensions.width).toBe(80);
    expect(product().productOptions.CountertopStyle).toBe(countertopStyle);
    expect(scene.runtime?.calls ?? []).toEqual([]);
  });

  it("takes 60 cm at once for one drawer, and tells the page", () => {
    chooseSinkBase("1D");
    renderSidebar();

    pickWidth('23.6"');

    expect(screen.queryByText(VESSEL_PROMPT)).toBeNull();
    expect(product().selectedDimensions.width).toBe(60);
    expect(onWidthChange).toHaveBeenCalledWith(60);
  });
});
