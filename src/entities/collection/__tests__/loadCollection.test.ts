import { describe, expect, it, vi } from "vitest";

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
import fixtureRulesManifest from "./fixtures/collections/fixture-rules/manifest.json";
import fixtureCabinetTable from "./fixtures/collections/fixture-rules/cabinet-table.json";
import fixtureCountertopTable from "./fixtures/collections/fixture-rules/countertop-table.json";
import configurator4 from "./fixtures/remote/configurator-4.json";
import datatable438 from "./fixtures/remote/datatable-438.json";
import datatable439 from "./fixtures/remote/datatable-439.json";

import { loadCollectionRegistry, loadResolvedCollection } from "../lib/loadCollection";
import { toCollectionError } from "../model/errors";
import type { ProfileDiagnostic } from "../lib/parseProductProfile";
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

const loadUshLocalContract = async (manifest: unknown, sources: Record<string, unknown>) => {
  const manifestUrl = `${rootUrl}urban-standard-height/manifest.json`;
  const dependencies: CollectionRuntimeDependencies = {
    registryUrl,
    collectionsRootUrl: rootUrl,
    registry: productionRegistry,
    fetchJson: jsonFetcher({ [manifestUrl]: manifest, ...sources }),
    remote: unusedRemote(),
  };
  const registry = await loadCollectionRegistry(dependencies, abortSignal);
  const resolution = resolveCollection({ registry, urlCollectionId: null });
  if (!resolution.ok) throw new Error("Expected USH to resolve");
  return loadResolvedCollection(resolution, dependencies, abortSignal);
};

