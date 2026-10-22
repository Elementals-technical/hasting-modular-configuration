// @vitest-environment jsdom
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ulhManifest from "../../../../../public/collections/urban-low-height/manifest.json";
import ulhProfileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";
import ulhUi from "../../../../../public/collections/urban-low-height/ui.json";
import { store } from "@/app/store";
import { parseProductProfile, ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import cabinetTable580 from "@/entities/collection/__tests__/fixtures/remote/datatable-580.json";
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
  recordComposition,
  replaceCollectionData,
  reset,
  setActiveCabinetType,
  setDrawerProduct,
  setHasBootstrappedCabinetBuilder,
  setSelectedDimensions,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { ReasonTextProvider } from "@/features/collectionCustomization";
import { ensureCabinetHeights, type TestRuntimePort } from "@/features/playCanvasAdapter";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";

import { CabinetBuilderPage } from "../CabinetBuilderPage";

/**
 * Urban Low Height shows its one-drawer cabinet as two models, the taller one and the Slim
 * (`cabinetStyle.heightStyles`): 38 and 28 cm with the upper groove, 35 and 25 cm with push-to-open.
 * Before anything is placed either sets the height of the first cabinet. Placed cabinets share a
 * height: the model they stand at is the card that adds a cabinet, the other one is greyed and
 * switches every cabinet to its height once the user approves.
 */

const scene = vi.hoisted(() => ({
  runtime: null as TestRuntimePort | null,
  // Each undo step the page takes runs its change; the step's own rules are useHistoryStep's tests.
  runStep: vi.fn(<T,>(change: () => Promise<T>) => change()),
}));

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => false }));
vi.mock("@/utils/functions/playcanvas/emptyButton", () => ({ showEmptyButton: vi.fn(), hideEmptyButton: vi.fn() }));
vi.mock("@/entities/history/lib/useHistoryStep", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/entities/history/lib/useHistoryStep")>()),
  useHistoryStep: () => ({ run: scene.runStep }),
}));
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
    ensureCabinetHeights: vi.fn(async () => ({ resent: [] })),
  };
});

const parsedProfile = parseProductProfile(ulhProfileDocument);
if (!parsedProfile.ok) throw new Error("the packaged Urban Low Height profile must parse");
const profile = parsedProfile.profile;
// Built as the loader builds it, with the scene product of each cabinet type.
const catalog = buildCabinetCatalogFromMatrix(cabinetTable580 as ProductDatatable, profile, ulhRuntimeBindings);
const IMAGES = "https://app.test/collections/urban-low-height/images";

const UPPER_GROOVE = "handle_urban_topcut";
const PUSH_TO_OPEN = "handle_pto";
const SINK_BASE = "ULH-sink-cabinet-test1";
const SIDE_CABINET = "ULH-side-cabinet-test2";

const product = () => store.getState().rootStateUI.product;

/** A Sink Base being added, before anything is placed. */
const chooseSinkBase = (handle = UPPER_GROOVE) => {
  store.dispatch(setActiveCabinetType("Sink-Base"));
  store.dispatch(setDrawerProduct("Sink-Base"));
  store.dispatch(setSelectedProductConfig({ Handle: handle }));
};

/** A Sink Base and a Side Cabinet standing at `height` cm with `handle`; another Sink Base is being added. */
const placeCabinets = (height: number, handle = UPPER_GROOVE) => {
  const placed = [SINK_BASE, SIDE_CABINET];

  store.dispatch(setHasBootstrappedCabinetBuilder(true));
  store.dispatch(
    recordComposition({ productIds: placed, placedCabinetStyles: { [SINK_BASE]: "1", [SIDE_CABINET]: "1" } }),
  );
  store.dispatch(syncCabinets(placed));
  store.dispatch(
    recordSceneState({
      order: placed,
      cabinets: placed.map((runtimeId) => ({ runtimeId, dimensions: { width: 60, height, depth: 46 } })),
    }),
  );
  chooseSinkBase(handle);
  store.dispatch(setSelectedProductConfig({ Handle: handle, Drawers: "1D" }));
  store.dispatch(setSelectedDimensions({ width: 60, depth: 46 }));
  store.dispatch(setSelectedDimensions({ height }));
};

