// @vitest-environment jsdom
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ulhManifest from "../../../../../public/collections/urban-low-height/manifest.json";
import ulhProfileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";
import ulhUi from "../../../../../public/collections/urban-low-height/ui.json";
import { store } from "@/app/store";
import { parseProductProfile, ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import cabinetTable580 from "@/entities/collection/__tests__/fixtures/remote/datatable-580.json";
import { ulhRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import { resetConfiguration, setActiveCollectionId, setActiveRuntimeBindings } from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  recordComposition,
  reset,
  setActiveCabinetType,
  setActiveProfile,
  setCabinetCatalog,
  setCountertopStyle,
  setHasBootstrappedCabinetBuilder,
  setSelectedDimensions,
} from "@/entities/product/model/store/slice";

import { CabinetBuilderPage } from "../CabinetBuilderPage";

/**
 * Urban Low Height places its own scene products, named after the scene type
 * (`ULH-sink-cabinet-…`), not after the cabinet type: a placed Sink Base still lets an Open Shelf
 * go beside it, as a placed Side Cabinet does.
 *
 * Its cards show the handle the height stands for (product map §2): the upper groove at 38 and
 * 28 cm, push-to-open at 35 and 25 cm. The Sink Base drawer card also shows the countertop style.
 */

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => false }));
vi.mock("@/utils/functions/playcanvas/emptyButton", () => ({ showEmptyButton: vi.fn(), hideEmptyButton: vi.fn() }));
vi.mock("@/features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar", () => ({
  RightCabinetStyleSidebar: () => null,
}));
vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: ({ children, title }: { children: ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

const ulhProfile = (() => {
  const result = parseProductProfile(ulhProfileDocument);
  if (!result.ok) throw new Error("Urban Low Height profile must parse");

  return result.profile;
})();

const ulhCollection = buildReadyCollection("urban-low-height", ulhManifest, ulhUi);
const catalog = buildCabinetCatalogFromMatrix(cabinetTable580 as ProductDatatable, ulhProfile);
const IMAGES = "https://app.test/collections/urban-low-height/images";

const card = (title: string) =>
  screen.getByText(title).closest('[class*="productOption"], [class*="productStyleItem"]');

const isOffered = (title: string) => !card(title)?.className.includes("disabledOption");

const cardImage = (title: string) => card(title)?.querySelector("img")?.getAttribute("src");

const renderBuilder = () =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/custom/cabinet-builder?collectionId=urban-low-height"]}>
        <ReadyCollectionContext.Provider value={ulhCollection}>
          <CabinetBuilderPage />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(ulhProfile));
  store.dispatch(setActiveCollectionId("urban-low-height"));
  store.dispatch(setActiveRuntimeBindings(ulhRuntimeBindings));
  store.dispatch(setCabinetCatalog(catalog));
});

afterEach(cleanup);

describe("Urban Low Height cabinet types", () => {
  it("offers the Open Shelf beside a placed ULH Sink Base", () => {
    store.dispatch(setHasBootstrappedCabinetBuilder(true));
    store.dispatch(recordComposition({ productIds: ["ULH-sink-cabinet-k3j4h5g6f"] }));
    renderBuilder();

    expect(isOffered("Open Shelf")).toBe(true);
  });

  it("keeps the Open Shelf closed until a Sink Base or Side Cabinet is placed", () => {
    renderBuilder();

    expect(isOffered("Sink Base")).toBe(true);
    expect(isOffered("Side Cabinet")).toBe(true);
    expect(isOffered("Open Shelf")).toBe(false);
  });
});

describe("Urban Low Height cabinet pictures", () => {
  it("shows the cabinets with the upper groove while no push-to-open height is chosen", () => {
    renderBuilder();

    expect(cardImage("Sink Base")).toBe(`${IMAGES}/cabinet/sink-base-upper-groove.png`);
    expect(cardImage("Side Cabinet")).toBe(`${IMAGES}/cabinet/side-cabinet-upper-groove.png`);
    expect(cardImage("Open Shelf")).toBe(`${IMAGES}/cabinet/open-shelf.png`);
  });

  it("shows the push-to-open cabinets at a push-to-open height", () => {
    store.dispatch(setActiveCabinetType("Side-Cabinet"));
    store.dispatch(setSelectedDimensions({ height: 25 }));
    renderBuilder();

    expect(cardImage("Sink Base")).toBe(`${IMAGES}/cabinet/sink-base-pto.png`);
    expect(cardImage("Side Cabinet")).toBe(`${IMAGES}/cabinet/side-cabinet-pto.png`);
    expect(cardImage("1 Drawer")).toBe(`${IMAGES}/cabinet/side-cabinet-pto.png`);
  });

  it("shows the integrated Sink Base on the drawer card once Sink Base is chosen", () => {
    store.dispatch(setActiveCabinetType("Sink-Base"));
    store.dispatch(setSelectedDimensions({ height: 38 }));
    renderBuilder();

    expect(cardImage("1 Drawer")).toBe(`${IMAGES}/cabinet/sink-base-integrated.png`);
  });

  it("shows the vessel Sink Base on the drawer card with a vessel countertop", () => {
    store.dispatch(setActiveCabinetType("Sink-Base"));
    store.dispatch(setSelectedDimensions({ height: 38 }));
    store.dispatch(setCountertopStyle("vessel"));
    renderBuilder();

    expect(cardImage("1 Drawer")).toBe(`${IMAGES}/cabinet/sink-base-vessel.png`);
  });
});
