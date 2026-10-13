// @vitest-environment jsdom
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import urbanDuplexManifest from "../../../../../public/collections/urban-duplex/manifest.json";
import urbanDuplexProfileDocument from "../../../../../public/collections/urban-duplex/product-profile.json";
import urbanDuplexBindingsDocument from "../../../../../public/collections/urban-duplex/runtime-bindings.json";
import urbanDuplexUi from "../../../../../public/collections/urban-duplex/ui.json";
import { store } from "@/app/store";
import { parseProductProfile, parseRuntimeBindings, ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import cabinetTable594 from "@/entities/collection/__tests__/fixtures/remote/datatable-594.json";
import {
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
import {
  recordComposition,
  replaceCollectionData,
  reset,
  setActiveCabinetType,
  setHasBootstrappedCabinetBuilder,
  setSelectedDimensions,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import type { TestRuntimePort } from "@/features/playCanvasAdapter";

import { CabinetBuilderPage } from "../CabinetBuilderPage";

/**
 * An Urban Duplex one-drawer cabinet comes at 53 cm and as the Slim 38 and 28 cm, so the style
 * groups no longer say how high a composition is. Beside Slim cabinets another one-drawer
 * cabinet goes; a cabinet with an inner drawer, 53 cm only, switches them all, after asking.
 *
 * The placed cabinets are named after their scene product (`UD-side-cabinet-…`), not after the
 * cabinet type: the switch still finds them.
 *
 * The Side Cabinet also comes from Urban Standard Height and Urban Low Height, each under the
 * name of its series: a card there adds a cabinet of that series, at the heights it comes in.
 */

const scene = vi.hoisted(() => ({
  runtime: null as TestRuntimePort | null,
  saveSnapshot: vi.fn(async () => {}),
}));

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => false }));
vi.mock("@/utils/functions/playcanvas/emptyButton", () => ({ showEmptyButton: vi.fn(), hideEmptyButton: vi.fn() }));
vi.mock("@/entities/history/lib/useHistorySnapshot", () => ({ useHistorySnapshot: () => scene.saveSnapshot }));
vi.mock("@/features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar", () => ({
  RightCabinetStyleSidebar: () => null,
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

const parsedProfile = parseProductProfile(urbanDuplexProfileDocument);
const parsedBindings = parseRuntimeBindings(urbanDuplexBindingsDocument);
if (!parsedProfile.ok || !parsedBindings.ok) throw new Error("the packaged Urban Duplex data must parse");
const profile = parsedProfile.profile;
const bindings = parsedBindings.bindings;
// Built as the loader builds it, with the scene product of each cabinet type.
const catalog = buildCabinetCatalogFromMatrix(cabinetTable594 as ProductDatatable, profile, bindings);
const collection = buildReadyCollection("urban-duplex", urbanDuplexManifest, urbanDuplexUi);

const SINK_BASE = "UD-sink-cabinet-test1";
const SIDE_CABINET = "UD-side-cabinet-test2";

const product = () => store.getState().rootStateUI.product;

type Placed = {
  placed?: string[];
  /** The drawers of every placed cabinet, as the state spells them. */
  style?: "1" | "2";
  /** The series the state holds for a cabinet; one without is the collection's own. */
  series?: Record<string, string>;
};

/** Drawer cabinets at `height` cm, a Sink Base and a Side Cabinet unless named; a Side Cabinet is being added. */
const placeCabinets = (
  height: number,
  { placed = [SINK_BASE, SIDE_CABINET], style = "1", series = {} }: Placed = {},
) => {
  store.dispatch(setHasBootstrappedCabinetBuilder(true));
  store.dispatch(
    recordComposition({
      productIds: placed,
      placedCabinetStyles: Object.fromEntries(placed.map((runtimeId) => [runtimeId, style])),
    }),
  );
  store.dispatch(syncCabinets(placed));
  store.dispatch(
    recordSceneState({
      order: placed,
      cabinets: placed.map((runtimeId) => ({ runtimeId, dimensions: { width: 60, height, depth: 50 } })),
    }),
  );
  for (const { runtimeId, stableKey } of getCabinetEntries(store.getState())) {
    store.dispatch(
      setAttributeValue({
        attributeId: "Series",
        target: { scope: "cabinet", cabinetId: stableKey },
        value: series[runtimeId] ?? "URDPX",
      }),
    );
  }
  store.dispatch(setActiveCabinetType("Sink-Cabinet"));
  store.dispatch(setSelectedProductConfig({ Handle: "UG", Drawers: `${style}D` }));
  store.dispatch(setSelectedDimensions({ height }));
};

const placeOneDrawerCabinets = (height: number, placed?: string[]) => placeCabinets(height, { placed });

const renderBuilder = () =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/custom/cabinet-builder?collectionId=urban-duplex"]}>
        <ReadyCollectionContext.Provider value={collection}>
          <CabinetBuilderPage />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );

const seriesHeadings = () =>
  Array.from(document.querySelectorAll('[class*="groupTitle"]')).map((node) => node.textContent);
/** The cards of a Side Cabinet stand under the series that supplies it. */
const cardsOf = (series: string) =>
  within(screen.getByText(series, { selector: '[class*="groupTitle"]' }).closest("section") as HTMLElement);
const styleCard = (title: string, series = "Urban Duplex") => cardsOf(series).getByRole("button", { name: title });
/** A style that switches the placed cabinets is drawn as restricted and asks first. */
const isRestricted = (title: string, series?: string) =>
  Boolean(styleCard(title, series).closest('[class*="productStyleItem"]')?.className.includes("restricted"));
const enabledWidths = () =>
  product()
    .dimensionOptions.width.filter(({ disabled }) => !disabled)
    .map(({ value }) => value);
/** Every change the scene was sent, in order. */
const sceneChanges = () => (scene.runtime?.calls ?? []).flat();

beforeEach(() => {
  scene.runtime = null;
  scene.saveSnapshot.mockClear();

  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(replaceCollectionData({ profile, cabinetCatalog: catalog }));
  store.dispatch(setActiveCollectionId("urban-duplex"));
  store.dispatch(setActiveRuntimeBindings(bindings));
});

afterEach(cleanup);

describe("Urban Duplex cabinet styles beside placed cabinets", () => {
  it("lets one more one-drawer cabinet stand beside the Slim ones, and asks before the other styles", () => {
    placeOneDrawerCabinets(38);
    renderBuilder();

    expect(isRestricted("1 Drawer")).toBe(false);
    expect(isRestricted("1 Drawer With Inner Drawer")).toBe(true);
    expect(isRestricted("2 Drawer")).toBe(true);
  });

  it("lets an inner drawer stand beside the standard one-drawer cabinets, both 53 cm", () => {
    placeOneDrawerCabinets(53);
    renderBuilder();

    expect(isRestricted("1 Drawer")).toBe(false);
    expect(isRestricted("1 Drawer With Inner Drawer")).toBe(false);
    expect(isRestricted("2 Drawer")).toBe(true);
  });

  it("switches every Slim cabinet to the inner drawer and its 53 cm once the user approves", async () => {
    placeOneDrawerCabinets(38);
    renderBuilder();

    fireEvent.click(styleCard("1 Drawer With Inner Drawer"));

    // Nothing is sent or recorded until the user approves.
    await screen.findByText("Update Design?");
    expect(scene.runtime?.calls ?? []).toEqual([]);
    expect(product().selectedDimensions.height).toBe(38);

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(product().placedCabinetStyles).toEqual({ [SINK_BASE]: "1+inner", [SIDE_CABINET]: "1+inner" }),
    );
    expect(product().selectedDimensions.height).toBe(53);
    // One set for the scene: the drawers of each cabinet and the height they require.
    expect(scene.saveSnapshot).toHaveBeenCalledTimes(1);
    expect(scene.runtime?.calls).toHaveLength(1);
    expect(scene.runtime?.calls[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ attributeId: "Drawers", value: "1+inner" }),
        expect.objectContaining({ attributeId: "Height", value: 53 }),
      ]),
    );
    expect(scene.runtime?.calls[0].filter(({ attributeId }) => attributeId === "Drawers")).toHaveLength(2);
  });

  it("switches a Side Cabinet standing alone, which its scene id does not name by type", async () => {
    placeOneDrawerCabinets(38, [SIDE_CABINET]);
    renderBuilder();

    fireEvent.click(styleCard("2 Drawer"));
    await screen.findByText("Update Design?");
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(product().placedCabinetStyles).toEqual({ [SIDE_CABINET]: "2" }));
    expect(product().selectedDimensions.height).toBe(56);
    expect(scene.runtime?.calls).toHaveLength(1);
  });

  it("leaves the Slim cabinets as they are when the user cancels", async () => {
    placeOneDrawerCabinets(28);
    renderBuilder();

    fireEvent.click(styleCard("2 Drawer"));
    await screen.findByText("Update Design?");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(scene.runtime?.calls ?? []).toEqual([]);
    expect(product().placedCabinetStyles).toEqual({ [SINK_BASE]: "1", [SIDE_CABINET]: "1" });
    expect(product().selectedDimensions.height).toBe(28);
  });
});

