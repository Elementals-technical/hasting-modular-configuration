// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createMemoryRouter, RouterProvider, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";

import productionRegistry from "../../../../public/collections/registry.json";
import productionManifest from "../../../../public/collections/urban-standard-height/manifest.json";
import productionNavigation from "../../../../public/collections/urban-standard-height/navigation.json";
import productionPresets from "../../../../public/collections/urban-standard-height/presets.json";
import productionStaticOptions from "../../../../public/collections/urban-standard-height/static-options.json";
import productionSkuMappings from "../../../../public/collections/urban-standard-height/cabinet-sku-mappings.json";
import productionProductProfile from "../../../../public/collections/urban-standard-height/product-profile.json";
import productionRuntimeBindings from "../../../../public/collections/urban-standard-height/runtime-bindings.json";
import productionUi from "../../../../public/collections/urban-standard-height/ui.json";
import fixtureRegistry from "./fixtures/collections/registry.json";
import fixtureUiManifest from "./fixtures/collections/fixture-ui/manifest.json";
import fixtureUiNavigation from "./fixtures/collections/fixture-ui/navigation.json";
import fixtureUiPresets from "./fixtures/collections/fixture-ui/presets.json";
import fixtureUiOptions from "./fixtures/collections/fixture-ui/static-options.json";
import fixtureUiProfile from "./fixtures/collections/fixture-ui/product-profile.json";
import fixtureUiBindings from "./fixtures/collections/fixture-ui/runtime-bindings.json";
import fixtureUiSchema from "./fixtures/collections/fixture-ui/ui.json";
import fixtureRulesManifest from "./fixtures/collections/fixture-rules/manifest.json";
import fixtureCabinetTable from "./fixtures/collections/fixture-rules/cabinet-table.json";
import fixtureCountertopTable from "./fixtures/collections/fixture-rules/countertop-table.json";
import configurator4 from "./fixtures/remote/configurator-4.json";
import datatable438 from "./fixtures/remote/datatable-438.json";
import datatable439 from "./fixtures/remote/datatable-439.json";

import { useActiveCollection } from "../ui/activeCollectionContext";
import { ActiveCollectionProvider } from "../ui/ActiveCollectionProvider";
import type { CollectionRuntimeDependencies, RemoteCollectionLoader } from "../model/types";

const registryUrl = "https://app.test/collections/registry.json";
const rootUrl = "https://app.test/collections/";

const remote: RemoteCollectionLoader = {
  loadConfigurator: vi.fn(async () => {
    throw new Error("Unexpected configurator request");
  }),
  loadCountertopTable: vi.fn(async () => {
    throw new Error("Unexpected countertop request");
  }),
  loadCabinetTable: vi.fn(async () => {
    throw new Error("Unexpected cabinet request");
  }),
};

const localValues: Record<string, unknown> = {
  [`${rootUrl}urban-standard-height/manifest.json`]: productionManifest,
  [`${rootUrl}urban-standard-height/navigation.json`]: productionNavigation,
  [`${rootUrl}urban-standard-height/presets.json`]: productionPresets,
  [`${rootUrl}urban-standard-height/static-options.json`]: productionStaticOptions,
  [`${rootUrl}urban-standard-height/product-profile.json`]: productionProductProfile,
  [`${rootUrl}urban-standard-height/cabinet-sku-mappings.json`]: productionSkuMappings,
  [`${rootUrl}urban-standard-height/ui.json`]: productionUi,
  [`${rootUrl}urban-standard-height/runtime-bindings.json`]: productionRuntimeBindings,
  [`${rootUrl}fixture-ui/manifest.json`]: fixtureUiManifest,
  [`${rootUrl}fixture-ui/navigation.json`]: fixtureUiNavigation,
  [`${rootUrl}fixture-ui/presets.json`]: fixtureUiPresets,
  [`${rootUrl}fixture-ui/static-options.json`]: fixtureUiOptions,
  [`${rootUrl}fixture-ui/product-profile.json`]: fixtureUiProfile,
  [`${rootUrl}fixture-ui/ui.json`]: fixtureUiSchema,
  [`${rootUrl}fixture-ui/runtime-bindings.json`]: fixtureUiBindings,
  [`${rootUrl}fixture-rules/manifest.json`]: fixtureRulesManifest,
};

const makeDependencies = (
  fetchJson: CollectionRuntimeDependencies["fetchJson"] = async (url) => {
    if (!(url in localValues)) throw new Error(`Unexpected local request: ${url}`);
    return localValues[url];
  },
  remoteLoader: RemoteCollectionLoader = remote,
  registry: CollectionRuntimeDependencies["registry"] = fixtureRegistry,
): CollectionRuntimeDependencies => ({
  registryUrl,
  collectionsRootUrl: rootUrl,
  registry,
  fetchJson,
  remote: remoteLoader,
  sourceOverrides: {
    "fixture-rules": {
      cabinetTable: fixtureCabinetTable,
      countertopTable: fixtureCountertopTable,
    },
  },
});

