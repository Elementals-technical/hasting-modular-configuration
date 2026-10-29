// @vitest-environment jsdom

import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import configurator12 from "@/entities/collection/__tests__/fixtures/remote/configurator-12.json";
import tricotManifestDocument from "../../../../public/collections/tricot/manifest.json";
import tricotUiDocument from "../../../../public/collections/tricot/ui.json";
import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import { tricotConfigurator, tricotProfile } from "@/entities/collection/__tests__/tricotFixtures";
import { resetConfiguration } from "@/entities/configuration";
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";

import { FieldsStepPage } from "../FieldsStepPage";

/**
 * The client's 'list material' > Material Pricing Tiers, GB block, for Tricot's colours: Lacquered MT
 * is Classic $$, Wood Veneer Specialty $$$. The grid and its full mode filter the same colours. Handle
 * Groove Color, all Lacquered MT, is Classic $$ alone.
 */

vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: ({ children, title }: { children: ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
}));
vi.mock("@/shared/ui/Accordion/useCompactAccordionViewport");

const variantsOf = (group: string) =>
  configurator12.availableOptions
    .filter(({ proxyName }) => proxyName === group)
    .flatMap(({ options }) =>
      options.flatMap(({ variants }) => variants.map(({ name, metadata }) => ({ name, metadata }))),
    );
const cabinetColors = variantsOf("Select Cabinet Color");
const coloursOf = (sku: string) => cabinetColors.filter(({ metadata }) => metadata.sku === sku).map(({ name }) => name);
const LACQUERED_MT = coloursOf("LACM");
const WOOD_VENEER = coloursOf("WDV");
const GROOVE_COLOURS = variantsOf("Select Handle Groove Color").map(({ name }) => name);

const renderStep = (stepId = "color") => {
  const collection = buildReadyCollection("tricot", tricotManifestDocument, tricotUiDocument);

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/prebuilt/${stepId}?collectionId=tricot`]}>
        <ReadyCollectionContext.Provider
          value={{ ...collection, catalog: { ...collection.catalog, configurator: tricotConfigurator } }}
        >
          <FieldsStepPage stepId={stepId} />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );
};

const pickPrice = (scope: HTMLElement, current: string, tier: string) => {
  fireEvent.click(within(scope).getByRole("button", { name: current }));
  // An option is named by its tier and the tier's description.
  fireEvent.click(within(screen.getByRole("listbox", { name: "Price" })).getByText(tier));
};

const shownColours = (scope: HTMLElement) =>
  cabinetColors.map(({ name }) => name).filter((name) => within(scope).queryAllByText(name).length > 0);

const priceTiersOf = (scope: HTMLElement) => {
  fireEvent.click(within(scope).getByRole("button", { name: "Price" }));
  return within(screen.getByRole("listbox", { name: "Price" }))
    .getAllByRole("option")
    .map((option) => option.firstElementChild?.textContent);
};

describe("Tricot colour price filters", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(tricotProfile));
  });

  afterEach(cleanup);

  it("has 20 Lacquered MT and 3 Wood Veneer colours to rank", () => {
    expect([LACQUERED_MT.length, WOOD_VENEER.length]).toEqual([20, 3]);
  });

  it("shows every Lacquered MT colour under Classic $$ and every Wood Veneer one under Specialty $$$", () => {
    renderStep();
    const section = screen.getByRole("region", { name: "Cabinet Color" });

    pickPrice(section, "Price", "Classic $$");
    expect(shownColours(section)).toEqual(expect.arrayContaining(LACQUERED_MT));
    expect(shownColours(section)).toHaveLength(LACQUERED_MT.length);

    pickPrice(section, "Classic $$", "Specialty $$$");
    expect(shownColours(section).sort()).toEqual([...WOOD_VENEER].sort());
  });

  it("offers no price tier other than Classic $$ and Specialty $$$", () => {
    renderStep();
    const section = screen.getByRole("region", { name: "Cabinet Color" });

    expect(priceTiersOf(section)).toEqual(["Show all", "Classic $$", "Specialty $$$"]);
  });

  it("ranks all 20 Lacquered MT handle groove colours as Classic $$ alone", () => {
    renderStep();
    const section = screen.getByRole("region", { name: "Handle Groove Color" });

    expect(GROOVE_COLOURS).toHaveLength(20);
    expect(priceTiersOf(section)).toEqual(["Show all", "Classic $$"]);
    fireEvent.click(within(screen.getByRole("listbox", { name: "Price" })).getByText("Classic $$"));
    expect(shownColours(section).sort()).toEqual([...GROOVE_COLOURS].sort());
  });

  it("filters the same colours in full mode as in the grid", () => {
    renderStep();
    fireEvent.click(within(screen.getByRole("region", { name: "Cabinet Color" })).getByText("View in full mode"));
    const dialog = screen.getByRole("dialog", { name: "Cabinet Color" });

    pickPrice(dialog, "Price", "Classic $$");
    expect(shownColours(dialog).sort()).toEqual([...LACQUERED_MT].sort());

    pickPrice(dialog, "Classic $$", "Specialty $$$");
    expect(shownColours(dialog).sort()).toEqual([...WOOD_VENEER].sort());
  });

  it("ranks the countertop colours by the client's GB tiers, Matte White under Classic $$", () => {
    renderStep("countertop");
    const section = screen.getByRole("region", { name: "Countertop Color" });

    expect(priceTiersOf(section)).toEqual(["Show all", "Standard $", "Classic $$", "Exclusive $$$$"]);
    fireEvent.click(within(screen.getByRole("listbox", { name: "Price" })).getByText("Classic $$"));
    expect(within(section).getAllByText("Matte White")).not.toHaveLength(0);
  });
});
