// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createMemoryRouter, RouterProvider, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { CollectionStateBridge } from "@/entities/configuration";

import productionRegistry from "../../../../public/collections/registry.json";
import productionManifest from "../../../../public/collections/urban-standard-height/manifest.json";
import productionNavigation from "../../../../public/collections/urban-standard-height/navigation.json";
import productionPresets from "../../../../public/collections/urban-standard-height/presets.json";
import productionStaticOptions from "../../../../public/collections/urban-standard-height/static-options.json";
import productionSkuMappings from "../../../../public/collections/urban-standard-height/cabinet-sku-mappings.json";
import productionProductProfile from "../../../../public/collections/urban-standard-height/product-profile.json";
import productionRuntimeBindings from "../../../../public/collections/urban-standard-height/runtime-bindings.json";
import productionUi from "../../../../public/collections/urban-standard-height/ui.json";
import urbanLowHeightManifest from "../../../../public/collections/urban-low-height/manifest.json";
import urbanLowHeightPresets from "../../../../public/collections/urban-low-height/presets.json";
import urbanLowHeightProductProfile from "../../../../public/collections/urban-low-height/product-profile.json";
import urbanLowHeightUi from "../../../../public/collections/urban-low-height/ui.json";
import classManifest from "../../../../public/collections/class/manifest.json";
import classPresets from "../../../../public/collections/class/presets.json";
import classProductProfile from "../../../../public/collections/class/product-profile.json";
import classSkuProfile from "../../../../public/collections/class/sku-profile.json";
import classUi from "../../../../public/collections/class/ui.json";
import makoManifest from "../../../../public/collections/mako/manifest.json";
import makoPresets from "../../../../public/collections/mako/presets.json";
import makoProductProfile from "../../../../public/collections/mako/product-profile.json";
import makoRuntimeBindings from "../../../../public/collections/mako/runtime-bindings.json";
import makoSkuProfile from "../../../../public/collections/mako/sku-profile.json";
import makoUi from "../../../../public/collections/mako/ui.json";
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
import fixtureRulesProfile from "./fixtures/collections/fixture-rules/product-profile.json";
import fixtureRulesBindings from "./fixtures/collections/fixture-rules/runtime-bindings.json";
import fixtureRulesUi from "./fixtures/collections/fixture-rules/ui.json";
import configurator4 from "./fixtures/remote/configurator-4.json";
import datatable438 from "./fixtures/remote/datatable-438.json";
import datatable439 from "./fixtures/remote/datatable-439.json";
import datatable581 from "./fixtures/remote/datatable-581.json";

import { useActiveCollectionSession, useActiveCollectionState } from "../ui/activeCollectionContext";
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
  [`${rootUrl}urban-low-height/manifest.json`]: urbanLowHeightManifest,
  [`${rootUrl}urban-low-height/presets.json`]: urbanLowHeightPresets,
  [`${rootUrl}urban-low-height/product-profile.json`]: urbanLowHeightProductProfile,
  [`${rootUrl}urban-low-height/ui.json`]: urbanLowHeightUi,
  [`${rootUrl}class/manifest.json`]: classManifest,
  [`${rootUrl}class/presets.json`]: classPresets,
  [`${rootUrl}class/product-profile.json`]: classProductProfile,
  [`${rootUrl}class/sku-profile.json`]: classSkuProfile,
  [`${rootUrl}class/ui.json`]: classUi,
  [`${rootUrl}mako/manifest.json`]: makoManifest,
  [`${rootUrl}mako/presets.json`]: makoPresets,
  [`${rootUrl}mako/product-profile.json`]: makoProductProfile,
  [`${rootUrl}mako/runtime-bindings.json`]: makoRuntimeBindings,
  [`${rootUrl}mako/sku-profile.json`]: makoSkuProfile,
  [`${rootUrl}mako/ui.json`]: makoUi,
  [`${rootUrl}fixture-ui/manifest.json`]: fixtureUiManifest,
  [`${rootUrl}fixture-ui/navigation.json`]: fixtureUiNavigation,
  [`${rootUrl}fixture-ui/presets.json`]: fixtureUiPresets,
  [`${rootUrl}fixture-ui/static-options.json`]: fixtureUiOptions,
  [`${rootUrl}fixture-ui/product-profile.json`]: fixtureUiProfile,
  [`${rootUrl}fixture-ui/ui.json`]: fixtureUiSchema,
  [`${rootUrl}fixture-ui/runtime-bindings.json`]: fixtureUiBindings,
  [`${rootUrl}fixture-rules/manifest.json`]: fixtureRulesManifest,
  [`${rootUrl}fixture-rules/product-profile.json`]: fixtureRulesProfile,
  [`${rootUrl}fixture-rules/runtime-bindings.json`]: fixtureRulesBindings,
  [`${rootUrl}fixture-rules/ui.json`]: fixtureRulesUi,
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
  const state = useActiveCollectionState();
  const session = useActiveCollectionSession();
  const navigate = useNavigate();
  const detail =
    state.status === "ready"
      ? (state.data.catalog.navigation?.prebuilt[0]?.label ?? state.data.catalog.cabinets?.typeCabinetRules[0]?.code)
      : state.status === "error"
        ? state.error.code
        : "";
  const collectionId = "collectionId" in state ? state.collectionId : undefined;
  const localData =
    state.status === "ready"
      ? JSON.stringify({
          defaults: state.data.manifest.defaults,
          presets: state.data.catalog.presets ?? null,
          productProfile: state.data.catalog.productProfile ?? null,
          runtimeBindings: state.data.catalog.runtimeBindings ?? null,
          cabinetSkuMappings: state.data.catalog.cabinetSkuMappings ?? null,
        })
      : "";

  return (
    <div>
      <output data-testid="collection-state">{`${state.status}:${collectionId ?? ""}:${detail ?? ""}`}</output>
      <output data-testid="collection-local-data">{localData}</output>
      <button onClick={session.retry}>retry</button>
      <button onClick={() => navigate("/?collectionId=fixture-rules")}>rules</button>
      <button onClick={() => navigate("/?collectionId=urban-standard-height")}>ush</button>
      <button onClick={() => navigate("/?collectionId=urban-low-height")}>urban-low-height</button>
      <button onClick={() => navigate("/?collectionId=class")}>class</button>
      <button onClick={() => navigate("/")}>default</button>
      <button onClick={() => navigate("/?collectionId=")}>empty</button>
      <button onClick={() => navigate("/?collectionId=fixture-ui&configId=123")}>config</button>
      <button onClick={() => navigate("/?collectionId=unknown")}>unknown</button>
    </div>
  );
};

