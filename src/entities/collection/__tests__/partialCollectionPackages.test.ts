import { describe, expect, it, vi } from "vitest";

import productionRegistry from "../../../../public/collections/registry.json";
import urbanLowHeightManifest from "../../../../public/collections/urban-low-height/manifest.json";
import urbanLowHeightPresets from "../../../../public/collections/urban-low-height/presets.json";
import urbanLowHeightProductProfile from "../../../../public/collections/urban-low-height/product-profile.json";
import urbanLowHeightRuntimeBindings from "../../../../public/collections/urban-low-height/runtime-bindings.json";
import urbanLowHeightSkuProfile from "../../../../public/collections/urban-low-height/sku-profile.json";
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
import urbanFreestandingManifest from "../../../../public/collections/urban-freestanding/manifest.json";
import urbanFreestandingPresets from "../../../../public/collections/urban-freestanding/presets.json";
import urbanFreestandingProductProfile from "../../../../public/collections/urban-freestanding/product-profile.json";
import urbanFreestandingRuntimeBindings from "../../../../public/collections/urban-freestanding/runtime-bindings.json";
import urbanFreestandingSkuProfile from "../../../../public/collections/urban-freestanding/sku-profile.json";
import urbanFreestandingUi from "../../../../public/collections/urban-freestanding/ui.json";
import urbanDuplexManifest from "../../../../public/collections/urban-duplex/manifest.json";
import urbanDuplexPresets from "../../../../public/collections/urban-duplex/presets.json";
import urbanDuplexProductProfile from "../../../../public/collections/urban-duplex/product-profile.json";
import urbanDuplexRuntimeBindings from "../../../../public/collections/urban-duplex/runtime-bindings.json";
import urbanDuplexSkuProfile from "../../../../public/collections/urban-duplex/sku-profile.json";
import urbanDuplexUi from "../../../../public/collections/urban-duplex/ui.json";

import configurator4 from "./fixtures/remote/configurator-4.json";
import configurator9 from "./fixtures/remote/configurator-9.json";
import configurator11 from "./fixtures/remote/configurator-11.json";
import configurator13 from "./fixtures/remote/configurator-13.json";
import datatable438 from "./fixtures/remote/datatable-438.json";
import datatable439 from "./fixtures/remote/datatable-439.json";
import datatable577 from "./fixtures/remote/datatable-577.json";
import datatable578 from "./fixtures/remote/datatable-578.json";
import datatable579 from "./fixtures/remote/datatable-579.json";
import datatable580 from "./fixtures/remote/datatable-580.json";
import datatable581 from "./fixtures/remote/datatable-581.json";
import datatable589 from "./fixtures/remote/datatable-589.json";
import datatable590 from "./fixtures/remote/datatable-590.json";
import datatable591 from "./fixtures/remote/datatable-591.json";
import datatable594 from "./fixtures/remote/datatable-594.json";
import datatable595 from "./fixtures/remote/datatable-595.json";

import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";

import { loadCollectionRegistry, loadResolvedCollection } from "../lib/loadCollection";
import { normalizeOptionValue, selectAttribute } from "../lib/productProfileSelectors";
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
    [`${collectionsRootUrl}urban-low-height/runtime-bindings.json`]: urbanLowHeightRuntimeBindings,
    [`${collectionsRootUrl}urban-low-height/sku-profile.json`]: urbanLowHeightSkuProfile,
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
    [`${collectionsRootUrl}urban-freestanding/manifest.json`]: urbanFreestandingManifest,
    [`${collectionsRootUrl}urban-freestanding/presets.json`]: urbanFreestandingPresets,
    [`${collectionsRootUrl}urban-freestanding/product-profile.json`]: urbanFreestandingProductProfile,
    [`${collectionsRootUrl}urban-freestanding/runtime-bindings.json`]: urbanFreestandingRuntimeBindings,
    [`${collectionsRootUrl}urban-freestanding/sku-profile.json`]: urbanFreestandingSkuProfile,
    [`${collectionsRootUrl}urban-freestanding/ui.json`]: urbanFreestandingUi,
    [`${collectionsRootUrl}urban-duplex/manifest.json`]: urbanDuplexManifest,
    [`${collectionsRootUrl}urban-duplex/presets.json`]: urbanDuplexPresets,
    [`${collectionsRootUrl}urban-duplex/product-profile.json`]: urbanDuplexProductProfile,
    [`${collectionsRootUrl}urban-duplex/runtime-bindings.json`]: urbanDuplexRuntimeBindings,
    [`${collectionsRootUrl}urban-duplex/sku-profile.json`]: urbanDuplexSkuProfile,
    [`${collectionsRootUrl}urban-duplex/ui.json`]: urbanDuplexUi,
  };

  if (!(url in sources)) throw new Error(`Unexpected local request: ${url}`);
  return sources[url];
});

