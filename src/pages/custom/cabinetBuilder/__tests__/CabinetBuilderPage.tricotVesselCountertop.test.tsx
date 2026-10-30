// @vitest-environment jsdom
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import tricotManifest from "../../../../../public/collections/tricot/manifest.json";
import tricotUiDocument from "../../../../../public/collections/tricot/ui.json";
import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import cabinetTable592 from "@/entities/collection/__tests__/fixtures/remote/datatable-592.json";
import {
  tricotConfigurator,
  tricotMatrixProfile,
  tricotTestBindings,
} from "@/entities/collection/__tests__/tricotFixtures";
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
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  recordComposition,
  replaceCollectionData,
  reset,
  setActiveCabinetType,
  setDrawerProduct,
  setHasBootstrappedCabinetBuilder,
  setSelectedDimensions,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { recordValues } from "@/features/configurationCommands";
import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";
import type { TestRuntimePort } from "@/features/playCanvasAdapter";
import { getIsActiveStyleSidebar } from "@/features/sidebar/model/store/selectors";

import { CabinetBuilderPage } from "../CabinetBuilderPage";

/**
 * An integrated Tricot countertop does not take a 60 cm Sink Base with an inner drawer (table 592:
 * `60:1DWID`). Its style card asks first: approved, the countertop becomes a vessel one with the
 * hole cutout, on the Sink Bases already placed too; cancelled, nothing changes.
 */

const scene = vi.hoisted(() => ({
  runtime: null as TestRuntimePort | null,
  // Each undo step the page takes runs its change; the step's own rules are useHistoryStep's tests.
  runStep: vi.fn(<T,>(change: () => Promise<T>) => change()),
  // What the page hears of a width the style sidebar takes.
  onWidthChange: null as ((width: number) => void) | null,
}));

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => false }));
// Tricot's integrated countertop is up to 220 cm long (table 593).
vi.mock("@/features/configurator-rule-core/countertop/hooks/useMaxCountertopLength", () => ({
  useMaxCountertopLength: () => 220,
}));
vi.mock("@/utils/functions/playcanvas/emptyButton", () => ({ showEmptyButton: vi.fn(), hideEmptyButton: vi.fn() }));
vi.mock("@/entities/history/lib/useHistoryStep", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/entities/history/lib/useHistoryStep")>()),
  useHistoryStep: () => ({ run: scene.runStep }),
}));
vi.mock("@/features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar", () => ({
  RightCabinetStyleSidebar: ({ onWidthChange }: { onWidthChange?: (width: number) => void }) => {
    scene.onWidthChange = onWidthChange ?? null;
    return null;
  },
}));
vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: ({ children, title }: { children: ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
}));
vi.mock("@/features/playCanvasAdapter", async (importOriginal) => {
  const adapter = await importOriginal<typeof import("@/features/playCanvasAdapter")>();
  return {
    ...adapter,
    createPlayCanvasRuntimePort: () => (scene.runtime ??= adapter.createTestRuntimePort()).port,
    // The scene is not there to be read back.
    ensureCabinetHeights: vi.fn(async () => {}),
  };
});

const catalog = buildCabinetCatalogFromMatrix(cabinetTable592, tricotMatrixProfile, tricotTestBindings);
const collection = buildReadyCollection("tricot", tricotManifest, tricotUiDocument);

const SINK_BASE = tricotTestBindings.productTypes["Sink-Base"] + "-1";
const SIDE_CABINET = tricotTestBindings.productTypes["Side-Cabinet"] + "-2";
const INNER_DRAWER = "1 Drawer + Inner Drawer";
const VESSEL_PROMPT = "Switch to Vessel Countertop?";
const LEFT_OUT_WIDTH =
  'A 60 cm (23.6") Sink Base with 1 Drawer + Inner Drawer is not available with an Integrated countertop.';
const WIDTH_OR_VESSEL =
  "Change the width, or approve to switch the countertop to Vessel with a hole cutout and update the cabinets in your design.";
const DRAWER_SWITCH_PROMPT = "Update Design?";

const product = () => store.getState().rootStateUI.product;
const record = (values: Record<string, string>) =>
  recordValues(values, { getState: store.getState, dispatch: store.dispatch, flow: "custom" });

type PlacedCabinet = { runtimeId: string; width: number; drawers: string };

/**
 * `placed` stand on the countertop the builder starts with; a Sink Base of `width` cm, in the drawers
 * of `selectedDrawers`, is being added.
 */
