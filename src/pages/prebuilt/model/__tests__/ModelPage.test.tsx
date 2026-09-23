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
