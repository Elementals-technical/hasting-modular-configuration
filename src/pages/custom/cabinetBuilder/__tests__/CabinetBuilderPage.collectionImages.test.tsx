// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildReadyUshCollection,
  renderWithUshCollection,
} from "@/features/collectionCustomization/__tests__/testUtils/renderWithUshCollection";
import { store } from "@/app/store";
import cabinetTable439 from "@/entities/collection/__tests__/fixtures/remote/datatable-439.json";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { resetConfiguration, setActiveCollectionId } from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  reset,
  setActiveCabinetType,
  setActiveProfile,
  setCabinetCatalog,
  setPlacedCabinetStyle,
  setSelectedDimensions,
} from "@/entities/product/model/store/slice";

import { CabinetBuilderPage } from "../CabinetBuilderPage";

/**
 * The cabinet cards take their picture and their label from the active collection: USH declares
 * both in its own ui.json and product-profile.json, so nothing in the page names a cabinet type,
 * a drawers value or a height.
 */

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => false }));
vi.mock("@/utils/functions/playcanvas/emptyButton", () => ({ showEmptyButton: vi.fn(), hideEmptyButton: vi.fn() }));
vi.mock("@/features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar", () => ({
  RightCabinetStyleSidebar: () => null,
}));
// The real accordion hides its closed panel, and both grids are asserted on at once.
vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: ({ children, title }: { children: ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

const readyUsh = buildReadyUshCollection();
const catalog = buildCabinetCatalogFromMatrix(cabinetTable439 as ProductDatatable, ushProfile);

const COLLECTION_IMAGES = "https://app.test/collections/urban-standard-height/images/cabinet";

/** Card titles of a grid, in the order they are laid out. */
const cardTitles = (label: string) =>
  [...screen.getByLabelText(label).querySelectorAll('[class*="title"]')].map((node) => node.textContent?.trim());

/** The card of a title: a type card or a style card, available or disabled. */
const card = (title: string) =>
  screen.getByText(title).closest('[class*="productOption"], [class*="productStyleItem"]');

const cardDesc = (title: string) => card(title)?.querySelector('[class*="desc"]')?.textContent;

const cardImage = (title: string) => card(title)?.querySelector("img")?.getAttribute("src");

const renderBuilder = () =>
  renderWithUshCollection(<CabinetBuilderPage />, {
    data: readyUsh,
    initialPath: "/custom/cabinet-builder?collectionId=urban-standard-height",
  });

describe("cabinet cards are drawn from the active collection", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(setActiveCollectionId("urban-standard-height"));
    store.dispatch(setCabinetCatalog(catalog));
  });

  afterEach(cleanup);

  it("orders the type cards and labels them as the collection does", () => {
    renderBuilder();

    expect(cardTitles("Cabinet Type")).toEqual(["Sink Base", "Side Cabinet", "Open Shelf", "Side Shelf"]);
    expect(cardDesc("Sink Base")).toBe("Cabinet with a basin");
    expect(cardDesc("Side Cabinet")).toBe("Cabinet without a basin");
    expect(cardDesc("Open Shelf")).toBe("");
  });

  it("labels the style cards with the profile's own labels", () => {
    store.dispatch(setActiveCabinetType("Sink-Base"));
    renderBuilder();

    const styles = screen.getByLabelText("Cabinet Style");
    expect(styles.textContent).toContain("2 Drawer");
    expect(styles.textContent).toContain("1 Drawer With Inner Drawer");
  });

  it("shows the central-groove picture the collection declares for two drawers at 53", () => {
    store.dispatch(setActiveCabinetType("Sink-Base"));
    store.dispatch(setSelectedDimensions({ height: 53 }));
    renderBuilder();

    expect(cardImage("2 Drawer")).toBe(`${COLLECTION_IMAGES}/sink-base/SinkBase2D_centralG.png`);
  });

  it("shows the push-to-open picture at the height that stands for that handle", () => {
    store.dispatch(setActiveCabinetType("Sink-Base"));
    store.dispatch(setSelectedDimensions({ height: 50 }));
    renderBuilder();

    expect(cardImage("2 Drawer")).toBe(`${COLLECTION_IMAGES}/sink-base/SinkBase2D_PTO.png`);
  });

  it("shows the plain type picture while nothing is placed", () => {
    renderBuilder();

    expect(cardImage("Sink Base")).toBe(`${COLLECTION_IMAGES}/sink-base/SinkBase2D_upperG.png`);
  });

  it("shows the type picture of the drawers the composition already stands for", () => {
    store.dispatch(setPlacedCabinetStyle({ id: "Sink-Base-1", value: "2" }));
    store.dispatch(setActiveCabinetType("Sink-Base"));
    store.dispatch(setSelectedDimensions({ height: 53 }));
    renderBuilder();

    expect(cardImage("Sink Base")).toBe(`${COLLECTION_IMAGES}/sink-base/SinkBase2D_centralG.png`);
    expect(cardImage("Side Cabinet")).toBe(`${COLLECTION_IMAGES}/side-cabinet/SinkBase2D_centralG.png`);
  });

  it("falls back to the plain picture when no variant row matches", () => {
    store.dispatch(setActiveCabinetType("Sink-Cabinet"));
    store.dispatch(setSelectedDimensions({ height: 56 }));
    renderBuilder();

    expect(cardImage("2 Drawer")).toBe(`${COLLECTION_IMAGES}/side-cabinet/SideCabinet2D_upperG.png`);
  });
});
