// @vitest-environment jsdom
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import makoManifest from "../../../../../public/collections/mako/manifest.json";
import makoUi from "../../../../../public/collections/mako/ui.json";
import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import cabinetTable581 from "@/entities/collection/__tests__/fixtures/remote/datatable-581.json";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { resetConfiguration, setActiveCollectionId, setAttributeValue } from "@/entities/configuration";
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
 * Mako's cards are its own: the type card follows the drawers already placed, the style card
 * shows the cabinet on the wall until a leg colour is chosen and on legs afterwards. Mako's
 * heights (26 and 52) share nothing with Urban's, so this only works because no height, type or
 * drawers value is named in the code.
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

const makoCollection = buildReadyCollection("mako", makoManifest, makoUi);
const catalog = buildCabinetCatalogFromMatrix(cabinetTable581 as ProductDatatable, makoProfile);
const IMAGES = "https://app.test/collections/mako/images";

const card = (title: string) =>
  screen.getByText(title).closest('[class*="productOption"], [class*="productStyleItem"]');

const cardImage = (title: string) => card(title)?.querySelector("img")?.getAttribute("src");

const renderBuilder = () =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/custom/cabinet-builder?collectionId=mako"]}>
        <ReadyCollectionContext.Provider value={makoCollection}>
          <CabinetBuilderPage />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );

describe("Mako cabinet cards", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(makoProfile));
    store.dispatch(setActiveCollectionId("mako"));
    store.dispatch(setCabinetCatalog(catalog));
  });

  afterEach(cleanup);

  it("shows Mako's own cabinets, not Urban's", () => {
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

  it("hangs the two-drawer style on the wall until a leg colour is chosen", () => {
    store.dispatch(setActiveCabinetType("Sink-Base"));
    renderBuilder();

    expect(cardImage("2 Drawer")).toBe(`${IMAGES}/cabinet/drawers-2.png`);
    expect(cardImage("1 Drawer")).toBe(`${IMAGES}/cabinet/drawers-1.png`);
  });

  it("puts the two-drawer style on legs once a leg colour is chosen", () => {
    store.dispatch(setActiveCabinetType("Sink-Base"));
    store.dispatch(
      setAttributeValue({
        attributeId: "LegColor",
        target: { scope: "cabinet", cabinetId: "cab-1" },
        value: "Silver",
      }),
    );
    renderBuilder();

    expect(cardImage("2 Drawer")).toBe(`${IMAGES}/cabinet/drawers-2-legs.png`);
    expect(cardImage("1 Drawer")).toBe(`${IMAGES}/cabinet/drawers-1.png`);
  });
});
