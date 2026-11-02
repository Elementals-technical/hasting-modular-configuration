// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { buildReadyFixtureCollection } from "@/entities/collection/__tests__/fixtures/renderWithFixtureCollection";
import { resetConfiguration } from "@/entities/configuration";
import { addProductPreset, recordComposition, reset } from "@/entities/product/model/store/slice";

import { ModelPage } from "../ModelPage";

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => false }));

const presetOf = (id: number, title: string, width: number) => ({
  id,
  img: "images/fixture-ui.svg",
  title,
  isProductModel: true,
  presetProducts: [{ name: "Fixture-Cabinet", Width: width }],
  size: "30_39",
  style: [],
});

const FIRST = "First model";
const SECOND = "Second model";
const PRESETS_DOCUMENT = [presetOf(901, FIRST, 79), presetOf(902, SECOND, 60)];

const renderModelPage = (search = "") =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/fixture/models?collectionId=fixture-ui${search}`]}>
        <ReadyCollectionContext.Provider
          value={buildReadyFixtureCollection("fixture-ui", { presetsDocument: PRESETS_DOCUMENT })}
        >
          <ModelPage />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );

/** The titles of the highlighted cards. */
const highlightedCards = () =>
  [FIRST, SECOND].filter((title) =>
    /active/.test(screen.getByText(title).closest('[class*="productModelItem"]')?.className ?? ""),
  );

describe("ModelPage highlights the card of the model the scene holds", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
  });

  afterEach(cleanup);

  it("highlights the default card on first load, before anything is placed", () => {
    renderModelPage();

    expect(highlightedCards()).toEqual([FIRST]);
  });

  it("highlights the card the URL names, whatever the state", () => {
    store.dispatch(addProductPreset(PRESETS_DOCUMENT[0].presetProducts));

    renderModelPage("&preset=902");

    expect(highlightedCards()).toEqual([SECOND]);
  });

  it("does not take a URL preset the catalog doesn't hold", () => {
    store.dispatch(addProductPreset(PRESETS_DOCUMENT[1].presetProducts));

    renderModelPage("&preset=999");

    expect(highlightedCards()).toEqual([SECOND]);
  });

  it("highlights the card equal to the state", () => {
    store.dispatch(addProductPreset(PRESETS_DOCUMENT[1].presetProducts));

    renderModelPage();

    expect(highlightedCards()).toEqual([SECOND]);
  });

  it("highlights no card for a placed composition no preset equals", () => {
    store.dispatch(addProductPreset([{ name: "Fixture-Cabinet", Width: 40 }]));

    renderModelPage();

    expect(highlightedCards()).toEqual([]);
  });

  it("highlights no card for cabinets placed with an empty state", () => {
    store.dispatch(recordComposition({ productIds: ["Fixture-Cabinet-a", "Fixture-Cabinet-b"] }));

    renderModelPage();

    expect(highlightedCards()).toEqual([]);
  });
});
