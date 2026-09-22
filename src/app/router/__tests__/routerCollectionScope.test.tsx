// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { Outlet, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/pages", () => {
  const Page = ({ name }: { name: string }) => <div>{name}</div>;

  return {
    CustomCabinetColorsPage: () => <Page name="custom cabinet colors" />,
    CustomAccessoriesPage: () => <Page name="custom accessories" />,
    CustomSummaryPage: () => <Page name="custom summary" />,
    HomePage: () => <Outlet />,
    ModelPage: () => <Page name="model" />,
    AccessoriesPage: () => <Page name="accessories" />,
    CountertopPage: () => <Page name="countertop" />,
    CabinetBuilderPage: () => <Page name="cabinet builder" />,
    CabinetPage: () => <Page name="cabinet" />,
    ModelDetailsPage: () => <Page name="model details" />,
    ArDownloadPage: () => <Page name="ar download" />,
    CabinetStyleDetailsPage: () => <Page name="cabinet style details" />,
    RestoreConfigurationPage: () => <Page name="restore" />,
  };
});

vi.mock("../CollectionRouterRoot", () => ({
  CollectionRouterRoot: () => (
    <div data-testid="collection-root">
      <Outlet />
    </div>
  ),
}));

vi.mock("../CollectionStepRoutes", () => ({
  CollectionStepRoutes: () => <div>step routes</div>,
}));

import { routerConfig } from "../routerConfig";

afterEach(cleanup);

describe("collection router scope", () => {
  it("keeps Restore and AR outside the configurator collection root", async () => {
    render(<RouterProvider router={routerConfig} />);

    await act(async () => {
      await routerConfig.navigate("/restore?configId=13507");
    });
    expect(await screen.findByText("restore")).toBeTruthy();
    expect(screen.queryByTestId("collection-root")).toBeNull();

    await act(async () => {
      await routerConfig.navigate("/ar-download?glb=model.glb");
    });
    expect(await screen.findByText("ar download")).toBeTruthy();
    expect(screen.queryByTestId("collection-root")).toBeNull();

    await act(async () => {
      await routerConfig.navigate("/prebuilt/model?collectionId=urban-standard-height");
    });
    await waitFor(() => expect(screen.getByTestId("collection-root")).toBeTruthy());
    expect(screen.getByText("step routes")).toBeTruthy();
  });
});
