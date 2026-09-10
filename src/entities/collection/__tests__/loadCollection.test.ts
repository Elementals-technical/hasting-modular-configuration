import { describe, expect, it, vi } from "vitest";

import productionRegistry from "../../../../public/collections/registry.json";
import productionManifest from "../../../../public/collections/urban-standard-height/manifest.json";
import productionNavigation from "../../../../public/collections/urban-standard-height/navigation.json";
import productionPresets from "../../../../public/collections/urban-standard-height/presets.json";
import productionStaticOptions from "../../../../public/collections/urban-standard-height/static-options.json";
import productionSkuMappings from "../../../../public/collections/urban-standard-height/cabinet-sku-mappings.json";

import fixtureRegistry from "./fixtures/collections/registry.json";
import fixtureUiManifest from "./fixtures/collections/fixture-ui/manifest.json";
import fixtureUiNavigation from "./fixtures/collections/fixture-ui/navigation.json";
import fixtureUiPresets from "./fixtures/collections/fixture-ui/presets.json";
import fixtureUiOptions from "./fixtures/collections/fixture-ui/static-options.json";
import fixtureRulesManifest from "./fixtures/collections/fixture-rules/manifest.json";
import fixtureCabinetTable from "./fixtures/collections/fixture-rules/cabinet-table.json";
import fixtureCountertopTable from "./fixtures/collections/fixture-rules/countertop-table.json";
import configurator4 from "./fixtures/remote/configurator-4.json";
import datatable438 from "./fixtures/remote/datatable-438.json";
import datatable439 from "./fixtures/remote/datatable-439.json";

import { loadCollectionRegistry, loadResolvedCollection } from "../lib/loadCollection";
import { resolveCollection } from "../lib/resolveCollection";
import type { CollectionRuntimeDependencies, RemoteCollectionLoader } from "../model/types";

const registryUrl = "https://app.test/collections/registry.json";
const rootUrl = "https://app.test/collections/";
const abortSignal = new AbortController().signal;

const jsonFetcher = (values: Record<string, unknown>) =>
  vi.fn(async (url: string) => {
    if (!(url in values)) throw new Error(`Unexpected local request: ${url}`);
    return values[url];
  });

const unusedRemote = (): RemoteCollectionLoader => ({
  loadConfigurator: vi.fn(async () => {
    throw new Error("Unexpected configurator request");
  }),
  loadCountertopTable: vi.fn(async () => {
    throw new Error("Unexpected countertop request");
  }),
  loadCabinetTable: vi.fn(async () => {
    throw new Error("Unexpected cabinet request");
  }),
});