const placeCabinets = (placed: PlacedCabinet[], width: number, selectedDrawers: string) => {
  const ids = placed.map(({ runtimeId }) => runtimeId);
  store.dispatch(setHasBootstrappedCabinetBuilder(true));
  store.dispatch(
    recordComposition({
      productIds: ids,
      placedCabinetStyles: Object.fromEntries(placed.map(({ runtimeId, drawers }) => [runtimeId, drawers])),
    }),
  );
  store.dispatch(syncCabinets(ids));
  store.dispatch(
    recordSceneState({
      order: ids,
      cabinets: placed.map(({ runtimeId, width: placedWidth }) => ({
        runtimeId,
        dimensions: { width: placedWidth, height: 40, depth: 52 },
      })),
    }),
  );
  getCabinetEntries(store.getState()).forEach(({ stableKey }, index) =>
    store.dispatch(
      setAttributeValue({
        attributeId: "Drawers",
        target: { scope: "cabinet", cabinetId: stableKey },
        value: placed[index].drawers,
      }),
    ),
  );
  // The builder starts with the model's colour and the collection's basin; the countertop style is the
  // default, integrated. The countertop rules judge a drawer switch by the colour's material.
  record({ sinkType: "VA024", CountertopColor: "Matte White" });
  store.dispatch(setActiveCabinetType("Sink-Base"));
  store.dispatch(setDrawerProduct("Sink-Base"));
  store.dispatch(setSelectedProductConfig({ Drawers: selectedDrawers }));
  store.dispatch(setSelectedDimensions({ width }));
};

/** A one-drawer Sink Base stands on the countertop the builder starts with; another, `width` cm, is being added. */
const placeSinkBase = (width = 60) => placeCabinets([{ runtimeId: SINK_BASE, width: 60, drawers: "1" }], width, "1D");

/**
 * The Tricot Vanity · 87'' 2-Drawer 3 model opened in the builder by deleting its right Side Cabinet:
 * a two-drawer Sink Base and Side Cabinet stay; a Sink Base of `width` cm is being added.
 */
const placeTwoDrawerModel = (width: number) =>
  placeCabinets(
    [
      { runtimeId: SIDE_CABINET, width: 60, drawers: "2" },
      { runtimeId: SINK_BASE, width: 100, drawers: "2" },
    ],
    width,
    "2D",
  );

const renderBuilder = () =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/custom/cabinet-builder?collectionId=tricot"]}>
        <ReadyCollectionContext.Provider
          value={{ ...collection, catalog: { ...collection.catalog, configurator: tricotConfigurator } }}
        >
          <CabinetBuilderPage />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );

/** The style sidebar takes a width for the cabinet being added: it records it and tells the page. */
const takeWidthInSidebar = (width: number) =>
  act(() => {
    store.dispatch(setSelectedDimensions({ width }));
    scene.onWidthChange?.(width);
  });

const clickInnerDrawer = () => fireEvent.click(screen.getByRole("button", { name: INNER_DRAWER }));
/** Every change the scene was sent, in order. */
const sceneChanges = () => (scene.runtime?.calls ?? []).flat();

beforeEach(() => {
  scene.runtime = null;
  scene.runStep.mockClear();
  scene.onWidthChange = null;

  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(replaceCollectionData({ profile: tricotMatrixProfile, cabinetCatalog: catalog }));
  store.dispatch(setActiveCollectionId("tricot"));
  store.dispatch(setActiveRuntimeBindings(tricotTestBindings));
});

afterEach(() => {
  cleanup();
  act(() => setCountertopRuntimeState(null));
});

