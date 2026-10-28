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
 * Client feedback for Tricot, Cabinet Color | Price Filter: "Standard $ – all Lacquered MT colors",
 * "Classic $$ – all Wood Veneer colors". The grid and its full mode filter the same colours.
 */

vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: ({ children, title }: { children: ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
}));
vi.mock("@/shared/ui/Accordion/useCompactAccordionViewport");

const cabinetColors = configurator12.availableOptions
  .filter(({ proxyName }) => proxyName === "Select Cabinet Color")
  .flatMap(({ options }) =>
    options.flatMap(({ variants }) => variants.map(({ name, metadata }) => ({ name, metadata }))),
  );
const coloursOf = (sku: string) => cabinetColors.filter(({ metadata }) => metadata.sku === sku).map(({ name }) => name);
const LACQUERED_MT = coloursOf("LACM");
const WOOD_VENEER = coloursOf("WDV");

const renderColorStep = () => {
  const collection = buildReadyCollection("tricot", tricotManifestDocument, tricotUiDocument);

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/prebuilt/color?collectionId=tricot"]}>
        <ReadyCollectionContext.Provider
          value={{ ...collection, catalog: { ...collection.catalog, configurator: tricotConfigurator } }}
        >
          <FieldsStepPage stepId="color" />
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

describe("Tricot Cabinet Color price filter", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(tricotProfile));
  });

  afterEach(cleanup);

  it("has 20 Lacquered MT and 3 Wood Veneer colours to rank", () => {
    expect([LACQUERED_MT.length, WOOD_VENEER.length]).toEqual([20, 3]);
  });

  it("shows every Lacquered MT colour under Standard $ and every Wood Veneer one under Classic $$", () => {
    renderColorStep();
    const section = screen.getByRole("region", { name: "Cabinet Color" });

    pickPrice(section, "Price", "Standard $");
    expect(shownColours(section)).toEqual(expect.arrayContaining(LACQUERED_MT));
    expect(shownColours(section)).toHaveLength(LACQUERED_MT.length);

    pickPrice(section, "Standard $", "Classic $$");
    expect(shownColours(section).sort()).toEqual([...WOOD_VENEER].sort());
  });

  it("offers no price tier other than Standard $ and Classic $$", () => {
    renderColorStep();
    const section = screen.getByRole("region", { name: "Cabinet Color" });

    fireEvent.click(within(section).getByRole("button", { name: "Price" }));
    const tiers = within(screen.getByRole("listbox", { name: "Price" }))
      .getAllByRole("option")
      .map((option) => option.firstElementChild?.textContent);

    expect(tiers).toEqual(["Show all", "Standard $", "Classic $$"]);
  });

  it("filters the same colours in full mode as in the grid", () => {
    renderColorStep();
    fireEvent.click(within(screen.getByRole("region", { name: "Cabinet Color" })).getByText("View in full mode"));
    const dialog = screen.getByRole("dialog", { name: "Cabinet Color" });

    pickPrice(dialog, "Price", "Standard $");
    expect(shownColours(dialog).sort()).toEqual([...LACQUERED_MT].sort());

    pickPrice(dialog, "Standard $", "Classic $$");
    expect(shownColours(dialog).sort()).toEqual([...WOOD_VENEER].sort());
  });
});