const CollectionConsumer = () => {
  const state = useActiveCollection();
  const navigate = useNavigate();
  const detail =
    state.status === "ready"
      ? (state.data.catalog.navigation?.prebuilt[0]?.label ?? state.data.catalog.cabinets?.typeCabinetRules[0]?.code)
      : state.status === "error"
        ? state.error.code
        : "";
  const collectionId = "collectionId" in state ? state.collectionId : undefined;

  return (
    <div>
      <output data-testid="collection-state">{`${state.status}:${collectionId ?? ""}:${detail ?? ""}`}</output>
      <button onClick={() => navigate("/?collectionId=fixture-rules")}>rules</button>
      <button onClick={() => navigate("/?collectionId=urban-standard-height")}>ush</button>
      <button onClick={() => navigate("/?collectionId=")}>empty</button>
      <button onClick={() => navigate("/?collectionId=unknown")}>unknown</button>
    </div>
  );
};

const renderProvider = (initialEntry: string, dependencies: CollectionRuntimeDependencies) => {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <ActiveCollectionProvider dependencies={dependencies}>
            <CollectionConsumer />
          </ActiveCollectionProvider>
        ),
      },
    ],
    { initialEntries: [initialEntry] },
  );
  return render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  );
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ActiveCollectionProvider", () => {
  const productionRemote: RemoteCollectionLoader = {
    loadConfigurator: vi.fn(async () => configurator4),
    loadCountertopTable: vi.fn(async () => datatable438),
    loadCabinetTable: vi.fn(async () => datatable439),
  };

  it("takes the production registry default through resolving and loading to ready", async () => {
    renderProvider("/", makeDependencies(undefined, productionRemote, productionRegistry));
    await waitFor(() =>
      expect(screen.getByTestId("collection-state").textContent).toContain("ready:urban-standard-height"),
    );
    expect(productionRemote.loadConfigurator).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4 }),
      expect.any(AbortSignal),
    );
    expect(productionRemote.loadCountertopTable).toHaveBeenCalledWith(438, expect.any(AbortSignal));
    expect(productionRemote.loadCabinetTable).toHaveBeenCalledWith(439, expect.any(AbortSignal));
  });

  it("serves fixture-ui through the public hook while always rendering its child", async () => {
    renderProvider("/?collectionId=fixture-ui", makeDependencies());
    expect(screen.getByTestId("collection-state")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId("collection-state").textContent).toBe("ready:fixture-ui:Fixture Models"),
    );
    expect(remote.loadConfigurator).not.toHaveBeenCalled();
    expect(remote.loadCountertopTable).not.toHaveBeenCalled();
    expect(remote.loadCabinetTable).not.toHaveBeenCalled();
  });

  it.each(["empty", "unknown"])("replaces ready data with the latest %s URL error", async (target) => {
    renderProvider("/?collectionId=fixture-ui", makeDependencies());
    await waitFor(() => expect(screen.getByTestId("collection-state").textContent).toContain("ready:fixture-ui"));
    fireEvent.click(screen.getByRole("button", { name: target }));
    const expectedCode = target === "empty" ? "invalid-collection-id" : "unknown-collection";
    await waitFor(() =>
      expect(screen.getByTestId("collection-state").textContent).toBe(
        `error:${target === "empty" ? "" : "unknown"}:${expectedCode}`,
      ),
    );
  });

  it.each(["success", "failure"])("ignores a late %s from the previous URL", async (outcome) => {
    let resolveOld: ((value: unknown) => void) | undefined;
    let rejectOld: ((reason: unknown) => void) | undefined;
    const oldManifest = new Promise<unknown>((resolve, reject) => {
      resolveOld = resolve;
      rejectOld = reject;
    });
    const fetchJson = vi.fn(async (url: string) => {
      if (url === `${rootUrl}fixture-ui/manifest.json`) return oldManifest;
      if (url in localValues) return localValues[url];
      throw new Error(`Unexpected local request: ${url}`);
    });
    renderProvider("/?collectionId=fixture-ui", makeDependencies(fetchJson));
    await waitFor(() => expect(screen.getByTestId("collection-state").textContent).toBe("loading:fixture-ui:"));

    fireEvent.click(screen.getByRole("button", { name: "rules" }));
    await waitFor(() =>
      expect(screen.getByTestId("collection-state").textContent).toBe("ready:fixture-rules:Fixture-Cabinet"),
    );
    await act(async () => {
      if (outcome === "success") resolveOld?.(fixtureUiManifest);
      else rejectOld?.(new Error("late failure"));
      await Promise.resolve();
    });
    expect(screen.getByTestId("collection-state").textContent).toBe("ready:fixture-rules:Fixture-Cabinet");
  });

  it("switches one hook consumer between USH and fixture-rules catalogs", async () => {
    renderProvider("/?collectionId=urban-standard-height", makeDependencies(undefined, productionRemote));
    await waitFor(() =>
      expect(screen.getByTestId("collection-state").textContent).toContain("ready:urban-standard-height"),
    );
    fireEvent.click(screen.getByRole("button", { name: "rules" }));
    await waitFor(() =>
      expect(screen.getByTestId("collection-state").textContent).toBe("ready:fixture-rules:Fixture-Cabinet"),
    );
  });

  it("publishes an error when a declared source fails", async () => {
    const failingRemote: RemoteCollectionLoader = {
      ...productionRemote,
      loadCountertopTable: vi.fn(async () => {
        throw new Error("countertop unavailable");
      }),
    };
    renderProvider("/", makeDependencies(undefined, failingRemote, productionRegistry));
    await waitFor(() =>
      expect(screen.getByTestId("collection-state").textContent).toBe("error:urban-standard-height:source-load-failed"),
    );
  });
});