const renderBuilder = (ui: unknown = ulhUi) =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/custom/cabinet-builder?collectionId=urban-low-height"]}>
        <ReadyCollectionContext.Provider value={buildReadyCollection("urban-low-height", ulhManifest, ui)}>
          <ReasonTextProvider>
            <CabinetBuilderPage />
          </ReasonTextProvider>
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );

const styleTitles = () =>
  within(screen.getByRole("region", { name: "Cabinet Style" }))
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label"));
const styleCard = (title: string) => screen.getByRole("button", { name: title });
const cardOf = (title: string) => styleCard(title).closest('[class*="productStyleItem"]') as HTMLElement;
/** A model of another height than the composition's is drawn greyed and asks first. */
const isRestricted = (title: string) => cardOf(title).className.includes("restricted");
const isPressed = (title: string) => styleCard(title).getAttribute("aria-pressed") === "true";
const cardImage = (title: string) => cardOf(title).querySelector("img")?.getAttribute("src");
const detailsOf = (title: string) =>
  within(cardOf(title)).getByText("Product Details").closest("a")?.getAttribute("href");
/** Every change the scene was sent, in order. */
const sceneChanges = () => (scene.runtime?.calls ?? []).flat().map(({ attributeId, value }) => [attributeId, value]);

const approveSwitchTo = async (title: string) => {
  fireEvent.click(styleCard(title));
  await screen.findByText("Update Design?");
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  await waitFor(() => expect(screen.queryByText("Update Design?")).toBeNull());
};

beforeEach(() => {
  scene.runtime = null;
  scene.runStep.mockClear();
  vi.mocked(ensureCabinetHeights).mockClear();

  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setOpenStyleSidebar(false));
  store.dispatch(replaceCollectionData({ profile, cabinetCatalog: catalog }));
  store.dispatch(setActiveCollectionId("urban-low-height"));
  store.dispatch(setActiveRuntimeBindings(ulhRuntimeBindings));
});

afterEach(cleanup);

describe("Urban Low Height cabinet style models in an empty builder", () => {
  it("offers the taller and the Slim model of the one-drawer style, both to choose", () => {
    chooseSinkBase();
    renderBuilder();

    expect(styleTitles()).toEqual(["1 Drawer", "1 Drawer Slim"]);
    expect(isRestricted("1 Drawer")).toBe(false);
    expect(isRestricted("1 Drawer Slim")).toBe(false);
  });

  it("gives the first cabinet the height of the model chosen, sending nothing", () => {
    chooseSinkBase();
    renderBuilder();

    fireEvent.click(styleCard("1 Drawer Slim"));
    expect(product().selectedDimensions.height).toBe(28);
    expect(product().selectedProductConfig).toMatchObject({ Drawers: "1D", Handle: UPPER_GROOVE });

    fireEvent.click(styleCard("1 Drawer"));
    expect(product().selectedDimensions.height).toBe(38);

    // Nothing stands yet: there is nothing to send, and no step to undo.
    expect(scene.runtime?.calls ?? []).toEqual([]);
    expect(scene.runStep).not.toHaveBeenCalled();
  });

  it("marks the model of the height the next cabinet takes, whoever set it", () => {
    chooseSinkBase();
    renderBuilder();

    fireEvent.click(styleCard("1 Drawer Slim"));
    expect(isPressed("1 Drawer Slim")).toBe(true);

    // The sidebar's Height chooses the taller model.
    act(() => {
      store.dispatch(setSelectedDimensions({ height: 38 }));
    });
    expect(isPressed("1 Drawer")).toBe(true);
    expect(isPressed("1 Drawer Slim")).toBe(false);
  });

  it("stands the models at the push-to-open heights with that handle", () => {
    chooseSinkBase(PUSH_TO_OPEN);
    renderBuilder();

    fireEvent.click(styleCard("1 Drawer Slim"));
    expect(product().selectedDimensions.height).toBe(25);
  });
});

