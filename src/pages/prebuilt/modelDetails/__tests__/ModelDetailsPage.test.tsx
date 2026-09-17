// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { buildReadyFixtureCollection } from "@/entities/collection/__tests__/fixtures/renderWithFixtureCollection";
import { ReadyCollectionContext } from "@/entities/collection";

import { ModelDetailsPage } from "../ModelDetailsPage";

afterEach(cleanup);

const renderDetails = (modelId: string) =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/prebuilt/model/${modelId}`]}>
        <ReadyCollectionContext.Provider value={buildReadyFixtureCollection("fixture-ui")}>
          <Routes>
            <Route path="/prebuilt/model/:modelId" element={<ModelDetailsPage />} />
          </Routes>
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );

describe("ModelDetailsPage against a non-USH collection", () => {
  it("finds the preset by the numeric ID from a fixture collection's own catalog", () => {
    renderDetails("901");

    expect(screen.getByAltText('Fixture UI · 31" Demo image')).toBeTruthy();
  });

  it("falls back to a generic label for an ID not in the collection's catalog", () => {
    renderDetails("999999");

    expect(screen.getByAltText("Model image")).toBeTruthy();
  });
});
