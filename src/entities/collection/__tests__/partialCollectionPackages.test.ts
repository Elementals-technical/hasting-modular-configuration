import { describe, expect, it, vi } from "vitest";

import productionRegistry from "../../../../public/collections/registry.json";
import urbanLowHeightManifest from "../../../../public/collections/urban-low-height/manifest.json";
import urbanLowHeightPresets from "../../../../public/collections/urban-low-height/presets.json";
import urbanLowHeightProductProfile from "../../../../public/collections/urban-low-height/product-profile.json";
import urbanLowHeightUi from "../../../../public/collections/urban-low-height/ui.json";
import classManifest from "../../../../public/collections/class/manifest.json";
import classPresets from "../../../../public/collections/class/presets.json";
import classProductProfile from "../../../../public/collections/class/product-profile.json";
import classRuntimeBindings from "../../../../public/collections/class/runtime-bindings.json";
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
import datatable577 from "./fixtures/remote/datatable-577.json";
import datatable578 from "./fixtures/remote/datatable-578.json";
import datatable579 from "./fixtures/remote/datatable-579.json";
import datatable580 from "./fixtures/remote/datatable-580.json";
import datatable581 from "./fixtures/remote/datatable-581.json";

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
    [`${collectionsRootUrl}class/runtime-bindings.json`]: classRuntimeBindings,
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

/** Tables of their own: Mako (577, 581), Class (578, 579) and Urban Low Height (580); the rest share USH's 438 / 439. */
const countertopTables: Record<string, unknown> = { 577: datatable577, 578: datatable578 };
const cabinetTables: Record<string, unknown> = { 579: datatable579, 580: datatable580, 581: datatable581 };

const makeRemote = (): RemoteCollectionLoader => ({
  loadConfigurator: vi.fn(async () => configurator4),
  loadCountertopTable: vi.fn(async (id: string | number) => countertopTables[id] ?? datatable438),
  loadCabinetTable: vi.fn(async (id: string | number) => cabinetTables[id] ?? datatable439),
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
    expect(remote.loadCabinetTable).toHaveBeenCalledWith(580, abortSignal);

    expect(data.id).toBe("urban-low-height");
    expect(data.manifest.label).toBe("Urban Low Height");
    expect(data.manifest.defaults).toEqual({});
    expect(data.catalog.customization?.collectionId).toBe("urban-low-height");
    expect(data.catalog.navigation?.prebuilt).toEqual([
      { id: "model", label: "Urban Low Height Models", path: "/prebuilt/model" },
      { id: "color", label: "Color", path: "/prebuilt/color" },
      { id: "countertop", label: "Countertop", path: "/prebuilt/countertop" },
      { id: "summary", label: "Summary", path: "/prebuilt/summary" },
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
    // Class places its own scene products (I) but has no model compositions yet, and its own cabinet
    // and countertop tables; Mako places its own scene products (I) and has the composition of every
    // model, its own tables and its own configurator.
    [
      "class",
      "Class",
      44,
      { "Sink-Base": "Class-sink-cabinet", "Sink-Cabinet": "Class-side-cabinet" },
      false,
      [[579, abortSignal]],
      578,
      9,
    ],
    [
      "mako",
      "Mako",
      42,
      { "Sink-Base": "Mako-sink-cabinet", "Sink-Cabinet": "Mako-side-cabinet" },
      true,
      [[581, abortSignal]],
      577,
      9,
    ],
  ])(
    "loads %s from only its declared local data and approved shared remotes",
    async (
      collectionId,
      label,
      modelCount,
      productTypes,
      hasCompositions,
      cabinetTableCalls,
      countertopTableId,
      configuratorId,
    ) => {
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
      expect(remote.loadConfigurator).toHaveBeenCalledWith(
        { id: configuratorId, view: "full", serialize: true },
        abortSignal,
      );
      expect(remote.loadCountertopTable).toHaveBeenCalledTimes(1);
      expect(remote.loadCountertopTable).toHaveBeenCalledWith(countertopTableId, abortSignal);
      expect(vi.mocked(remote.loadCabinetTable).mock.calls).toEqual(cabinetTableCalls);

      expect(data.id).toBe(collectionId);
      expect(data.manifest.label).toBe(label);
      expect(data.manifest.defaults).toEqual({});
      expect(data.catalog.customization?.collectionId).toBe(collectionId);
      expect(data.catalog.navigation?.prebuilt).toEqual([
        { id: "model", label: `${label} Models`, path: "/prebuilt/model" },
        { id: "color", label: "Color", path: "/prebuilt/color" },
        { id: "countertop", label: "Countertop & Basin", path: "/prebuilt/countertop" },
        { id: "faucet-holes", label: "Faucet Details", path: "/prebuilt/faucet-holes" },
        { id: "summary", label: "Summary", path: "/prebuilt/summary" },
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

  it("builds the Mako cabinet builder from its own cabinet rows, not the USH table", async () => {
    const dependencies: CollectionRuntimeDependencies = {
      registryUrl,
      collectionsRootUrl,
      registry: productionRegistry,
      fetchJson,
      remote: makeRemote(),
    };
    const registry = await loadCollectionRegistry(dependencies, abortSignal);
    const resolution = resolveCollection({ registry, urlCollectionId: "mako" });
    if (!resolution.ok) throw new Error("Expected Mako to resolve");

    const data = await loadResolvedCollection(resolution, dependencies, abortSignal);

    const common = {
      depths: [52],
      heights: [26, 52],
      drawers: ["1", "2"],
      isOpen: false,
      handlesAllowed: ["G57", "G50"],
      supportsHeight: [26, 52],
      // The height follows the drawer style: 1 drawer is 26 cm, 2 drawers 52 cm.
      forcedHeightByDrawers: { "1": 26, "2": 52 },
    };
    expect(data.catalog.cabinets?.typeCabinetRules).toEqual([
      expect.objectContaining({ code: "Sink-Base", widths: [60, 80, 100, 120], hasSink: true, ...common }),
      expect.objectContaining({ code: "Sink-Cabinet", widths: [40, 60, 80, 100, 120], hasSink: false, ...common }),
    ]);
  });

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