describe("collection loading and assembly", () => {
  it("reports a broken product profile with its diagnostics instead of loading it", async () => {
    const manifestUrl = `${rootUrl}urban-standard-height/manifest.json`;
    const brokenProfile = JSON.parse(JSON.stringify(productionProductProfile)) as {
      attributes: { attributeId: string; options?: { value: string; label: string; order: number }[] }[];
    };
    const handle = brokenProfile.attributes.find(({ attributeId }) => attributeId === "Handle");
    handle?.options?.push({ value: "handle_pto", label: "Duplicate", order: 40 });

    const fetchJson = jsonFetcher({
      [registryUrl]: productionRegistry,
      [manifestUrl]: productionManifest,
      [`${rootUrl}urban-standard-height/navigation.json`]: productionNavigation,
      [`${rootUrl}urban-standard-height/presets.json`]: productionPresets,
      [`${rootUrl}urban-standard-height/static-options.json`]: productionStaticOptions,
      [`${rootUrl}urban-standard-height/product-profile.json`]: brokenProfile,
      [`${rootUrl}urban-standard-height/cabinet-sku-mappings.json`]: productionSkuMappings,
      [`${rootUrl}urban-standard-height/ui.json`]: productionUi,
      [`${rootUrl}urban-standard-height/runtime-bindings.json`]: productionRuntimeBindings,
    });

    const dependencies: CollectionRuntimeDependencies = {
      registryUrl,
      collectionsRootUrl: rootUrl,
      fetchJson,
      remote: {
        loadConfigurator: vi.fn(async () => configurator4),
        loadCountertopTable: vi.fn(async () => datatable438),
        loadCabinetTable: vi.fn(async () => datatable439),
      },
    };

    const registry = await loadCollectionRegistry(dependencies, abortSignal);
    const resolution = resolveCollection({ registry, urlCollectionId: null });
    if (!resolution.ok) throw new Error("Expected a resolved collection");

    const error = await loadResolvedCollection(resolution, dependencies, abortSignal).then(
      () => null,
      (caught: unknown) => toCollectionError(caught),
    );

    expect(error?.code).toBe("source-validation-failed");
    expect(error?.message).toContain("/attributes/Handle/options/3/value");

    // The structured diagnostics survive as data, so a consumer does not have to parse
    // them back out of the message.
    const diagnostics = error?.cause as ProfileDiagnostic[];
    expect(diagnostics[0]).toMatchObject({
      code: "attribute.duplicate_option",
      dataPath: "/attributes/Handle/options/3/value",
    });
  });

  it("loads the complete default USH package and starts all declared remote sources in parallel", async () => {
    const manifestUrl = `${rootUrl}urban-standard-height/manifest.json`;
    const fetchJson = jsonFetcher({
      [registryUrl]: productionRegistry,
      [manifestUrl]: productionManifest,
      [`${rootUrl}urban-standard-height/navigation.json`]: productionNavigation,
      [`${rootUrl}urban-standard-height/presets.json`]: productionPresets,
      [`${rootUrl}urban-standard-height/static-options.json`]: productionStaticOptions,
      [`${rootUrl}urban-standard-height/product-profile.json`]: productionProductProfile,
      [`${rootUrl}urban-standard-height/cabinet-sku-mappings.json`]: productionSkuMappings,
      [`${rootUrl}urban-standard-height/ui.json`]: productionUi,
      [`${rootUrl}urban-standard-height/runtime-bindings.json`]: productionRuntimeBindings,
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

    expect(remote.loadConfigurator).toHaveBeenCalledWith({ id: 4, view: "full", serialize: true }, abortSignal);
    expect(remote.loadCountertopTable).toHaveBeenCalledWith(438, abortSignal);
    expect(remote.loadCabinetTable).toHaveBeenCalledWith(439, abortSignal);
    expect(data.id).toBe("urban-standard-height");
    expect(data.catalog.presets).toHaveLength(54);
    expect(data.catalog.presets?.flatMap(({ presetProducts }) => presetProducts)).toHaveLength(123);
    expect(new Set(data.catalog.presets?.map(({ id }) => id)).size).toBe(54);
    expect(data.catalog.presets?.[0]?.id).toBe(1);
    expect(data.catalog.presets?.every(({ img }) => img.startsWith(`${rootUrl}urban-standard-height/images/`))).toBe(
      true,
    );
    expect(data.sources.remote.configurator?.availableOptions[0]?.options[0]?.variants[0]?.metadata).toHaveProperty(
      "codeColor",
    );
    expect(data.catalog.configurator?.groupsByName["Cabinet Color"]?.proxyName).toBe("Cabinet Color");
    expect(data.catalog.cabinets?.typeCabinetRules).toHaveLength(4);
    expect(data.catalog.countertops).toHaveLength(27);

    // The profile reaches the loader and normalizes the legacy matrix: handle-specific
    // columns become a generic relation keyed by handle id.
    expect(data.catalog.productProfile?.collectionId).toBe("urban-standard-height");
    expect(data.sources.local.ui?.collectionId).toBe("urban-standard-height");
    expect(data.catalog.customization?.flows.custom.entryStepId).toBe("cabinet-builder");
    expect(data.sources.local.runtimeBindings?.collectionId).toBe("urban-standard-height");
    expect(data.catalog.runtimeBindings?.bindings.length).toBeGreaterThan(0);
    expect(data.diagnostics).toEqual([]);
    expect(data.catalog.navigation).toEqual(productionNavigation);

    const sinkBase = data.catalog.cabinets?.typeCabinetRules.find(({ code }) => code === "Sink-Base");
    expect(sinkBase?.forcedHeightByHandle).toEqual({
      handle_pto: { "1": 50, "2": 50, "1+inner": 50 },
      handle_urban_topcut: { "1": 53, "2": 56, "1+inner": 53 },
      handle_urban_botcut: { "2": 53 },
    });
    expect(sinkBase?.requiresDrawersByHandle).toEqual({ handle_urban_botcut: ["2"] });
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
      [`${rootUrl}urban-standard-height/product-profile.json`]: productionProductProfile,
      [`${rootUrl}urban-standard-height/cabinet-sku-mappings.json`]: productionSkuMappings,
      [`${rootUrl}urban-standard-height/ui.json`]: productionUi,
      [`${rootUrl}urban-standard-height/runtime-bindings.json`]: productionRuntimeBindings,
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
    await expect(loadResolvedCollection(resolution, dependencies, abortSignal)).rejects.toThrow(
      "countertop unavailable",
    );
  });

  it("rejects customization data written for another collection", async () => {
    const manifestUrl = `${rootUrl}urban-standard-height/manifest.json`;
    const fetchJson = jsonFetcher({
      [manifestUrl]: productionManifest,
      [`${rootUrl}urban-standard-height/navigation.json`]: productionNavigation,
      [`${rootUrl}urban-standard-height/presets.json`]: productionPresets,
      [`${rootUrl}urban-standard-height/static-options.json`]: productionStaticOptions,
      [`${rootUrl}urban-standard-height/product-profile.json`]: productionProductProfile,
      [`${rootUrl}urban-standard-height/cabinet-sku-mappings.json`]: productionSkuMappings,
      [`${rootUrl}urban-standard-height/ui.json`]: { ...productionUi, collectionId: "copied-collection" },
      [`${rootUrl}urban-standard-height/runtime-bindings.json`]: productionRuntimeBindings,
    });
    const dependencies: CollectionRuntimeDependencies = {
      registryUrl,
      collectionsRootUrl: rootUrl,
      registry: productionRegistry,
      fetchJson,
      remote: {
        loadConfigurator: vi.fn(async () => configurator4),
        loadCountertopTable: vi.fn(async () => datatable438),
        loadCabinetTable: vi.fn(async () => datatable439),
      },
    };
    const registry = await loadCollectionRegistry(dependencies, abortSignal);
    const resolution = resolveCollection({ registry, urlCollectionId: null });
    if (!resolution.ok) throw new Error("Expected USH to resolve");

    await expect(loadResolvedCollection(resolution, dependencies, abortSignal)).rejects.toThrow(
      "does not match manifest",
    );
  });

  it("rejects legacy navigation that diverges from the customization schema", async () => {
    const manifestUrl = `${rootUrl}urban-standard-height/manifest.json`;
    const fetchJson = jsonFetcher({
      [manifestUrl]: productionManifest,
      [`${rootUrl}urban-standard-height/navigation.json`]: {
        ...productionNavigation,
        prebuilt: productionNavigation.prebuilt.map((step, index) =>
          index === 0 ? { ...step, label: "Stale Model Label" } : step,
        ),
      },
      [`${rootUrl}urban-standard-height/presets.json`]: productionPresets,
      [`${rootUrl}urban-standard-height/static-options.json`]: productionStaticOptions,
      [`${rootUrl}urban-standard-height/product-profile.json`]: productionProductProfile,
      [`${rootUrl}urban-standard-height/cabinet-sku-mappings.json`]: productionSkuMappings,
      [`${rootUrl}urban-standard-height/ui.json`]: productionUi,
      [`${rootUrl}urban-standard-height/runtime-bindings.json`]: productionRuntimeBindings,
    });
    const dependencies: CollectionRuntimeDependencies = {
      registryUrl,
      collectionsRootUrl: rootUrl,
      registry: productionRegistry,
      fetchJson,
      remote: {
        loadConfigurator: vi.fn(async () => configurator4),
        loadCountertopTable: vi.fn(async () => datatable438),
        loadCabinetTable: vi.fn(async () => datatable439),
      },
    };
    const registry = await loadCollectionRegistry(dependencies, abortSignal);
    const resolution = resolveCollection({ registry, urlCollectionId: null });
    if (!resolution.ok) throw new Error("Expected USH to resolve");

    await expect(loadResolvedCollection(resolution, dependencies, abortSignal)).rejects.toThrow(
      "Navigation data does not match customization schema at prebuilt[0].label",
    );
  });

  it("normalizes malformed runtime-binding parser diagnostics into collection diagnostics", async () => {
    const loading = loadUshLocalContract(
      {
        id: "urban-standard-height",
        label: "USH local contract",
        defaults: {},
        local: { runtimeBindings: "runtime-bindings.json" },
      },
      { [`${rootUrl}urban-standard-height/runtime-bindings.json`]: {} },
    );

    const error = await loading.then(
      () => null,
      (caught: unknown) => toCollectionError(caught),
    );
    expect(error?.cause).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "bindings.missing_field",
          severity: "error",
          dataset: "runtimeBindings",
          dataPath: "/schemaVersion",
        }),
      ]),
    );
  });

  it("requires ProductProfile when a collection declares runtime bindings", async () => {
    const loading = loadUshLocalContract(
      {
        id: "urban-standard-height",
        label: "USH local contract",
        defaults: {},
        local: { runtimeBindings: "runtime-bindings.json" },
      },
      { [`${rootUrl}urban-standard-height/runtime-bindings.json`]: productionRuntimeBindings },
    );

    const error = await loading.then(
      () => null,
      (caught: unknown) => toCollectionError(caught),
    );
    expect(error?.cause).toEqual([
      expect.objectContaining({
        code: "runtime.missing-product-profile",
        severity: "error",
        dataset: "runtimeBindings",
      }),
    ]);
  });

  it("rejects a missing required runtime binding before the collection becomes ready", async () => {
    const runtimeBindings = {
      ...productionRuntimeBindings,
      bindings: productionRuntimeBindings.bindings.filter(({ attributeId }) => attributeId !== "Handle"),
    };
    const loading = loadUshLocalContract(
      {
        id: "urban-standard-height",
        label: "USH local contract",
        defaults: {},
        local: {
          productProfile: "product-profile.json",
          ui: "ui.json",
          runtimeBindings: "runtime-bindings.json",
        },
      },
      {
        [`${rootUrl}urban-standard-height/product-profile.json`]: productionProductProfile,
        [`${rootUrl}urban-standard-height/ui.json`]: productionUi,
        [`${rootUrl}urban-standard-height/runtime-bindings.json`]: runtimeBindings,
      },
    );

    const error = await loading.then(
      () => null,
      (caught: unknown) => toCollectionError(caught),
    );
    expect(error?.cause).toContainEqual(
      expect.objectContaining({
        code: "runtime.missing-binding",
        severity: "error",
        dataset: "runtimeBindings",
        message: expect.stringContaining("Handle"),
      }),
    );
  });

  it("keeps an orphan runtime binding as a ready-data warning", async () => {
    const runtimeBindings = {
      ...productionRuntimeBindings,
      bindings: [
        ...productionRuntimeBindings.bindings,
        { attributeId: "OldAttribute", status: "unbound", reason: "Removed from the active contract" },
      ],
    };
    const data = await loadUshLocalContract(
      {
        id: "urban-standard-height",
        label: "USH local contract",
        defaults: {},
        local: {
          productProfile: "product-profile.json",
          ui: "ui.json",
          runtimeBindings: "runtime-bindings.json",
        },
      },
      {
        [`${rootUrl}urban-standard-height/product-profile.json`]: productionProductProfile,
        [`${rootUrl}urban-standard-height/ui.json`]: productionUi,
        [`${rootUrl}urban-standard-height/runtime-bindings.json`]: runtimeBindings,
      },
    );

    expect(data.diagnostics).toEqual([
      expect.objectContaining({
        code: "runtime.orphan-binding",
        severity: "warning",
        dataset: "runtimeBindings",
        message: expect.stringContaining("OldAttribute"),
      }),
    ]);
  });

  it("rejects ProductProfile identity that does not match the manifest", async () => {
    const loading = loadUshLocalContract(
      {
        id: "urban-standard-height",
        label: "USH local contract",
        defaults: {},
        local: { productProfile: "product-profile.json" },
      },
      {
        [`${rootUrl}urban-standard-height/product-profile.json`]: {
          ...productionProductProfile,
          collectionId: "copied-collection",
        },
      },
    );

    const error = await loading.then(
      () => null,
      (caught: unknown) => toCollectionError(caught),
    );
    expect(error?.cause).toContainEqual(
      expect.objectContaining({
        code: "profile.collection-mismatch",
        severity: "error",
        dataset: "productProfile",
      }),
    );
  });
});