const renderProvider = (initialEntry: string, dependencies: CollectionRuntimeDependencies, includeBridges = false) => {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <ActiveCollectionProvider dependencies={dependencies}>
            {includeBridges && <CollectionStateBridge />}
            <CollectionConsumer />
          </ActiveCollectionProvider>
        ),
      },
    ],
    { initialEntries: [initialEntry] },
  );
  return {
    renderResult: render(
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>,
    ),
    router,
  };
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ActiveCollectionProvider", () => {
  const productionRemote: RemoteCollectionLoader = {
    loadConfigurator: vi.fn(async () => configurator4),
    loadCountertopTable: vi.fn(async () => datatable438),
    // Mako reads its own cabinet table (581); the other collections share the USH one (439).
    loadCabinetTable: vi.fn(async (id: string | number) => (id === 581 ? datatable581 : datatable439)),
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

  it.each([
    ["urban-low-height", "Urban Low Height Models", "urban-low-height", 59, null, 439],
    ["class", "Class Models", "class", 44, null, 439],
    // Mako ships its scene bindings (I) and has its own cabinet table.
    ["mako", "Mako Models", "mako", 42, { collectionId: "mako" }, 581],
  ])(
    "loads the initial %s session without requiring optional local catalogs",
    async (collectionId, detail, profileCollectionId, presetCount, runtimeBindings, cabinetTableId) => {
      renderProvider(
        "/?collectionId=" + collectionId,
        makeDependencies(undefined, productionRemote, productionRegistry),
        true,
      );

      await waitFor(() =>
        expect(screen.getByTestId("collection-state").textContent).toBe("ready:" + collectionId + ":" + detail),
      );
      const localData = JSON.parse(screen.getByTestId("collection-local-data").textContent ?? "{}") as {
        productProfile: { collectionId?: string } | null;
        presets: unknown[] | null;
      };

      // The optional catalogs stay absent; these collections already ship a product profile and their models.
      expect(localData).toMatchObject({ defaults: {}, runtimeBindings, cabinetSkuMappings: null });
      expect(localData.presets?.length ?? null).toBe(presetCount);
      expect(localData.productProfile?.collectionId ?? null).toBe(profileCollectionId);
      expect(productionRemote.loadCabinetTable).toHaveBeenCalledWith(cabinetTableId, expect.any(AbortSignal));
    },
  );

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

  it("keeps the initial collection loaded when unrelated search parameters change", async () => {
    renderProvider("/?collectionId=fixture-ui", makeDependencies());
    await waitFor(() => expect(screen.getByTestId("collection-state").textContent).toContain("ready:fixture-ui"));

    fireEvent.click(screen.getByRole("button", { name: "config" }));

    expect(screen.getByTestId("collection-state").textContent).toContain("ready:fixture-ui");
    expect(remote.loadConfigurator).not.toHaveBeenCalled();
    expect(remote.loadCountertopTable).not.toHaveBeenCalled();
    expect(remote.loadCabinetTable).not.toHaveBeenCalled();
  });

  it("retries the captured collection without changing its identity", async () => {
    const retryingRemote: RemoteCollectionLoader = {
      loadConfigurator: vi
        .fn()
        .mockRejectedValueOnce(new Error("temporary configurator failure"))
        .mockResolvedValue(configurator4),
      loadCountertopTable: vi.fn(async () => datatable438),
      loadCabinetTable: vi.fn(async () => datatable439),
    };
    renderProvider(
      "/?collectionId=urban-standard-height",
      makeDependencies(undefined, retryingRemote, productionRegistry),
    );

    await waitFor(() =>
      expect(screen.getByTestId("collection-state").textContent).toBe("error:urban-standard-height:source-load-failed"),
    );
    fireEvent.click(screen.getByRole("button", { name: "retry" }));

    await waitFor(() =>
      expect(screen.getByTestId("collection-state").textContent).toContain("ready:urban-standard-height"),
    );
    expect(retryingRemote.loadConfigurator).toHaveBeenCalledTimes(2);
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
