// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { Link, MemoryRouter, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ushManifest from "../../../../public/collections/urban-standard-height/manifest.json";
import ushUi from "../../../../public/collections/urban-standard-height/ui.json";
import { store } from "@/app/store";
import { ReadyCollectionContext, type ReadyCollectionData } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import { buildReadyFixtureCollection } from "@/entities/collection/__tests__/fixtures/renderWithFixtureCollection";
import fixtureUiUi from "@/entities/collection/__tests__/fixtures/collections/fixture-ui/ui.json";
import { addProductId, reset, resetProducts } from "@/entities/product/model/store/slice";

import { CollectionStepRoutes } from "../CollectionStepRoutes";

vi.mock("@/pages", () => {
  const Page = ({ name }: { name: string }) => (
    <div>
      <div data-testid="page">{name}</div>
      <Outlet />
    </div>
  );

  return {
    ModelPage: () => <Page name="model" />,
    ModelDetailsPage: () => <div data-testid="details">{useParams().modelId}</div>,
    CabinetBuilderPage: () => <Page name="cabinet builder" />,
    CabinetStyleDetailsPage: () => <Page name="cabinet style details" />,
    FieldsStepPage: ({ stepId }: { stepId: string }) => <Page name={`fields ${stepId}`} />,
    SummaryPage: () => <Page name="summary" />,
    CabinetPage: () => <Page name="cabinet" />,
    CountertopPage: ({ stepId }: { stepId: string }) => <Page name={`countertop ${stepId}`} />,
    AccessoriesPage: ({ stepId }: { stepId: string }) => <Page name={`accessories ${stepId}`} />,
    CustomCabinetColorsPage: () => <Page name="custom cabinet colors" />,
    CustomSummaryPage: () => <Page name="custom summary" />,
  };
});

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const readyUsh = buildReadyCollection("urban-standard-height", ushManifest, ushUi);

