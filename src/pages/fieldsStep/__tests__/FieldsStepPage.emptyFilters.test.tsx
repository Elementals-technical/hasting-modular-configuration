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
 * A filter with nothing to choose is left out. Configurator 12 names no Look for a Tricot cabinet
 * colour, and does for 23 of its countertop colours.
 */

vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: ({ children, title }: { children: ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
}));
vi.mock("@/shared/ui/Accordion/useCompactAccordionViewport");

const renderStep = (stepId: string) => {
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

const filtersOf = (scope: HTMLElement) =>
  within(scope)
    .getAllByRole("button")
    .filter((button) => button.getAttribute("aria-haspopup") === "listbox")
    .map((button) => button.textContent);

describe("Tricot colour filters", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(tricotProfile));
  });

  afterEach(cleanup);

  it("leave out Look for the cabinet colours, which name no look", () => {
    renderStep("color");

    expect(filtersOf(screen.getByRole("region", { name: "Cabinet Color" }))).toEqual(["Material", "Color", "Price"]);
  });

  it("show Look for the countertop colours, which name one", () => {
    renderStep("countertop");

    expect(filtersOf(screen.getByRole("region", { name: "Countertop Color" }))).toEqual([
      "Material",
      "Color",
      "Look",
      "Price",
    ]);
  });

  it("leave out Look in full mode as well", () => {
    renderStep("color");
    fireEvent.click(within(screen.getByRole("region", { name: "Cabinet Color" })).getByText("View in full mode"));

    expect(filtersOf(screen.getByRole("dialog", { name: "Cabinet Color" }))).toEqual(["Material", "Color", "Price"]);
  });

  it("name the Price filter, which the row keeps at its end whatever filters are left out", () => {
    renderStep("color");

    expect(
      screen.getByRole("region", { name: "Cabinet Color" }).querySelector('[data-filter="Price"]')?.textContent,
    ).toBe("Price");
  });
});