describe("Tricot 60 cm Sink Base with an inner drawer on an integrated countertop", () => {
  it("asks for a vessel countertop or another width before the style is chosen", async () => {
    placeSinkBase();
    renderBuilder();

    clickInnerDrawer();

    await screen.findByText(VESSEL_PROMPT);
    // It names the width the integrated countertop leaves out, in inches too, and both ways on.
    expect(screen.getByText(LEFT_OUT_WIDTH)).toBeTruthy();
    expect(screen.getByText(WIDTH_OR_VESSEL)).toBeTruthy();
    expect(product().selectedProductConfig).toMatchObject({ Drawers: "1D" });
    expect(scene.runtime?.calls ?? []).toEqual([]);
  });

  it("chooses the style once the width is changed to 80 cm, which the integrated countertop takes", async () => {
    placeSinkBase();
    renderBuilder();
    const countertopStyle = product().productOptions.CountertopStyle;

    clickInnerDrawer();
    await screen.findByText(VESSEL_PROMPT);
    takeWidthInSidebar(80);

    await waitFor(() => expect(screen.queryByText(VESSEL_PROMPT)).toBeNull());
    expect(product().selectedProductConfig).toMatchObject({ Drawers: "1DWID" });
    expect(product().productOptions.CountertopStyle).toBe(countertopStyle);
    expect(scene.runtime?.calls ?? []).toEqual([]);
  });

  it("switches the countertop and the placed Sink Base to the vessel cutout once approved", async () => {
    placeSinkBase();
    renderBuilder();

    clickInnerDrawer();
    await screen.findByText(VESSEL_PROMPT);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(product().selectedProductConfig).toMatchObject({ Drawers: "1DWID" }));
    expect(product().productOptions.CountertopStyle).toBe("vessel");
    // The placed Sink Base loses its integrated basin: the bare vessel cutout.
    expect(getAttributeValue(store.getState(), "sinkType", { scope: "basin", sinkBaseId: "cab-1" })).toBe("");
    expect(sceneChanges()).toEqual(
      expect.arrayContaining([expect.objectContaining({ attributeId: "sinkType", value: "" })]),
    );
    // One step back undoes the switch.
    expect(scene.runStep).toHaveBeenCalledTimes(1);
    expect(getIsActiveStyleSidebar(store.getState())).toBe(true);
  });

  it("changes nothing when cancelled", async () => {
    placeSinkBase();
    renderBuilder();
    const countertopStyle = product().productOptions.CountertopStyle;

    clickInnerDrawer();
    await screen.findByText(VESSEL_PROMPT);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByText(VESSEL_PROMPT)).toBeNull());
    expect(product().selectedProductConfig).toMatchObject({ Drawers: "1D" });
    expect(product().productOptions.CountertopStyle).toBe(countertopStyle);
    expect(getAttributeValue(store.getState(), "sinkType", { scope: "basin", sinkBaseId: "cab-1" })).toBeUndefined();
    expect(scene.runtime?.calls ?? []).toEqual([]);
  });

  it("does not ask in a collection that does not judge its countertop by the matrix", () => {
    // Tricot alone opts in (`ruleData.countertopCompatibility`), even where a catalog names the pair.
    const ruleData = { ...tricotMatrixProfile.ruleData };
    delete ruleData.countertopCompatibility;
    store.dispatch(replaceCollectionData({ profile: { ...tricotMatrixProfile, ruleData }, cabinetCatalog: catalog }));
    placeSinkBase();
    renderBuilder();

    clickInnerDrawer();

    expect(screen.queryByText(VESSEL_PROMPT)).toBeNull();
    expect(product().selectedProductConfig).toMatchObject({ Drawers: "1DWID" });
  });

  it.each([
    ["at 80 cm", 80, {}],
    ["on a vessel countertop", 60, { CountertopStyle: "vessel" }],
  ])("chooses the style at once %s", (_, width, countertop: Record<string, string>) => {
    placeSinkBase(width);
    record(countertop);
    renderBuilder();

    clickInnerDrawer();

    expect(screen.queryByText(VESSEL_PROMPT)).toBeNull();
    expect(product().selectedProductConfig).toMatchObject({ Drawers: "1DWID" });
    expect(scene.runtime?.calls ?? []).toEqual([]);
  });
});