describe("Urban Low Height cabinet style models beside placed cabinets", () => {
  it("greys the model the cabinets do not stand at, and explains why", () => {
    placeCabinets(38);
    renderBuilder();

    expect(isRestricted("1 Drawer")).toBe(false);
    expect(isRestricted("1 Drawer Slim")).toBe(true);

    fireEvent.mouseEnter(cardOf("1 Drawer Slim"));
    expect(
      screen.getByText("Cannot mix 1 Drawer and 1 Drawer Slim cabinet styles in one vanity configuration."),
    ).toBeTruthy();
  });

  it("leaves the cabinets as they are when the user cancels", async () => {
    placeCabinets(38);
    renderBuilder();

    fireEvent.click(styleCard("1 Drawer Slim"));
    await screen.findByText("Update Design?");
    expect(screen.getByText("1 Drawer Slim", { selector: "strong" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(scene.runtime?.calls ?? []).toEqual([]);
    expect(scene.runStep).not.toHaveBeenCalled();
    expect(product().selectedDimensions.height).toBe(38);
  });

  it("switches every cabinet to the Slim height once the user approves, as one step", async () => {
    placeCabinets(38);
    renderBuilder();

    await approveSwitchTo("1 Drawer Slim");

    expect(product().selectedDimensions.height).toBe(28);
    expect(scene.runStep).toHaveBeenCalledTimes(1);
    expect(scene.runtime?.calls).toEqual([
      [expect.objectContaining({ attributeId: "Height", target: { scope: "global" }, value: 28 })],
    ]);
    // The drawers stay as they are, a cabinet the scene left behind gets the height again, and the
    // next cabinet takes it.
    expect(product().placedCabinetStyles).toEqual({ [SINK_BASE]: "1", [SIDE_CABINET]: "1" });
    expect(vi.mocked(ensureCabinetHeights)).toHaveBeenCalledWith(
      expect.objectContaining({ runtimeIds: [SINK_BASE, SIDE_CABINET], height: 28 }),
    );
    expect(getCabinetBuilderProductConfig(store.getState())?.Height).toBe(28);
    // The Slim is the composition's model now; the taller one switches it back.
    expect(isRestricted("1 Drawer Slim")).toBe(false);
    expect(isRestricted("1 Drawer")).toBe(true);
  });

  it("switches back to the taller model right after", async () => {
    placeCabinets(38);
    renderBuilder();

    await approveSwitchTo("1 Drawer Slim");
    await approveSwitchTo("1 Drawer");

    expect(product().selectedDimensions.height).toBe(38);
    expect(sceneChanges()).toEqual([
      ["Height", 28],
      ["Height", 38],
    ]);
  });

  it("switches cabinets with push-to-open between 35 and 25 cm", async () => {
    placeCabinets(35, PUSH_TO_OPEN);
    renderBuilder();

    expect(isRestricted("1 Drawer")).toBe(false);
    expect(isRestricted("1 Drawer Slim")).toBe(true);

    await approveSwitchTo("1 Drawer Slim");

    expect(product().selectedDimensions.height).toBe(25);
    expect(sceneChanges()).toEqual([["Height", 25]]);
  });

  it("opens the details of each model at its own height", () => {
    placeCabinets(38);
    renderBuilder();

    expect(detailsOf("1 Drawer")).toBe(
      "/custom/cabinet-builder/details/style?style=1&title=1+Drawer&cabinetType=Sink-Base&height=38&collectionId=urban-low-height",
    );
    expect(detailsOf("1 Drawer Slim")).toBe(
      "/custom/cabinet-builder/details/style?style=1&title=1+Drawer+Slim&cabinetType=Sink-Base&height=28&collectionId=urban-low-height",
    );
  });

  it("pictures each model at its own height, where the collection declares a picture for it", () => {
    const slimSinkBase = {
      value: "1",
      when: { CabinetType: "Sink-Base", Height: "28" },
      image: "images/cabinet/sink-base-slim.png",
    };
    placeCabinets(38);
    renderBuilder({
      ...ulhUi,
      optionImageVariants: {
        ...ulhUi.optionImageVariants,
        Drawers: [slimSinkBase, ...ulhUi.optionImageVariants.Drawers],
      },
    });

    expect(cardImage("1 Drawer Slim")).toBe(`${IMAGES}/cabinet/sink-base-slim.png`);
    expect(cardImage("1 Drawer")).toBe(`${IMAGES}/cabinet/sink-base-upper-groove.png`);
  });

  it("keeps one card for the style in a collection that declares no models", () => {
    placeCabinets(38);
    renderBuilder({ ...ulhUi, cabinetStyle: undefined });

    expect(styleTitles()).toEqual(["1 Drawer"]);
    expect(isRestricted("1 Drawer")).toBe(false);
  });
});
