// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext, type ReadyCollectionData } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { replaceCollectionData, reset, setActiveProfile } from "@/entities/product/model/store/slice";
import { classProfile } from "@/features/drawerOrganizers/__tests__/organizerHookSetup";
import { classCollection } from "@/features/drawerOrganizers/__tests__/organizerUiSetup";
import { readyCollectionFixture } from "@/features/configurationCommands/__tests__/readyCollectionFixture";

import { AccessoriesPage } from "../AccessoriesPage";

// Which hooks the page starts: the legacy ones start the scene's drawer buttons, the organizers' never do.
const legacyDividers = vi.hoisted(() => ({ useDividersState: vi.fn(), installDrawerWidgets: vi.fn() }));

vi.mock("@/widgets/AccessoriesSections/lib/useDividersState", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/widgets/AccessoriesSections/lib/useDividersState")>();
  legacyDividers.useDividersState.mockImplementation(actual.useDividersState);
  return { ...actual, useDividersState: legacyDividers.useDividersState };
});
vi.mock("@/widgets/AccessoriesSections/lib/drawerWidgets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/widgets/AccessoriesSections/lib/drawerWidgets")>();
  legacyDividers.installDrawerWidgets.mockImplementation(actual.installDrawerWidgets);
  return { ...actual, installDrawerWidgets: legacyDividers.installDrawerWidgets };
});
vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({ getConfig: vi.fn(async () => ({ Width: 60 })) }));
vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion");
vi.mock("@/shared/ui/Accordion/useCompactAccordionViewport", () => ({ useCompactAccordionViewport: () => false }));

afterEach(cleanup);

beforeEach(() => {
  store.dispatch(reset());
  legacyDividers.useDividersState.mockClear();
  legacyDividers.installDrawerWidgets.mockClear();
});

/** The collection as the loader hands it to a page: with its product profile (the page works the gate out of it). */
const withProfile = (collection: ReadyCollectionData, productProfile: typeof classProfile): ReadyCollectionData => ({
  ...collection,
  catalog: { ...collection.catalog, productProfile },
});

const renderStep = (collection = withProfile(readyCollectionFixture, ushProfile)) =>
  render(
    <ReadyCollectionContext.Provider value={collection}>
      <Provider store={store}>
        <MemoryRouter initialEntries={["/prebuilt/accessories"]}>
          <AccessoriesPage stepId="accessories" />
        </MemoryRouter>
      </Provider>
    </ReadyCollectionContext.Provider>,
  );

const sectionTitles = () => screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"));

const classPage = () => withProfile(classCollection(), classProfile);

describe("AccessoriesPage: a collection with drawer organizers (ruleData.drawerOrganizers)", () => {
  beforeEach(() => {
    store.dispatch(setActiveProfile(classProfile));
  });

  it("shows the organizers' Drawer Dividers section", () => {
    renderStep(classPage());
    expect(sectionTitles()).toEqual(["Drawer Dividers"]);
  });

  it("never starts the legacy divider state or installs the scene's drawer widgets", () => {
    renderStep(classPage());
    expect(legacyDividers.useDividersState).not.toHaveBeenCalled();
    expect(legacyDividers.installDrawerWidgets).not.toHaveBeenCalled();
  });
});

describe("AccessoriesPage: a cold load straight onto the step", () => {
  // The store gets the profile in an effect after the first render: at the first commit it is still empty.
  beforeEach(() => {
    store.dispatch(replaceCollectionData({ profile: null, cabinetCatalog: null }));
  });

  it("renders the organizers' page from the first commit, with the store still empty", () => {
    renderStep(classPage());

    expect(sectionTitles()).toEqual(["Drawer Dividers"]);
    expect(legacyDividers.useDividersState).not.toHaveBeenCalled();
    expect(legacyDividers.installDrawerWidgets).not.toHaveBeenCalled();
  });

  it("renders the legacy page for USH from the first commit, with the store still empty", () => {
    renderStep(withProfile(readyCollectionFixture, ushProfile));

    expect(sectionTitles()).toEqual(["Side Panels", "Dividers", "Towel Bar"]);
    expect(legacyDividers.useDividersState).toHaveBeenCalled();
  });
});

describe("AccessoriesPage: a collection without them (USH)", () => {
  beforeEach(() => {
    store.dispatch(setActiveProfile(ushProfile));
  });

  it("renders the legacy page: its sections and its divider state", () => {
    renderStep();
    expect(sectionTitles()).toEqual(["Side Panels", "Dividers", "Towel Bar"]);
    expect(legacyDividers.useDividersState).toHaveBeenCalled();
  });
});