/** `linkTo` renders a link beside the routes: a navigation made in the app after it opened. */
const renderAt = (path: string, data: ReadyCollectionData, linkTo?: string) =>
  render(
    <ReadyCollectionContext.Provider value={data}>
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <LocationProbe />
          {linkTo && <Link to={linkTo}>next step</Link>}
          <Routes>
            <Route path="/" element={<Outlet />}>
              <Route path="*" element={<CollectionStepRoutes />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Provider>
    </ReadyCollectionContext.Provider>,
  );

const pageName = () => screen.getByTestId("page").textContent;
const currentLocation = () => screen.getByTestId("location").textContent;

/** A composition in the store, as the entry step leaves it. */
const seedProducts = () => store.dispatch(addProductId("cabinet-1"));

afterEach(cleanup);

beforeEach(() => {
  store.dispatch(reset());
});

describe("CollectionStepRoutes builds the step routes from the collection's ui.json", () => {
  it("opens a fixture step at its own path on the generic fields page", () => {
    seedProducts();
    renderAt("/fixture/finish?collectionId=fixture-ui", buildReadyFixtureCollection("fixture-ui"));

    expect(pageName()).toBe("fields fixture-finish");
  });

  it("opens the custom flow's step at its own path", () => {
    renderAt("/fixture/builder?collectionId=fixture-ui", buildReadyFixtureCollection("fixture-ui"));

    expect(pageName()).toBe("fields fixture-builder");
  });

  it("keeps the nested detail route under a preset-picker step", () => {
    renderAt("/fixture/models/901?collectionId=fixture-ui", buildReadyFixtureCollection("fixture-ui"));

    expect(pageName()).toBe("model");
    expect(screen.getByTestId("details").textContent).toBe("901");
  });

  it("opens a step added to the flow without any route change", () => {
    const withExtraStep = {
      ...fixtureUiUi,
      flows: {
        ...fixtureUiUi.flows,
        prebuilt: {
          ...fixtureUiUi.flows.prebuilt,
          steps: [...fixtureUiUi.flows.prebuilt.steps, { stepId: "extra", path: "/fixture/extra" }],
        },
      },
      steps: { ...fixtureUiUi.steps, extra: { label: "Extra", kind: "fields", sectionIds: ["test-finish"] } },
    };
    seedProducts();

    renderAt(
      "/fixture/extra?collectionId=fixture-ui",
      buildReadyFixtureCollection("fixture-ui", { uiDocument: withExtraStep }),
    );

    expect(pageName()).toBe("fields extra");
  });

  it("sends the old url of a step removed from the flow to the flow's entry step", async () => {
    const withoutFinish = {
      ...fixtureUiUi,
      flows: {
        ...fixtureUiUi.flows,
        prebuilt: { ...fixtureUiUi.flows.prebuilt, steps: fixtureUiUi.flows.prebuilt.steps.slice(0, 1) },
      },
    };

    renderAt(
      "/fixture/finish?collectionId=fixture-ui",
      buildReadyFixtureCollection("fixture-ui", { uiDocument: withoutFinish }),
    );

    await waitFor(() => expect(pageName()).toBe("model"));
    expect(currentLocation()).toBe("/fixture/models?collectionId=fixture-ui");
  });

  it("sends the old url of a disabled step to the flow's entry step, without removing it from the schema", async () => {
    const withDisabledFinish = {
      ...fixtureUiUi,
      steps: { ...fixtureUiUi.steps, "fixture-finish": { ...fixtureUiUi.steps["fixture-finish"], enabled: false } },
    };

    renderAt(
      "/fixture/finish?collectionId=fixture-ui",
      buildReadyFixtureCollection("fixture-ui", { uiDocument: withDisabledFinish }),
    );

    await waitFor(() => expect(pageName()).toBe("model"));
    expect(currentLocation()).toBe("/fixture/models?collectionId=fixture-ui");
  });

  it("sends an unknown path to the entry step of the flow it belongs to", async () => {
    renderAt("/custom/nowhere?collectionId=urban-standard-height", readyUsh);

    await waitFor(() => expect(pageName()).toBe("cabinet builder"));
    expect(currentLocation()).toBe("/custom/cabinet-builder?collectionId=urban-standard-height");
  });

  it("resolves the flow roots to their entry steps", async () => {
    renderAt("/prebuilt?collectionId=urban-standard-height", readyUsh);

    await waitFor(() => expect(currentLocation()).toBe("/prebuilt/model?collectionId=urban-standard-height"));
  });

  it("opens every USH step: the bound screen where a page still exists, the fields page otherwise", () => {
    const cases: [string, string][] = [
      ["/prebuilt/model", "model"],
      ["/prebuilt/color", "cabinet"],
      ["/prebuilt/countertop", "countertop countertop"],
      ["/prebuilt/accessories", "accessories accessories"],
      ["/prebuilt/faucet-holes", "fields faucet-holes"],
      ["/prebuilt/summary", "summary"],
      ["/custom/cabinet-builder", "cabinet builder"],
      ["/custom/cabinet-builder/details/style", "cabinet style details"],
      ["/custom/cabinet-colors", "custom cabinet colors"],
      ["/custom/countertop", "countertop countertop-custom"],
      ["/custom/accessories", "accessories accessories-custom"],
      ["/custom/faucet-holes", "fields faucet-holes"],
      ["/custom/summary", "custom summary"],
    ];
    seedProducts();

    for (const [path, name] of cases) {
      renderAt(path, readyUsh);
      expect(pageName(), path).toBe(name);
      cleanup();
    }
  });
});

describe("CollectionStepRoutes sends a step past the entry, opened with nothing configured, to the flow's entry", () => {
  it("sends a cold-opened later step of the flow to its entry step, keeping the query", async () => {
    renderAt("/fixture/finish?collectionId=fixture-ui&configId=cfg-1", buildReadyFixtureCollection("fixture-ui"));

    await waitFor(() => expect(pageName()).toBe("model"));
    expect(currentLocation()).toBe("/fixture/models?collectionId=fixture-ui&configId=cfg-1");
  });

  it.each([
    ["/prebuilt/color", "/prebuilt/model", "model"],
    ["/prebuilt/summary", "/prebuilt/model", "model"],
    ["/custom/countertop", "/custom/cabinet-builder", "cabinet builder"],
    ["/custom/summary", "/custom/cabinet-builder", "cabinet builder"],
  ])("sends a cold-opened empty %s to %s", async (path, entryPath, entryPage) => {
    const query = "?collectionId=urban-standard-height&configId=cfg-1";
    renderAt(`${path}${query}`, readyUsh);

    await waitFor(() => expect(pageName()).toBe(entryPage));
    expect(currentLocation()).toBe(`${entryPath}${query}`);
  });

  it("keeps a cold-opened later step when a composition is configured", () => {
    seedProducts();
    renderAt("/prebuilt/color?collectionId=urban-standard-height", readyUsh);

    expect(pageName()).toBe("cabinet");
    expect(currentLocation()).toBe("/prebuilt/color?collectionId=urban-standard-height");
  });

  it.each([
    ["/prebuilt/model/123", "model"],
    ["/custom/cabinet-builder/details/style", "cabinet style details"],
  ])("keeps the entry detail route %s opened with nothing configured", (path, name) => {
    renderAt(`${path}?collectionId=urban-standard-height`, readyUsh);

    expect(pageName()).toBe(name);
    expect(currentLocation()).toBe(`${path}?collectionId=urban-standard-height`);
  });

  it("keeps a later step reached from the entry before the composition lands", () => {
    renderAt(
      "/prebuilt/model?collectionId=urban-standard-height",
      readyUsh,
      "/prebuilt/color?collectionId=urban-standard-height",
    );

    fireEvent.click(screen.getByRole("link", { name: "next step" }));

    expect(pageName()).toBe("cabinet");
    expect(currentLocation()).toBe("/prebuilt/color?collectionId=urban-standard-height");
  });

  it("keeps a later step whose composition is emptied mid-session", () => {
    seedProducts();
    renderAt(
      "/custom/cabinet-builder?collectionId=urban-standard-height",
      readyUsh,
      "/custom/cabinet-colors?collectionId=urban-standard-height",
    );

    fireEvent.click(screen.getByRole("link", { name: "next step" }));
    act(() => {
      store.dispatch(resetProducts());
    });

    expect(pageName()).toBe("custom cabinet colors");
    expect(currentLocation()).toBe("/custom/cabinet-colors?collectionId=urban-standard-height");
  });

  it("keeps a cold-opened later step whose composition is emptied after it opened", () => {
    seedProducts();
    renderAt("/custom/countertop?collectionId=urban-standard-height", readyUsh);

    act(() => {
      store.dispatch(resetProducts());
    });

    expect(pageName()).toBe("countertop countertop-custom");
    expect(currentLocation()).toBe("/custom/countertop?collectionId=urban-standard-height");
  });
});