describe("collection loading and assembly", () => {
  it("loads the complete default USH package and starts all declared remote sources in parallel", async () => {
    const manifestUrl = `${rootUrl}urban-standard-height/manifest.json`;
    const fetchJson = jsonFetcher({
      [registryUrl]: productionRegistry,
      [manifestUrl]: productionManifest,
      [`${rootUrl}urban-standard-height/navigation.json`]: productionNavigation,
      [`${rootUrl}urban-standard-height/presets.json`]: productionPresets,
      [`${rootUrl}urban-standard-height/static-options.json`]: productionStaticOptions,
      [`${rootUrl}urban-standard-height/cabinet-sku-mappings.json`]: productionSkuMappings,
    });
    const pending: Array<(value: unknown) => void> = [];
    const calls: string[] = [];
    const deferred = (name: string) =>
      new Promise<unknown>((resolve) => {
        calls.push(name);
        pending.push(resolve);
      });
    const remote: RemoteCollectionLoader = {
      loadConfigurator: vi.fn(() => deferred("configurator")),
      loadCountertopTable: vi.fn(() => deferred("countertop")),
      loadCabinetTable: vi.fn(() => deferred("cabinet")),
    };
    const dependencies: CollectionRuntimeDependencies = { registryUrl, collectionsRootUrl: rootUrl, fetchJson, remote };
    const registry = await loadCollectionRegistry(dependencies, abortSignal);
    const resolution = resolveCollection({ registry, urlCollectionId: null });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error("Expected a resolved collection");

    const loading = loadResolvedCollection(resolution, dependencies, abortSignal);
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(calls).toEqual(["configurator", "countertop", "cabinet"]);
    pending[0]?.(configurator4);
    pending[1]?.(datatable438);
    pending[2]?.(datatable439);
    const data = await loading;

    expect(remote.loadConfigurator).toHaveBeenCalledWith(
      { id: 4, view: "full", serialize: true },
      abortSignal,
    );
    expect(remote.loadCountertopTable).toHaveBeenCalledWith(438, abortSignal);
    expect(remote.loadCabinetTable).toHaveBeenCalledWith(439, abortSignal);
    expect(data.id).toBe("urban-standard-height");
    expect(data.catalog.presets).toHaveLength(54);
    expect(data.catalog.presets?.flatMap(({ presetProducts }) => presetProducts)).toHaveLength(123);
    expect(new Set(data.catalog.presets?.map(({ id }) => id)).size).toBe(54);
    expect(data.catalog.presets?.[0]?.id).toBe(1);
    expect(data.catalog.presets?.every(({ img }) => img.startsWith(`${rootUrl}urban-standard-height/images/`))).toBe(true);
    expect(data.sources.remote.configurator?.availableOptions[0]?.options[0]?.variants[0]?.metadata).toHaveProperty(
      "codeColor",
    );
    expect(data.catalog.configurator?.groupsByName["Cabinet Color"]?.proxyName).toBe("Cabinet Color");
    expect(data.catalog.cabinets?.typeCabinetRules).toHaveLength(4);
    expect(data.catalog.countertops).toHaveLength(27);
    expect(new Set(productionPresets.map(({ img }) => img)).size).toBe(54);
  });

  it("keeps optional sources absent and proves fixture-ui data independence without remote calls", async () => {
    const fetchJson = jsonFetcher({
      [`${rootUrl}fixture-ui/manifest.json`]: fixtureUiManifest,
      [`${rootUrl}fixture-ui/navigation.json`]: fixtureUiNavigation,
      [`${rootUrl}fixture-ui/presets.json`]: fixtureUiPresets,
      [`${rootUrl}fixture-ui/static-options.json`]: fixtureUiOptions,
    });
    const remote = unusedRemote();
    const dependencies: CollectionRuntimeDependencies = {
      registryUrl,
      collectionsRootUrl: rootUrl,
      registry: fixtureRegistry,
      fetchJson,
      remote,
    };
    const registry = await loadCollectionRegistry(dependencies, abortSignal);
    const resolution = resolveCollection({ registry, urlCollectionId: "fixture-ui" });
    if (!resolution.ok) throw new Error("Expected fixture-ui to resolve");
    const data = await loadResolvedCollection(resolution, dependencies, abortSignal);

    expect(data.id).toBe("fixture-ui");
    expect(data.manifest.defaults).toEqual({
      CabinetColor: "Fixture Blue",
      CountertopColor: "Fixture Copper",
      sinkType: "Fixture_Basin",
    });
    expect(data.catalog.navigation?.prebuilt[0]?.label).toBe("Fixture Models");
    expect(data.catalog.presets?.[0]?.id).toBe(901);
    expect(data.catalog.presets?.[0]?.presetProducts[0]?.fixtureExtension).toBe("retained");
    expect(data.catalog.staticOptions?.cabinetTypes).toEqual(["Fixture-Cabinet"]);
    expect(data.sources.remote).toEqual({});
    expect(data.catalog.configurator).toBeUndefined();
    expect(data.catalog.cabinets).toBeUndefined();
    expect(data.catalog.countertops).toBeUndefined();
    expect(remote.loadConfigurator).not.toHaveBeenCalled();
    expect(remote.loadCountertopTable).not.toHaveBeenCalled();
    expect(remote.loadCabinetTable).not.toHaveBeenCalled();
  });

  it("normalizes injected fixture-rules inputs with the shared parsers and no remote IDs", async () => {
    const fetchJson = jsonFetcher({ [`${rootUrl}fixture-rules/manifest.json`]: fixtureRulesManifest });
    const remote = unusedRemote();
    const dependencies: CollectionRuntimeDependencies = {
      registryUrl,
      collectionsRootUrl: rootUrl,
      registry: fixtureRegistry,
      fetchJson,
      remote,
      sourceOverrides: {
        "fixture-rules": {
          cabinetTable: fixtureCabinetTable,
          countertopTable: fixtureCountertopTable,
        },
      },
    };
    const registry = await loadCollectionRegistry(dependencies, abortSignal);
    const resolution = resolveCollection({ registry, urlCollectionId: "fixture-rules" });
    if (!resolution.ok) throw new Error("Expected fixture-rules to resolve");
    const data = await loadResolvedCollection(resolution, dependencies, abortSignal);

    expect(data.manifest.remote).toBeUndefined();
    expect(data.sources.remote.cabinetTable?.rows[0]?.fixtureExtension).toBe("retained");
    expect(data.catalog.cabinets?.typeCabinetRules).toEqual([
      expect.objectContaining({ code: "Fixture-Cabinet", widths: [13, 37], depths: [11] }),
    ]);
    expect(data.catalog.countertops).toEqual([
      expect.objectContaining({ material: "Fixtureium", topThicknesses: ["9"], depths: [12, 34] }),
    ]);
    expect(data.catalog.cabinets?.typeCabinetRules.some(({ code }) => code === "Sink-Base")).toBe(false);
    expect(data.catalog.countertops?.some(({ material }) => material === "Mineralmarmo")).toBe(false);
    expect(remote.loadConfigurator).not.toHaveBeenCalled();
    expect(remote.loadCountertopTable).not.toHaveBeenCalled();
    expect(remote.loadCabinetTable).not.toHaveBeenCalled();
  });

  it("fails a required source without substituting USH data", async () => {
    const fetchJson = jsonFetcher({
      [`${rootUrl}urban-standard-height/manifest.json`]: productionManifest,
      [`${rootUrl}urban-standard-height/navigation.json`]: productionNavigation,
      [`${rootUrl}urban-standard-height/presets.json`]: productionPresets,
      [`${rootUrl}urban-standard-height/static-options.json`]: productionStaticOptions,
      [`${rootUrl}urban-standard-height/cabinet-sku-mappings.json`]: productionSkuMappings,
    });
    const dependencies: CollectionRuntimeDependencies = {
      registryUrl,
      collectionsRootUrl: rootUrl,
      registry: productionRegistry,
      fetchJson,
      remote: {
        loadConfigurator: vi.fn(async () => configurator4),
        loadCountertopTable: vi.fn(async () => {
          throw new Error("countertop unavailable");
        }),
        loadCabinetTable: vi.fn(async () => datatable439),
      },
    };
    const registry = await loadCollectionRegistry(dependencies, abortSignal);
    const resolution = resolveCollection({ registry, urlCollectionId: null });
    if (!resolution.ok) throw new Error("Expected USH to resolve");
    await expect(loadResolvedCollection(resolution, dependencies, abortSignal)).rejects.toThrow("countertop unavailable");
  });
});