describe("Tricot 60 cm Sink Base with an inner drawer beside two-drawer cabinets", () => {
  /** The inner drawer switches the two-drawer cabinets too: the builder asks for that first. */
  const approveDrawerSwitch = async () => {
    clickInnerDrawer();
    await screen.findByText(DRAWER_SWITCH_PROMPT);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.queryByText(DRAWER_SWITCH_PROMPT)).toBeNull());
  };
  const twoDrawers = { [SIDE_CABINET]: "2", [SINK_BASE]: "2" };

  it("judges the Sink Base at the width it is added at, the only one the composition has room for", async () => {
    // The width chosen before Delete stays 100 cm; the 160 cm left has room for a 60 cm cabinet only.
    placeTwoDrawerModel(100);
    act(() =>
      setCountertopRuntimeState({
        readiness: "ready",
        productId: "Top_Solid-1",
        compositionId: "c-1",
        autoLength: 1.6,
      }),
    );
    renderBuilder();

    await approveDrawerSwitch();

    await screen.findByText(VESSEL_PROMPT);
    expect(screen.getByText(LEFT_OUT_WIDTH)).toBeTruthy();
    expect(product().placedCabinetStyles).toEqual(twoDrawers);
    expect(scene.runtime?.calls ?? []).toEqual([]);
  });

  it("asks for the vessel countertop once the drawer switch is approved, before changing anything", async () => {
    placeTwoDrawerModel(60);
    renderBuilder();

    await approveDrawerSwitch();

    await screen.findByText(VESSEL_PROMPT);
    expect(product().placedCabinetStyles).toEqual(twoDrawers);
    expect(scene.runtime?.calls ?? []).toEqual([]);
  });

  it("takes the countertop to vessel, then the cabinets to the inner drawer, once both are approved", async () => {
    placeTwoDrawerModel(60);
    renderBuilder();

    await approveDrawerSwitch();
    await screen.findByText(VESSEL_PROMPT);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(product().placedCabinetStyles).toEqual({ [SIDE_CABINET]: "1+inner", [SINK_BASE]: "1+inner" }),
    );
    expect(product().productOptions.CountertopStyle).toBe("vessel");
    expect(sceneChanges()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ attributeId: "sinkType", value: "" }),
        expect.objectContaining({ attributeId: "Drawers", value: "1+inner" }),
      ]),
    );
  });

  it("changes nothing when the vessel countertop is cancelled", async () => {
    placeTwoDrawerModel(60);
    renderBuilder();
    const countertopStyle = product().productOptions.CountertopStyle;

    await approveDrawerSwitch();
    await screen.findByText(VESSEL_PROMPT);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByText(VESSEL_PROMPT)).toBeNull());
    expect(product().placedCabinetStyles).toEqual(twoDrawers);
    expect(product().productOptions.CountertopStyle).toBe(countertopStyle);
    expect(scene.runtime?.calls ?? []).toEqual([]);
  });

  it("switches the cabinets without the vessel countertop once the width is changed to 80 cm", async () => {
    placeTwoDrawerModel(60);
    renderBuilder();

    await approveDrawerSwitch();
    await screen.findByText(VESSEL_PROMPT);
    takeWidthInSidebar(80);

    await waitFor(() => expect(screen.queryByText(VESSEL_PROMPT)).toBeNull());
    await waitFor(() =>
      expect(product().placedCabinetStyles).toEqual({ [SIDE_CABINET]: "1+inner", [SINK_BASE]: "1+inner" }),
    );
    expect(product().productOptions.CountertopStyle).not.toBe("vessel");
  });

  it("switches the cabinets at once for an 80 cm Sink Base, which an integrated countertop takes", async () => {
    placeTwoDrawerModel(80);
    renderBuilder();

    await approveDrawerSwitch();

    await waitFor(() =>
      expect(product().placedCabinetStyles).toEqual({ [SIDE_CABINET]: "1+inner", [SINK_BASE]: "1+inner" }),
    );
    expect(screen.queryByText(VESSEL_PROMPT)).toBeNull();
    expect(product().productOptions.CountertopStyle).not.toBe("vessel");
  });

  describe("where the drawer switch takes a placed 60 cm Sink Base to the inner drawer", () => {
    /** A two-drawer 60 cm Sink Base stands; an 80 cm one, which an integrated countertop takes, is being added. */
    const placeTwoDrawerSinkBase = () => placeCabinets([{ runtimeId: SINK_BASE, width: 60, drawers: "2" }], 80, "2D");

    it("asks for the vessel countertop, naming the placed Sink Base, before changing anything", async () => {
      placeTwoDrawerSinkBase();
      renderBuilder();

      await approveDrawerSwitch();

      await screen.findByText(VESSEL_PROMPT);
      expect(screen.getByText(LEFT_OUT_WIDTH)).toBeTruthy();
      expect(product().placedCabinetStyles).toEqual({ [SINK_BASE]: "2" });
      expect(scene.runtime?.calls ?? []).toEqual([]);
    });

    it("takes the countertop to vessel, then the Sink Base to the inner drawer, once both are approved", async () => {
      placeTwoDrawerSinkBase();
      renderBuilder();

      await approveDrawerSwitch();
      await screen.findByText(VESSEL_PROMPT);
      fireEvent.click(screen.getByRole("button", { name: "Approve" }));

      await waitFor(() => expect(product().placedCabinetStyles).toEqual({ [SINK_BASE]: "1+inner" }));
      expect(product().productOptions.CountertopStyle).toBe("vessel");
    });

    it("keeps asking when the width of the cabinet being added changes: the placed one is still left out", async () => {
      placeTwoDrawerSinkBase();
      renderBuilder();

      await approveDrawerSwitch();
      await screen.findByText(VESSEL_PROMPT);
      takeWidthInSidebar(100);

      expect(screen.getByText(LEFT_OUT_WIDTH)).toBeTruthy();
      expect(product().placedCabinetStyles).toEqual({ [SINK_BASE]: "2" });
      expect(scene.runtime?.calls ?? []).toEqual([]);
    });
  });
});
