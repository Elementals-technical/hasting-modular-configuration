// @vitest-environment jsdom

import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
 * The client's dev feedback for Tricot's countertop (R-TRICOT-CT-003): the Material filter treats Solid
 * Surface as a header and nests its two types under it, Technolite and Technomat. The configurator names
 * a colour's type as its GBMaterial: Matte White is Technolite, Matte White 8cm Technomat.
 */

vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: ({ children, title }: { children: ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
}));
vi.mock("@/shared/ui/Accordion/useCompactAccordionViewport");

const GLASS_COLOURS = (tricotConfigurator.groupsByName["Select Countertop Color"]?.options ?? [])
  .flatMap(({ variants }) => variants)
  .filter(({ metadata }) => metadata.Material === "Glass GL" || metadata.Material === "Glass MT")
  .map(({ metadata }) => metadata.label);

const renderCountertopStep = () => {
  const collection = buildReadyCollection("tricot", tricotManifestDocument, tricotUiDocument);

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/prebuilt/countertop?collectionId=tricot"]}>
        <ReadyCollectionContext.Provider
          value={{ ...collection, catalog: { ...collection.catalog, configurator: tricotConfigurator } }}
        >
          <FieldsStepPage stepId="countertop" />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );
};

const countertopColor = () => screen.getByRole("region", { name: "Countertop Color" });

const shownColours = (scope: HTMLElement) =>
  Array.from(scope.querySelectorAll('button[class*="selectButton"]'), (swatch) =>
    swatch.getAttribute("aria-label"),
  ).sort();

const groupTitles = (scope: HTMLElement) =>
  Array.from(scope.querySelectorAll('[class*="groupTitle"]'), (title) => title.textContent);

const openMaterials = (scope: HTMLElement, current: string) => {
  fireEvent.click(within(scope).getByRole("button", { name: current }));
  return screen.getByRole("listbox", { name: "Material" });
};

const pickMaterial = (scope: HTMLElement, current: string, material: string) =>
  fireEvent.click(within(openMaterials(scope, current)).getByText(material));

const pickSolidSurfaceType = (scope: HTMLElement, current: string, type: string) => {
  const materials = openMaterials(scope, current);
  fireEvent.click(within(materials).getByRole("button", { name: "Expand Solid Surface" }));
  fireEvent.click(within(materials).getByText(type));
};

describe("Tricot countertop Solid Surface types", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(tricotProfile));
  });

  afterEach(cleanup);

  it("nests Technolite and Technomat under the Solid Surface header", () => {
    renderCountertopStep();
    const materials = openMaterials(countertopColor(), "Material");

    fireEvent.click(within(materials).getByRole("button", { name: "Expand Solid Surface" }));

    expect(
      within(materials)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(expect.arrayContaining(["Solid Surface", "Technolite", "Technomat"]));
    expect(within(materials).getAllByText("Solid Surface")).toHaveLength(1);
  });

  it("groups the Solid Surface colours by their type", () => {
    renderCountertopStep();

    expect(groupTitles(countertopColor())).toEqual(expect.arrayContaining(["Technolite", "Technomat"]));
    expect(groupTitles(countertopColor())).not.toContain("Solid Surface");
  });

  it("shows Matte White under Technolite and Matte White 8cm under Technomat", () => {
    renderCountertopStep();
    const section = countertopColor();

    pickSolidSurfaceType(section, "Material", "Technolite");
    expect(shownColours(section)).toEqual(["Matte White"]);
    expect(groupTitles(section)).toEqual(["Technolite"]);

    pickSolidSurfaceType(section, "Technolite", "Technomat");
    expect(shownColours(section)).toEqual(["Matte White 8cm"]);
    expect(groupTitles(section)).toEqual(["Technomat"]);
  });

  it("shows both Solid Surface colours under the header", () => {
    renderCountertopStep();
    const section = countertopColor();

    pickMaterial(section, "Material", "Solid Surface");

    expect(shownColours(section)).toEqual(["Matte White", "Matte White 8cm"]);
    expect(groupTitles(section)).toEqual(["Technolite", "Technomat"]);
  });

  it("shows every glass colour under the Glass header", () => {
    renderCountertopStep();
    const section = countertopColor();

    pickMaterial(section, "Material", "Glass");

    expect(GLASS_COLOURS).toHaveLength(40);
    expect(shownColours(section)).toEqual([...GLASS_COLOURS].sort());
    expect(groupTitles(section)).toEqual(["Glass GL", "Glass MT"]);
  });

  it("filters by the Solid Surface type in full mode as in the grid", () => {
    renderCountertopStep();
    fireEvent.click(within(countertopColor()).getByText("View in full mode"));
    const dialog = screen.getByRole("dialog", { name: "Countertop Color" });

    pickSolidSurfaceType(dialog, "Material", "Technolite");

    expect(shownColours(dialog)).toEqual(["Matte White"]);
    expect(groupTitles(dialog)).toEqual(["Technolite"]);
  });
});
