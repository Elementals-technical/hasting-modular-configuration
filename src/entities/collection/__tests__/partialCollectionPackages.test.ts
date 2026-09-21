import { describe, expect, it, vi } from "vitest";

import productionRegistry from "../../../../public/collections/registry.json";
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

import configurator4 from "./fixtures/remote/configurator-4.json";
import datatable438 from "./fixtures/remote/datatable-438.json";
import datatable439 from "./fixtures/remote/datatable-439.json";

import { loadCollectionRegistry, loadResolvedCollection } from "../lib/loadCollection";
import { resolveCollection } from "../lib/resolveCollection";
import { validateCustomizationSchema } from "../lib/customization/validateCustomizationSchema";
import type { CollectionRuntimeDependencies, RemoteCollectionLoader } from "../model/types";

const registryUrl = "https://app.test/collections/registry.json";
const collectionsRootUrl = "https://app.test/collections/";
const abortSignal = new AbortController().signal;

const fetchJson = vi.fn(async (url: string) => {
  const sources: Record<string, unknown> = {
    [`${collectionsRootUrl}urban-low-height/manifest.json`]: urbanLowHeightManifest,
    [`${collectionsRootUrl}urban-low-height/presets.json`]: urbanLowHeightPresets,
    [`${collectionsRootUrl}urban-low-height/product-profile.json`]: urbanLowHeightProductProfile,
    [`${collectionsRootUrl}urban-low-height/ui.json`]: urbanLowHeightUi,
    [`${collectionsRootUrl}class/manifest.json`]: classManifest,
    [`${collectionsRootUrl}class/presets.json`]: classPresets,
    [`${collectionsRootUrl}class/product-profile.json`]: classProductProfile,
    [`${collectionsRootUrl}class/sku-profile.json`]: classSkuProfile,
    [`${collectionsRootUrl}class/ui.json`]: classUi,
    [`${collectionsRootUrl}mako/manifest.json`]: makoManifest,
    [`${collectionsRootUrl}mako/presets.json`]: makoPresets,
    [`${collectionsRootUrl}mako/product-profile.json`]: makoProductProfile,
    [`${collectionsRootUrl}mako/runtime-bindings.json`]: makoRuntimeBindings,
    [`${collectionsRootUrl}mako/sku-profile.json`]: makoSkuProfile,
    [`${collectionsRootUrl}mako/ui.json`]: makoUi,
  };

  if (!(url in sources)) throw new Error(`Unexpected local request: ${url}`);
  return sources[url];
});

const makeRemote = (): RemoteCollectionLoader => ({
  loadConfigurator: vi.fn(async () => configurator4),
  loadCountertopTable: vi.fn(async () => datatable438),
  loadCabinetTable: vi.fn(async () => datatable439),
});