describe("Urban Duplex side cabinets of other series", () => {
  it("offers the Side Cabinet of each series under its name, and the Sink Base without headings", () => {
    placeCabinets(53);
    const { unmount } = renderBuilder();

    expect(seriesHeadings()).toEqual(["Urban Duplex", "Urban Standard", "Urban Low Height"]);
    const titlesOf = (series: string) =>
      cardsOf(series)
        .getAllByRole("button")
        .map((card) => card.getAttribute("aria-label"));
    expect(titlesOf("Urban Duplex")).toEqual(["2 Drawer", "1 Drawer", "1 Drawer With Inner Drawer"]);
    expect(titlesOf("Urban Standard")).toEqual(["2 Drawer", "1 Drawer", "1 Drawer With Inner Drawer"]);
    expect(titlesOf("Urban Low Height")).toEqual(["1 Drawer"]);
    // Each series has its own picture of the style.
    const picture = (series: string) => styleCard("1 Drawer", series).querySelector("img")?.getAttribute("src");
    expect(picture("Urban Duplex")).toContain("images/cabinet-style/1-drawer.png");
    expect(picture("Urban Standard")).toContain("images/cabinet-style/urban-standard-1-drawer.png");
    expect(picture("Urban Low Height")).toContain("images/cabinet-style/urban-low-height-1-drawer.png");
    unmount();

    // Only the Side Cabinet comes from other series.
    store.dispatch(setActiveCabinetType("Sink-Base"));
    renderBuilder();
    expect(seriesHeadings()).toEqual([]);
    expect(screen.getAllByRole("button", { name: /Drawer/ }).map((card) => card.getAttribute("aria-label"))).toEqual([
      "2 Drawer",
      "1 Drawer",
      "1 Drawer With Inner Drawer",
    ]);
  });

  it("adds a cabinet of the series of the card, in the widths of that series", () => {
    placeCabinets(53);
    renderBuilder();

    // 53 cm beside 53 cm: nothing to ask.
    expect(isRestricted("1 Drawer", "Urban Standard")).toBe(false);
    fireEvent.click(styleCard("1 Drawer With Inner Drawer", "Urban Standard"));

    expect(product().selectedProductConfig).toMatchObject({ Drawers: "1DWID", Series: "URSTD" });
    expect(enabledWidths()).toEqual([25, 35, 50, 60, 70, 80, 90, 105, 120]);
    expect(scene.runtime?.calls ?? []).toEqual([]);

    // A card of the collection puts its own series back, with its own widths.
    fireEvent.click(styleCard("1 Drawer", "Urban Duplex"));
    expect(product().selectedProductConfig).toMatchObject({ Drawers: "1D", Series: "URDPX" });
    expect(enabledWidths()).toEqual([60, 70, 80, 90, 105, 120]);
  });

  it("asks before a style of a series that does not come in the height of the placed cabinets", () => {
    placeCabinets(53);
    renderBuilder();

    // Urban Low Height is 38 or 28 cm; two drawers are 56 cm in both series.
    expect(isRestricted("1 Drawer", "Urban Low Height")).toBe(true);
    expect(isRestricted("2 Drawer", "Urban Standard")).toBe(true);
    expect(isRestricted("1 Drawer", "Urban Standard")).toBe(false);
  });

  it("lowers the one-drawer cabinets to 38 cm for an Urban Low Height cabinet, their drawers as they are", async () => {
    placeCabinets(53);
    renderBuilder();

    fireEvent.click(styleCard("1 Drawer", "Urban Low Height"));
    await screen.findByText("Update Design?");
    expect(scene.runtime?.calls ?? []).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(product().selectedDimensions.height).toBe(38));
    // One step back, and one change for the scene: the height, the nearer of the two.
    expect(scene.saveSnapshot).toHaveBeenCalledTimes(1);
    expect(sceneChanges().map(({ attributeId, value }) => [attributeId, value])).toEqual([["Height", 38]]);
    expect(product().placedCabinetStyles).toEqual({ [SINK_BASE]: "1", [SIDE_CABINET]: "1" });
    // The cabinet being added is the Urban Low Height one.
    expect(product().selectedProductConfig).toMatchObject({ Drawers: "1D", Series: "URLH" });
  });

  it("takes two-drawer cabinets to one drawer and on to 38 cm for an Urban Low Height cabinet", async () => {
    placeCabinets(56, { style: "2" });
    renderBuilder();

    fireEvent.click(styleCard("1 Drawer", "Urban Low Height"));
    await screen.findByText("Update Design?");
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(product().selectedDimensions.height).toBe(38));
    expect(product().placedCabinetStyles).toEqual({ [SINK_BASE]: "1", [SIDE_CABINET]: "1" });
    expect(scene.saveSnapshot).toHaveBeenCalledTimes(1);
    const changes = sceneChanges().map(({ attributeId, value }) => [attributeId, value]);
    expect(changes.filter(([attributeId]) => attributeId === "Drawers")).toEqual([
      ["Drawers", "1"],
      ["Drawers", "1"],
    ]);
    // The composition ends at a height of the series, not at the 53 cm of the collection's one drawer.
    expect(changes.filter(([attributeId]) => attributeId === "Height").at(-1)).toEqual(["Height", 38]);
    expect(product().selectedProductConfig).toMatchObject({ Series: "URLH" });
  });

  it("raises Slim cabinets to 53 cm for an Urban Standard one-drawer cabinet", async () => {
    placeCabinets(28);
    renderBuilder();

    fireEvent.click(styleCard("1 Drawer", "Urban Standard"));
    await screen.findByText("Update Design?");
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(product().selectedDimensions.height).toBe(53));
    expect(sceneChanges().map(({ attributeId, value }) => [attributeId, value])).toEqual([["Height", 53]]);
    expect(product().selectedProductConfig).toMatchObject({ Drawers: "1D", Series: "URSTD" });
  });

  it("does not offer a style a placed cabinet of another series cannot follow", () => {
    // An Urban Standard one-drawer side cabinet stands beside the sink base: 53 cm only.
    placeCabinets(53, { series: { [SIDE_CABINET]: "URSTD" } });
    renderBuilder();

    const isOff = (title: string, series: string) => styleCard(title, series).getAttribute("aria-disabled") === "true";
    // The two series share no height.
    expect(isOff("1 Drawer", "Urban Low Height")).toBe(true);
    // The card says which cabinet stands in the way.
    fireEvent.mouseEnter(
      styleCard("1 Drawer", "Urban Low Height").closest('[class*="productStyleItem"]') as HTMLElement,
    );
    expect(screen.getByText("Not available with the Urban Standard cabinet in this design.")).toBeTruthy();
    // It follows to two drawers, which are 56 cm in its series too, after asking.
    expect(isOff("2 Drawer", "Urban Duplex")).toBe(false);
    expect(isRestricted("2 Drawer", "Urban Duplex")).toBe(true);
    expect(isOff("1 Drawer", "Urban Duplex")).toBe(false);
    expect(isRestricted("1 Drawer", "Urban Duplex")).toBe(false);
  });

  it("keeps a composition with an Urban Low Height cabinet at one drawer", () => {
    placeCabinets(38, { series: { [SIDE_CABINET]: "URLH" } });
    renderBuilder();

    const isOff = (title: string, series: string) => styleCard(title, series).getAttribute("aria-disabled") === "true";
    expect(isOff("1 Drawer", "Urban Duplex")).toBe(false);
    expect(isOff("1 Drawer", "Urban Low Height")).toBe(false);
    // It has no two drawers and no inner drawer, and Urban Standard is not 38 cm.
    expect(isOff("2 Drawer", "Urban Duplex")).toBe(true);
    expect(isOff("1 Drawer With Inner Drawer", "Urban Duplex")).toBe(true);
    for (const title of ["2 Drawer", "1 Drawer", "1 Drawer With Inner Drawer"]) {
      expect(isOff(title, "Urban Standard")).toBe(true);
    }
  });
});
