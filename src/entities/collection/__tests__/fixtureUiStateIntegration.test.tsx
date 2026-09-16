// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { getActiveCollectionId, getActiveProductProfile, resetConfiguration } from "@/entities/configuration";
import { CollectionStateBridge } from "@/entities/configuration/ui/CollectionStateBridge";
import { getCabinetCatalog } from "@/entities/product/model/store/selectors";
import { replaceCollectionData, reset } from "@/entities/product/model/store/slice";

import productionManifest from "../../../../public/collections/urban-standard-height/manifest.json";
import productionNavigation from "../../../../public/collections/urban-standard-height/navigation.json";
import productionPresets from "../../../../public/collections/urban-standard-height/presets.json";
import productionProfile from "../../../../public/collections/urban-standard-height/product-profile.json";
import productionBindings from "../../../../public/collections/urban-standard-height/runtime-bindings.json";
import productionOptions from "../../../../public/collections/urban-standard-height/static-options.json";
import productionSkuMappings from "../../../../public/collections/urban-standard-height/cabinet-sku-mappings.json";
import productionUi from "../../../../public/collections/urban-standard-height/ui.json";
import fixtureRegistry from "./fixtures/collections/registry.json";
import fixtureManifest from "./fixtures/collections/fixture-ui/manifest.json";
import fixtureNavigation from "./fixtures/collections/fixture-ui/navigation.json";
import fixturePresets from "./fixtures/collections/fixture-ui/presets.json";
import fixtureProfile from "./fixtures/collections/fixture-ui/product-profile.json";
import fixtureBindings from "./fixtures/collections/fixture-ui/runtime-bindings.json";
import fixtureOptions from "./fixtures/collections/fixture-ui/static-options.json";
import fixtureUi from "./fixtures/collections/fixture-ui/ui.json";
import configurator4 from "./fixtures/remote/configurator-4.json";
import datatable438 from "./fixtures/remote/datatable-438.json";
import datatable439 from "./fixtures/remote/datatable-439.json";

import type { CollectionRuntimeDependencies } from "../model/types";
import { ActiveCollectionProvider } from "../ui/ActiveCollectionProvider";
import { useActiveCollection } from "../ui/activeCollectionContext";

const rootUrl = "https://app.test/collections/";

const Consumer = () => {
  const collection = useActiveCollection();
  const id = "collectionId" in collection ? collection.collectionId : "";

  return (
    <>
      <output data-testid="collection-state">{`${collection.status}:${id ?? ""}`}</output>
    </>
  );
};

afterEach(cleanup);

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(replaceCollectionData({ profile: null, cabinetCatalog: null }));
});

describe("fixture-ui provider and state integration", () => {
  it("loads the complete local fixture without importing USH state or making a remote request", async () => {
    const values: Record<string, unknown> = {
      [`${rootUrl}urban-standard-height/manifest.json`]: productionManifest,
      [`${rootUrl}urban-standard-height/navigation.json`]: productionNavigation,
      [`${rootUrl}urban-standard-height/presets.json`]: productionPresets,
      [`${rootUrl}urban-standard-height/product-profile.json`]: productionProfile,
      [`${rootUrl}urban-standard-height/runtime-bindings.json`]: productionBindings,
      [`${rootUrl}urban-standard-height/static-options.json`]: productionOptions,
      [`${rootUrl}urban-standard-height/cabinet-sku-mappings.json`]: productionSkuMappings,
      [`${rootUrl}urban-standard-height/ui.json`]: productionUi,
      [`${rootUrl}fixture-ui/manifest.json`]: fixtureManifest,
      [`${rootUrl}fixture-ui/navigation.json`]: fixtureNavigation,
      [`${rootUrl}fixture-ui/presets.json`]: fixturePresets,
      [`${rootUrl}fixture-ui/product-profile.json`]: fixtureProfile,
      [`${rootUrl}fixture-ui/runtime-bindings.json`]: fixtureBindings,
      [`${rootUrl}fixture-ui/static-options.json`]: fixtureOptions,
      [`${rootUrl}fixture-ui/ui.json`]: fixtureUi,
    };
    const remote = {
      loadConfigurator: vi.fn(async () => configurator4),
      loadCountertopTable: vi.fn(async () => datatable438),
      loadCabinetTable: vi.fn(async () => datatable439),
    };
    const dependencies: CollectionRuntimeDependencies = {
      registryUrl: `${rootUrl}registry.json`,
      collectionsRootUrl: rootUrl,
      registry: fixtureRegistry,
      fetchJson: vi.fn(async (url) => {
        if (!(url in values)) throw new Error(`Unexpected local request: ${url}`);
        return values[url];
      }),
      remote,
    };
    const router = createMemoryRouter(
      [
        {
          path: "*",
          element: (
            <ActiveCollectionProvider dependencies={dependencies}>
              <CollectionStateBridge />
              <Consumer />
            </ActiveCollectionProvider>
          ),
        },
      ],
      { initialEntries: ["/?collectionId=fixture-ui"] },
    );

    render(
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>,
    );

    await waitFor(() => expect(screen.getByTestId("collection-state").textContent).toBe("ready:fixture-ui"));
    expect(getActiveCollectionId(store.getState())).toBe("fixture-ui");
    expect(getActiveProductProfile(store.getState())?.collectionId).toBe("fixture-ui");
    expect(store.getState().rootStateUI.product.productOptions.CabinetColor).toBe("Fixture Blue");
    expect(store.getState().rootStateUI.product.productOptions.CountertopColor).toBe("Fixture Copper");
    expect(getCabinetCatalog(store.getState()).typeCabinetRules).toEqual([]);
    expect(remote.loadConfigurator).not.toHaveBeenCalled();
    expect(remote.loadCountertopTable).not.toHaveBeenCalled();
    expect(remote.loadCabinetTable).not.toHaveBeenCalled();
  });
});