describe("partial production collection packages", () => {
  it("loads Urban Low Height from only its declared local data and approved shared remotes", async () => {
    const remote = makeRemote();
    const dependencies: CollectionRuntimeDependencies = {
      registryUrl,
      collectionsRootUrl,
      registry: productionRegistry,
      fetchJson,
      remote,
    };
    const registry = await loadCollectionRegistry(dependencies, abortSignal);
    const resolution = resolveCollection({ registry, urlCollectionId: "urban-low-height" });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;

    const data = await loadResolvedCollection(resolution, dependencies, abortSignal);

    expect(remote.loadConfigurator).toHaveBeenCalledTimes(1);
    expect(remote.loadConfigurator).toHaveBeenCalledWith({ id: 4, view: "full", serialize: true }, abortSignal);
    expect(remote.loadCountertopTable).toHaveBeenCalledTimes(1);
    expect(remote.loadCountertopTable).toHaveBeenCalledWith(438, abortSignal);
    expect(remote.loadCabinetTable).toHaveBeenCalledTimes(1);
    expect(remote.loadCabinetTable).toHaveBeenCalledWith(439, abortSignal);

    expect(data.id).toBe("urban-low-height");
    expect(data.manifest.label).toBe("Urban Low Height");
    expect(data.manifest.defaults).toEqual({});
    expect(data.catalog.customization?.collectionId).toBe("urban-low-height");
    expect(data.catalog.navigation?.prebuilt).toEqual([
      { id: "model", label: "Urban Low Height Models", path: "/prebuilt/model" },
    ]);
    // The 59 models of the master file, without their composition until the BOM is confirmed.
    expect(data.catalog.presets).toHaveLength(59);
    expect(data.catalog.presets?.every(({ presetProducts }) => presetProducts.length === 0)).toBe(true);
    // The profile carries only the confirmed product facts; the rest of the package is still missing.
    expect(data.catalog.productProfile?.collectionId).toBe("urban-low-height");
    expect(data.catalog.runtimeBindings).toBeUndefined();
    expect(data.catalog.cabinetSkuMappings).toBeUndefined();
    expect(data.sources.local).toMatchObject({ ui: { collectionId: "urban-low-height" } });
    expect(data.diagnostics).toEqual([]);
  });

  it.each([
    // Class has no scene bindings and no model compositions yet; Mako places its own scene products (I)
    // and has the composition of every model.
    ["class", "Class", 44, undefined, false],
    ["mako", "Mako", 42, { "Sink-Base": "Mako-sink-cabinet", "Sink-Cabinet": "Mako-side-cabinet" }, true],
  ])(
    "loads %s from only its declared local data and approved shared remotes",
    async (collectionId, label, modelCount, productTypes, hasCompositions) => {
      const remote = makeRemote();
      const dependencies: CollectionRuntimeDependencies = {
        registryUrl,
        collectionsRootUrl,
        registry: productionRegistry,
        fetchJson,
        remote,
      };
      const registry = await loadCollectionRegistry(dependencies, abortSignal);
      const resolution = resolveCollection({ registry, urlCollectionId: collectionId });
      expect(resolution.ok).toBe(true);
      if (!resolution.ok) return;

      const data = await loadResolvedCollection(resolution, dependencies, abortSignal);

      expect(remote.loadConfigurator).toHaveBeenCalledTimes(1);
      expect(remote.loadConfigurator).toHaveBeenCalledWith({ id: 4, view: "full", serialize: true }, abortSignal);
      expect(remote.loadCountertopTable).toHaveBeenCalledTimes(1);
      expect(remote.loadCountertopTable).toHaveBeenCalledWith(438, abortSignal);
      expect(remote.loadCabinetTable).toHaveBeenCalledTimes(1);
      expect(remote.loadCabinetTable).toHaveBeenCalledWith(439, abortSignal);

      expect(data.id).toBe(collectionId);
      expect(data.manifest.label).toBe(label);
      expect(data.manifest.defaults).toEqual({});
      expect(data.catalog.customization?.collectionId).toBe(collectionId);
      expect(data.catalog.navigation?.prebuilt).toEqual([
        { id: "model", label: `${label} Models`, path: "/prebuilt/model" },
      ]);
      // The models of the Master File, with their composition once the model recipes are given.
      expect(data.catalog.presets).toHaveLength(modelCount);
      expect(data.catalog.presets?.every(({ presetProducts }) => presetProducts.length > 0)).toBe(hasCompositions);
      expect(data.catalog.presets?.some(({ presetProducts }) => presetProducts.length > 0)).toBe(hasCompositions);
      // The profile carries only what the collection documents confirm; the rest of the package is still missing.
      expect(data.catalog.productProfile?.collectionId).toBe(collectionId);
      expect(data.catalog.runtimeBindings?.productTypes).toEqual(productTypes);
      expect(data.catalog.cabinetSkuMappings).toBeUndefined();
      // Priced from its own SKU words (D04), not the USH cabinet mappings.
      expect(data.catalog.skuProfile?.collectionId).toBe(collectionId);
      expect(data.sources.local).toMatchObject({ ui: { collectionId } });
      expect(data.diagnostics).toEqual([]);
    },
  );

  it.each([
    ["urban-low-height", urbanLowHeightUi],
    ["class", classUi],
    ["mako", makoUi],
  ])("validates the %s collection-specific UI contract", (collectionId, document) => {
    const result = validateCustomizationSchema(document);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.schema.collectionId).toBe(collectionId);
  });
});
