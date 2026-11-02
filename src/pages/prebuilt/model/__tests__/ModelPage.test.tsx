// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { buildReadyFixtureCollection } from "@/entities/collection/__tests__/fixtures/renderWithFixtureCollection";
import { resetConfiguration } from "@/entities/configuration";
import { getProductsPresets } from "@/entities/product/model/store/selectors";
import { reset } from "@/entities/product/model/store/slice";

import { ModelPage } from "../ModelPage";

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => false }));

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const renderModelPage = ({ presetsDocument, extra }: { presetsDocument?: unknown; extra?: ReactNode } = {}) =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/fixture/models?collectionId=fixture-ui"]}>
        <ReadyCollectionContext.Provider value={buildReadyFixtureCollection("fixture-ui", { presetsDocument })}>
          <ModelPage />
          {extra}
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );

describe("ModelPage against a non-USH collection", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
  });

  afterEach(cleanup);

  it("shows exactly the one preset fixture-ui declares, not a hardcoded USH-shaped catalog", () => {
    renderModelPage();

    expect(screen.getAllByText("Product Details")).toHaveLength(1);
  });

  it("shows the collection's own empty-catalog message instead of a fallback to USH", async () => {
    renderModelPage({ presetsDocument: [] });

    expect(await screen.findByText("No preset compositions available for Fixture UI Collection")).toBeTruthy();
    expect(screen.queryByText("Product Details")).toBeNull();
  });

  // The collection lives in the URL: an address without it reads as another collection.
  it("opens Product Details in the collection of the session", async () => {
    renderModelPage({ extra: <LocationProbe /> });

    fireEvent.click(screen.getByText("Product Details"));

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("/fixture/models/901?collectionId=fixture-ui"),
    );
  });

  it("Customize carries the picked preset's products into Custom and leaves the Prebuilt flow", async () => {
    renderModelPage({ extra: <LocationProbe /> });

    fireEvent.click(await screen.findByText("Customize"));

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/custom?collectionId=fixture-ui"));

    expect(getProductsPresets(store.getState())).toEqual([
      {
        name: "Fixture-Cabinet",
        Width: 79,
        CabinetColor: "Fixture Blue",
        fixtureExtension: "retained",
      },
    ]);
  });
});

describe("ModelPage filters", () => {
  const presetOf = (id: number, size: string, style: string[]) => ({
    id,
    img: "images/fixture-ui.svg",
    title: `Model ${id}`,
    isProductModel: true,
    presetProducts: [{ name: "Fixture-Cabinet", Width: 79 }],
    size,
    style,
  });
  const PRESETS = [presetOf(901, "30_39", ["1_drawer", "single_basin"]), presetOf(902, "40_49", ["2_drawer"])];

  const openFilter = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
  const optionNamed = (label: string) => screen.getAllByRole("option").find((option) => option.textContent === label);
  const optionLabels = () => screen.getAllByRole("option").map((option) => option.textContent);

  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
  });

  afterEach(cleanup);

  it("offers only the sizes and styles the collection's models have", () => {
    renderModelPage({ presetsDocument: PRESETS });

    openFilter("Size");
    expect(optionLabels()).toEqual(["All", "30–39″", "40–49″"]);
    openFilter("Size");

    openFilter("Style");
    expect(optionLabels()).toEqual(["All", "1 Drawer", "2 Drawer", "Single Basin"]);
  });

  it("disables a value that leaves no model with the other filter, so no choice ends empty", () => {
    renderModelPage({ presetsDocument: PRESETS });

    openFilter("Size");
    fireEvent.click(optionNamed("30–39″") as HTMLElement);
    expect(screen.getAllByText("Product Details")).toHaveLength(1);

    openFilter("Style");
    expect(optionNamed("1 Drawer")?.getAttribute("aria-disabled")).toBe("false");
    expect(optionNamed("2 Drawer")?.getAttribute("aria-disabled")).toBe("true");
    expect(optionNamed("All")?.getAttribute("aria-disabled")).not.toBe("true");
  });

  it("shows no filter for a collection without models", async () => {
    renderModelPage({ presetsDocument: [] });

    await screen.findByText("No preset compositions available for Fixture UI Collection");
    expect(screen.queryByRole("button", { name: "Size" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Style" })).toBeNull();
  });
});