/**
 * Tables of their own: Mako (577, 581), Class (578, 579), Urban Low Height (589, 580), Urban Freestanding
 * (591, 590) and Urban Duplex (595, 594); the rest share USH's 438 / 439.
 */
const countertopTables: Record<string, unknown> = {
  577: datatable577,
  578: datatable578,
  589: datatable589,
  591: datatable591,
  595: datatable595,
};
const cabinetTables: Record<string, unknown> = {
  579: datatable579,
  580: datatable580,
  581: datatable581,
  590: datatable590,
  594: datatable594,
};

/** The configurator each manifest names: USH's 4, Mako's 9, and Urban Freestanding's and Urban Duplex's own. */
const configurators: Record<string, unknown> = {
  4: configurator4,
  9: configurator9,
  11: configurator11,
  13: configurator13,
};

const makeRemote = (): RemoteCollectionLoader => ({
  loadConfigurator: vi.fn<RemoteCollectionLoader["loadConfigurator"]>(async (reference) => {
    const configurator = reference ? configurators[reference.id] : undefined;
    if (!configurator) throw new Error(`Unexpected configurator request: ${JSON.stringify(reference)}`);
    return configurator;
  }),
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
    expect(remote.loadCountertopTable).toHaveBeenCalledWith(589, abortSignal);
    expect(remote.loadCabinetTable).toHaveBeenCalledTimes(1);
    expect(remote.loadCabinetTable).toHaveBeenCalledWith(580, abortSignal);

    expect(data.id).toBe("urban-low-height");
    expect(data.manifest.label).toBe("Urban Low Height");
    expect(data.manifest.defaults).toEqual({});
    expect(data.catalog.customization?.collectionId).toBe("urban-low-height");
    expect(data.catalog.navigation?.prebuilt).toEqual([
      { id: "model", label: "Urban Low Height Models", path: "/prebuilt/model" },
      { id: "color", label: "Color", path: "/prebuilt/color" },
      { id: "countertop", label: "Countertop & Basin", path: "/prebuilt/countertop" },
      { id: "accessories", label: "Accessories", path: "/prebuilt/accessories" },
      { id: "summary", label: "Summary", path: "/prebuilt/summary" },
    ]);
    // The 59 models of the master file; the six Multi-Level ones keep no composition until the scene has a lower level.
    expect(data.catalog.presets).toHaveLength(59);
    expect(data.catalog.presets?.filter(({ presetProducts }) => presetProducts.length === 0)).toHaveLength(6);
    // The profile carries only the confirmed product facts; the rest of the package is still missing.
    expect(data.catalog.productProfile?.collectionId).toBe("urban-low-height");
    // Three module types have their ULH scene product (I); Open Side Shelf has none yet, so its card
    // of table 580 is temporarily hidden until the scene has it.
    expect(data.catalog.runtimeBindings?.productTypes).toEqual({
      "Sink-Base": "ULH-sink-cabinet",
      "Side-Cabinet": "ULH-side-cabinet",
      "Open-Shelf": "ULH-Open-Shelf",
    });
    expect(data.catalog.cabinets?.typeCabinetRules.map(({ code }) => code)).toEqual([
      "Sink-Base",
      "Side-Cabinet",
      "Open-Shelf",
    ]);
    expect(data.catalog.cabinetSkuMappings).toBeUndefined();
    expect(data.sources.local).toMatchObject({ ui: { collectionId: "urban-low-height" } });
    expect(data.diagnostics).toEqual([]);
  });

  it.each([
    // Class places its own scene products (I) and has the composition of every model, and its own
    // cabinet and countertop tables; Mako places its own scene products (I) and has the composition of
    // every model, its own tables and its own configurator.
    [
      "class",
      "Class",
      44,
      { "Sink-Base": "Class-sink-cabinet", "Sink-Cabinet": "Class-side-cabinet" },
      true,
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

  it("loads Urban Freestanding with its own configurator and its own cabinet and countertop tables", async () => {
    const remote = makeRemote();
    const dependencies: CollectionRuntimeDependencies = {
      registryUrl,
      collectionsRootUrl,
      registry: productionRegistry,
      fetchJson,
      remote,
    };
    const registry = await loadCollectionRegistry(dependencies, abortSignal);
    const resolution = resolveCollection({ registry, urlCollectionId: "urban-freestanding" });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;

    const data = await loadResolvedCollection(resolution, dependencies, abortSignal);

    expect(remote.loadConfigurator).toHaveBeenCalledTimes(1);
    // Its own material configurator (modular-config-phase-2-materials-(Urban Freestanding)).
    expect(remote.loadConfigurator).toHaveBeenCalledWith({ id: 11, view: "full", serialize: true }, abortSignal);
    // Its own countertop table (matrix-coutnertop-UFS).
    expect(remote.loadCountertopTable).toHaveBeenCalledTimes(1);
    expect(remote.loadCountertopTable).toHaveBeenCalledWith(591, abortSignal);
    // Its own cabinet table (matrix-cabinet-UFS).
    expect(remote.loadCabinetTable).toHaveBeenCalledTimes(1);
    expect(remote.loadCabinetTable).toHaveBeenCalledWith(590, abortSignal);

    expect(data.id).toBe("urban-freestanding");
    expect(data.manifest.label).toBe("Urban Freestanding");
    expect(data.manifest.defaults).toEqual({});
    expect(data.catalog.customization?.collectionId).toBe("urban-freestanding");
    expect(data.catalog.navigation?.prebuilt).toEqual([
      { id: "model", label: "Model", path: "/prebuilt/model" },
      { id: "cabinet", label: "Color", path: "/prebuilt/color" },
      { id: "countertop", label: "Countertop & Basin", path: "/prebuilt/countertop" },
      { id: "accessories", label: "Accessories", path: "/prebuilt/accessories" },
      { id: "faucet-holes", label: "Faucet Details", path: "/prebuilt/faucet-holes" },
      { id: "summary", label: "Summary", path: "/prebuilt/summary" },
    ]);
    // The 54 models of the Master File, each composed as its render on the website shows it.
    expect(data.catalog.presets).toHaveLength(54);
    expect(data.catalog.presets?.every(({ presetProducts }) => presetProducts.length > 0)).toBe(true);
    // Its Style tags follow the composition. The Master File misses Open Shelving on four models and
    // Asymmetrical on three whose renders show otherwise; they are corrected here until it is fixed.
    for (const { style, presetProducts } of data.catalog.presets ?? []) {
      const layout = presetProducts.map(({ name, Width }) => `${name}:${Width}`);
      expect(style.includes("open_shelving")).toBe(presetProducts.some(({ name }) => name === "Open-Shelf"));
      expect(style.includes("double_basin")).toBe(
        presetProducts.filter(({ name }) => name === "Sink-Base").length === 2,
      );
      expect(style.includes("asymmetrical")).toBe(layout.join() !== [...layout].reverse().join());
    }
    expect(data.catalog.productProfile?.collectionId).toBe("urban-freestanding");
    // Every cabinet type has its UF scene product (I), the open shelves included.
    expect(data.catalog.runtimeBindings?.productTypes).toEqual({
      "Sink-Base": "UF-sink-cabinet",
      "Sink-Cabinet": "UF-side-cabinet",
      "Open-Shelf": "UF-open-shelves",
      "Side-Shelf": "UF-open-shelves-side",
    });
    // Priced from its own SKU words (D04), not the USH cabinet mappings.
    expect(data.catalog.skuProfile?.collectionId).toBe("urban-freestanding");
    expect(data.catalog.cabinetSkuMappings).toBeUndefined();

    const common = {
      depths: [50, 46],
      heights: [88, 91],
      drawers: ["2"],
      isOpen: false,
      // The handle styles of the price list: Upper Groove, Push-to-Open, Central Groove.
      handlesAllowed: ["UG", "PTO", "CG"],
      supportsHeight: [88, 91],
      // The height follows the handle, plinth included: Push-to-Open 88 cm, either groove 91 cm.
      forcedHeightByHandle: {
        UG: { "2": 91 },
        PTO: { "2": 88 },
        CG: { "2": 91 },
      },
      // Two drawers only, so the Central Groove needs no drawers rule.
      requiresDrawersByHandle: {},
    };
    // The open shelves of the price list, with no drawers or handles and so no forced height: the open
    // shelf at the height of the cabinets beside it (91 or 88), the open side shelf at 88 only.
    const shelf = {
      depths: [50, 46],
      drawers: [],
      isOpen: true,
      hasSink: false,
      handlesAllowed: [],
      forcedHeightByHandle: {},
      requiresDrawersByHandle: {},
    };
    expect(data.sources.remote.cabinetTable?.rows.map(({ cabinet_type }) => cabinet_type)).toEqual([
      "Sink-Base",
      "Sink-Cabinet",
      "Open-Shelf",
      "Side-Shelf",
    ]);
    expect(data.catalog.cabinets?.typeCabinetRules).toEqual([
      expect.objectContaining({
        code: "Sink-Base",
        widths: [60, 70, 80, 90, 105, 120],
        hasSink: true,
        sceneProductType: "UF-sink-cabinet",
        ...common,
      }),
      expect.objectContaining({
        code: "Sink-Cabinet",
        widths: [25, 35, 50, 60, 70, 80, 90, 105, 120],
        hasSink: false,
        sceneProductType: "UF-side-cabinet",
        ...common,
      }),
      expect.objectContaining({
        code: "Open-Shelf",
        widths: [25, 35, 50],
        heights: [88, 91],
        supportsHeight: [88, 91],
        sceneProductType: "UF-open-shelves",
        ...shelf,
      }),
      expect.objectContaining({
        code: "Side-Shelf",
        widths: [15],
        heights: [88],
        supportsHeight: [88],
        sceneProductType: "UF-open-shelves-side",
        ...shelf,
      }),
    ]);
    // The countertops of the Master File as table 438 has them, thin only and at the cabinet depths:
    // Solid-Surface as its Tekorlux Rectangular candidate (GEN-MAT-01), then HPL, Fenix and Porcelain.
    expect(data.catalog.countertops?.map(({ material, basinStyle }) => `${material}::${basinStyle}`)).toEqual([
      "Tekorlux::Rectangular 50",
      "HPL::Cover 50",
      "HPL::Prisma 50",
      "HPL::Quadra 50",
      "HPL::Strip 48",
      "Fenix::Cover 50",
      "Fenix::Prisma 50",
      "Fenix::Quadra 50",
      "Fenix::Strip 48",
      "Porcelain::Cover 48",
      "Porcelain::Strip 48",
      "Porcelain::Quadra 48",
      "Porcelain::Prisma 48",
    ]);
    for (const { topThicknesses, depths, maxUndermountCm } of data.catalog.countertops ?? []) {
      expect({ topThicknesses, depths, maxUndermountCm }).toEqual({
        topThicknesses: ["1/2"],
        depths: [50, 46],
        maxUndermountCm: null,
      });
    }
    expect(data.diagnostics).toEqual([]);
  });

  it("loads Urban Duplex from its local data and its own tables, its cabinets placed by the scene's UD products", async () => {
    const remote = makeRemote();
    const dependencies: CollectionRuntimeDependencies = {
      registryUrl,
      collectionsRootUrl,
      registry: productionRegistry,
      fetchJson,
      remote,
    };
    const registry = await loadCollectionRegistry(dependencies, abortSignal);
    const resolution = resolveCollection({ registry, urlCollectionId: "urban-duplex" });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;

    const data = await loadResolvedCollection(resolution, dependencies, abortSignal);

    expect(remote.loadConfigurator).toHaveBeenCalledTimes(1);
    // Its own material configurator (modular-config-phase-2-materials-(duplex)).
    expect(remote.loadConfigurator).toHaveBeenCalledWith({ id: 13, view: "full", serialize: true }, abortSignal);
    // Its own countertop table (matrix-coutnertop-duplex).
    expect(remote.loadCountertopTable).toHaveBeenCalledTimes(1);
    expect(remote.loadCountertopTable).toHaveBeenCalledWith(595, abortSignal);
    // Its own cabinet table (matrix-cabinet-duplex).
    expect(remote.loadCabinetTable).toHaveBeenCalledTimes(1);
    expect(remote.loadCabinetTable).toHaveBeenCalledWith(594, abortSignal);

    expect(data.id).toBe("urban-duplex");
    expect(data.manifest.label).toBe("Urban Duplex");
    expect(data.manifest.defaults).toEqual({});
    expect(data.catalog.customization?.collectionId).toBe("urban-duplex");
    expect(data.catalog.navigation?.prebuilt).toEqual([
      { id: "model", label: "Model", path: "/prebuilt/model" },
      { id: "cabinet", label: "Color", path: "/prebuilt/color" },
      { id: "countertop", label: "Countertop & Basin", path: "/prebuilt/countertop" },
      { id: "accessories", label: "Accessories", path: "/prebuilt/accessories" },
      { id: "faucet-holes", label: "Faucet Details", path: "/prebuilt/faucet-holes" },
      { id: "summary", label: "Summary", path: "/prebuilt/summary" },
    ]);
    // The 71 models of the Master File; the five Multi-Level ones are compact presets, composed in rows.
    expect(data.catalog.presets).toHaveLength(71);
    expect(
      data.catalog.presets?.filter(({ presetProducts }) => presetProducts.length === 0).map(({ id }) => id),
    ).toEqual([29, 34, 44, 45, 64]);
    // Every cabinet of a model speaks the profile's words: its type, its series, its style and the side
    // of its lateral panel.
    const profile = data.catalog.productProfile ?? null;
    const optionsOf = (attributeId: string) =>
      selectAttribute(profile, attributeId)?.options?.map(({ value }) => value) ?? [];
    const products = (data.catalog.presets ?? []).flatMap(({ presetProducts, rows }) => [
      ...presetProducts,
      ...(rows ?? []).flatMap((row) => row.products),
    ]);
    expect(products).toHaveLength(168);
    for (const { name, Drawers, Series, LateralPanelSide } of products) {
      expect(optionsOf("CabinetType")).toContain(name);
      if (Drawers !== undefined)
        expect(optionsOf("Drawers")).toContain(normalizeOptionValue(profile, "Drawers", Drawers));
      if (Series !== undefined) expect(optionsOf("Series")).toContain(Series);
      if (LateralPanelSide !== undefined) expect(optionsOf("LateralPanelSide")).toContain(LateralPanelSide);
    }
    expect(data.catalog.productProfile?.collectionId).toBe("urban-duplex");
    // The scene places the two drawer cabinets (I); the shelves wait for products of their own.
    expect(data.catalog.runtimeBindings?.productTypes).toEqual({
      "Sink-Base": "UD-sink-cabinet",
      "Sink-Cabinet": "UD-side-cabinet",
    });
    expect(Object.keys(data.catalog.runtimeBindings?.unplacedProductTypes ?? {})).toEqual(["Open-Shelf", "Side-Shelf"]);
    // Priced from its own SKU words (D04), not the USH cabinet mappings.
    expect(data.catalog.skuProfile?.collectionId).toBe("urban-duplex");
    expect(data.catalog.cabinetSkuMappings).toBeUndefined();
    // The profile names the tables the manifest loads.
    expect(data.catalog.productProfile?.sourceRefs).toEqual({
      configuratorId: data.manifest.remote?.configurator?.id,
      countertopMatrixTableId: data.manifest.remote?.countertopTable?.id,
      cabinetMatrixTableId: data.manifest.remote?.cabinetTable?.id,
    });
    expect(data.catalog.productProfile?.ruleData.cabinetMatrixLegacyAdapter.tableId).toBe(594);

    // The table has every cabinet type of the price list; the builder shows the cards of the two the
    // scene places, not the shelves (unplacedProductTypes).
    const cabinetTable = data.sources.remote.cabinetTable;
    expect(cabinetTable?.rows.map(({ cabinet_type }) => cabinet_type)).toEqual([
      "Sink-Base",
      "Sink-Cabinet",
      "Open-Shelf",
      "Side-Shelf",
    ]);
    expect(data.catalog.cabinets?.typeCabinetRules.map(({ code }) => code)).toEqual(["Sink-Base", "Sink-Cabinet"]);
    if (!cabinetTable || !profile) return;
    const drawerCabinet = {
      depths: [50, 46],
      heights: [56, 53, 38, 28],
      // 2 Drawer, 1 Drawer and 1 Drawer With Inner Drawer, Upper Groove only.
      drawers: ["2", "1", "1+inner"],
      isOpen: false,
      handlesAllowed: ["UG"],
      supportsHeight: [56, 53, 38, 28],
      // The style sets the height: the builder offers the standard ones until the Slim styles exist.
      forcedHeightByDrawers: { "2": 56, "1": 53, "1+inner": 53 },
      forcedHeightByHandle: {},
    };
    const openCabinet = { depths: [50, 46], heights: [56, 53, 38, 28], drawers: [], isOpen: true, handlesAllowed: [] };
    expect(buildCabinetCatalogFromMatrix(cabinetTable, profile).typeCabinetRules).toEqual([
      expect.objectContaining({
        code: "Sink-Base",
        widths: [60, 70, 80, 90, 105, 120],
        hasSink: true,
        ...drawerCabinet,
      }),
      // Side cabinets 60-120 cm as Pricing lists them; the narrower ones are Urban Standard Height's.
      expect.objectContaining({
        code: "Sink-Cabinet",
        widths: [60, 70, 80, 90, 105, 120],
        hasSink: false,
        ...drawerCabinet,
      }),
      expect.objectContaining({ code: "Open-Shelf", widths: [25, 35, 50, 60, 70], ...openCabinet }),
      expect.objectContaining({ code: "Side-Shelf", widths: [15], ...openCabinet }),
    ]);

    // The countertops of the Master File as Urban Low Height's table 589 has them, at the cabinet depths:
    // Solid-Surface as its Tekorlux Rectangular candidate (GEN-MAT-01), then HPL, Fenix and Porcelain.
    expect(data.catalog.countertops?.map(({ material, basinStyle }) => `${material}::${basinStyle}`)).toEqual([
      "Tekorlux::Rectangular 50",
      "HPL::Cover 50",
      "HPL::Prisma 50",
      "HPL::Quadra 50",
      "HPL::Strip 48",
      "Fenix::Cover 50",
      "Fenix::Prisma 50",
      "Fenix::Quadra 50",
      "Fenix::Strip 48",
      "Porcelain::Cover 48",
      "Porcelain::Strip 48",
      "Porcelain::Quadra 48",
      "Porcelain::Prisma 48",
    ]);
    // Urban Standard Height's thicknesses (P1064), and no undermount (GEN-TOP-15).
    for (const { material, topThicknesses, depths, maxUndermountCm } of data.catalog.countertops ?? []) {
      expect({ topThicknesses, depths, maxUndermountCm }).toEqual({
        topThicknesses: material === "Porcelain" ? ["1/2", "2-3/8", "4", "5-1/2"] : ["1/2", "4", "5-1/8"],
        depths: [50, 46],
        maxUndermountCm: null,
      });
    }
    expect(data.diagnostics).toEqual([]);
  });

  it.each([
    ["urban-low-height", urbanLowHeightUi],
    ["class", classUi],
    ["mako", makoUi],
    ["urban-freestanding", urbanFreestandingUi],
    ["urban-duplex", urbanDuplexUi],
  ])("validates the %s collection-specific UI contract", (collectionId, document) => {
    const result = validateCustomizationSchema(document);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.schema.collectionId).toBe(collectionId);
  });
});
