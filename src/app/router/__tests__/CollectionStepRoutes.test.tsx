// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ushManifest from "../../../../public/collections/urban-standard-height/manifest.json";
import ushUi from "../../../../public/collections/urban-standard-height/ui.json";
import { ReadyCollectionContext, type ReadyCollectionData } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import { buildReadyFixtureCollection } from "@/entities/collection/__tests__/fixtures/renderWithFixtureCollection";
import fixtureUiUi from "@/entities/collection/__tests__/fixtures/collections/fixture-ui/ui.json";

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
    CountertopPage: () => <Page name="countertop" />,
    AccessoriesPage: () => <Page name="accessories" />,
    CustomCabinetColorsPage: () => <Page name="custom cabinet colors" />,
    CustomCountertopPage: () => <Page name="custom countertop" />,
    CustomAccessoriesPage: () => <Page name="custom accessories" />,
    CustomSummaryPage: () => <Page name="custom summary" />,
  };
});

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const readyUsh = buildReadyCollection("urban-standard-height", ushManifest, ushUi);

const renderAt = (path: string, data: ReadyCollectionData) =>
  render(
    <ReadyCollectionContext.Provider value={data}>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          <Route path="/" element={<Outlet />}>
            <Route path="*" element={<CollectionStepRoutes />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ReadyCollectionContext.Provider>,
  );

const pageName = () => screen.getByTestId("page").textContent;
const currentLocation = () => screen.getByTestId("location").textContent;

afterEach(cleanup);

describe("CollectionStepRoutes builds the step routes from the collection's ui.json", () => {
  it("opens a fixture step at its own path on the generic fields page", () => {
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
      ["/prebuilt/countertop", "countertop"],
      ["/prebuilt/accessories", "accessories"],
      ["/prebuilt/faucet-holes", "fields faucet-holes"],
      ["/prebuilt/summary", "summary"],
      ["/custom/cabinet-builder", "cabinet builder"],
      ["/custom/cabinet-builder/details/style", "cabinet style details"],
      ["/custom/cabinet-colors", "custom cabinet colors"],
      ["/custom/countertop", "custom countertop"],
      ["/custom/accessories", "custom accessories"],
      ["/custom/faucet-holes", "fields faucet-holes"],
      ["/custom/summary", "custom summary"],
    ];

    for (const [path, name] of cases) {
      renderAt(path, readyUsh);
      expect(pageName()).toBe(name);
      cleanup();
    }
  });
});
