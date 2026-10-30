// @vitest-environment jsdom
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import classManifest from "../../../../../public/collections/class/manifest.json";
import classProfileDocument from "../../../../../public/collections/class/product-profile.json";
import classUi from "../../../../../public/collections/class/ui.json";
import { store } from "@/app/store";
import { parseProductProfile, ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import cabinetTable579 from "@/entities/collection/__tests__/fixtures/remote/datatable-579.json";
import { resetConfiguration, setActiveCollectionId } from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  reset,
  setActiveCabinetType,
  setActiveProfile,
  setCabinetCatalog,
  setPlacedCabinetStyle,
} from "@/entities/product/model/store/slice";

import { CabinetBuilderPage } from "../CabinetBuilderPage";

/**
 * Class draws its own cabinets: the type card follows the drawers already placed, the style card
 * shows the bare cabinet of each drawers value.
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

const classProfile = (() => {
  const result = parseProductProfile(classProfileDocument);
  if (!result.ok) throw new Error("Class profile must parse");

  return result.profile;
})();

const classCollection = buildReadyCollection("class", classManifest, classUi);
const catalog = buildCabinetCatalogFromMatrix(cabinetTable579 as ProductDatatable, classProfile);
const IMAGES = "https://app.test/collections/class/images";

const card = (title: string) =>
  screen.getByText(title).closest('[class*="productOption"], [class*="productStyleItem"]');

const cardImage = (title: string) => card(title)?.querySelector("img")?.getAttribute("src");

const renderBuilder = () =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/custom/cabinet-builder?collectionId=class"]}>
        <ReadyCollectionContext.Provider value={classCollection}>
          <CabinetBuilderPage />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );

describe("Class cabinet cards", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(classProfile));
    store.dispatch(setActiveCollectionId("class"));
    store.dispatch(setCabinetCatalog(catalog));
  });

  afterEach(cleanup);

  it("offers only the cabinet types of Class's own table", () => {
    renderBuilder();

    expect(card("Sink Base")).not.toBeNull();
    expect(card("Side Cabinet")).not.toBeNull();
    expect(screen.queryByText("Open Shelf")).toBeNull();
    expect(screen.queryByText("Side Shelf")).toBeNull();
  });

  it("shows the two-drawer cabinets while nothing is placed", () => {
    renderBuilder();

    expect(cardImage("Sink Base")).toBe(`${IMAGES}/cabinet/sink-base-2-drawer.png`);
    expect(cardImage("Side Cabinet")).toBe(`${IMAGES}/cabinet/side-cabinet-2-drawer.png`);
  });

  it("follows the drawers the composition already stands for", () => {
    store.dispatch(setActiveCabinetType("Sink-Base"));
    store.dispatch(setPlacedCabinetStyle({ id: "Sink-Base-1", value: "1" }));
    renderBuilder();

    expect(cardImage("Sink Base")).toBe(`${IMAGES}/cabinet/sink-base-1-drawer.png`);
    expect(cardImage("Side Cabinet")).toBe(`${IMAGES}/cabinet/side-cabinet-1-drawer.png`);
  });

  it("draws a composition on the inner drawer as a one-drawer one", () => {
    store.dispatch(setActiveCabinetType("Sink-Base"));
    store.dispatch(setPlacedCabinetStyle({ id: "Sink-Base-1", value: "1+inner" }));
    renderBuilder();

    expect(cardImage("Sink Base")).toBe(`${IMAGES}/cabinet/sink-base-1-drawer.png`);
    expect(cardImage("Side Cabinet")).toBe(`${IMAGES}/cabinet/side-cabinet-1-drawer.png`);
  });

  it("shows the bare cabinet of each drawers value", () => {
    store.dispatch(setActiveCabinetType("Sink-Base"));
    renderBuilder();

    expect(cardImage("1 Drawer")).toBe(`${IMAGES}/cabinet/drawers-1.png`);
    expect(cardImage("2 Drawer")).toBe(`${IMAGES}/cabinet/drawers-2.png`);
    expect(cardImage("1 Drawer With Inner Drawer")).toBe(`${IMAGES}/cabinet/drawers-1.png`);
  });
});
