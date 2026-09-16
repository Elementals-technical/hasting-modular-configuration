import { describe, expect, it, vi } from "vitest";

import productionRegistry from "../../../../public/collections/registry.json";
import urbanLowHeightManifest from "../../../../public/collections/urban-low-height/manifest.json";
import urbanLowHeightProductProfile from "../../../../public/collections/urban-low-height/product-profile.json";
import urbanLowHeightUi from "../../../../public/collections/urban-low-height/ui.json";
import classManifest from "../../../../public/collections/class/manifest.json";
import classUi from "../../../../public/collections/class/ui.json";

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
    [`${collectionsRootUrl}urban-low-height/product-profile.json`]: urbanLowHeightProductProfile,
    [`${collectionsRootUrl}urban-low-height/ui.json`]: urbanLowHeightUi,
    [`${collectionsRootUrl}class/manifest.json`]: classManifest,
    [`${collectionsRootUrl}class/ui.json`]: classUi,
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
    expect(data.catalog.presets).toBeUndefined();
    // The profile carries only the confirmed product facts; the rest of the package is still missing.
    expect(data.catalog.productProfile?.collectionId).toBe("urban-low-height");
    expect(data.catalog.runtimeBindings).toBeUndefined();
    expect(data.catalog.cabinetSkuMappings).toBeUndefined();
    expect(data.sources.local).toMatchObject({ ui: { collectionId: "urban-low-height" } });
    expect(data.diagnostics).toEqual([]);
  });

  it("loads Class from only its declared local data and approved shared remotes", async () => {
    const remote = makeRemote();
    const dependencies: CollectionRuntimeDependencies = {
      registryUrl,
      collectionsRootUrl,
      registry: productionRegistry,
      fetchJson,
      remote,
    };
    const registry = await loadCollectionRegistry(dependencies, abortSignal);
    const resolution = resolveCollection({ registry, urlCollectionId: "class" });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;

    const data = await loadResolvedCollection(resolution, dependencies, abortSignal);

    expect(remote.loadConfigurator).toHaveBeenCalledTimes(1);
    expect(remote.loadConfigurator).toHaveBeenCalledWith({ id: 4, view: "full", serialize: true }, abortSignal);
    expect(remote.loadCountertopTable).toHaveBeenCalledTimes(1);
    expect(remote.loadCountertopTable).toHaveBeenCalledWith(438, abortSignal);
    expect(remote.loadCabinetTable).toHaveBeenCalledTimes(1);
    expect(remote.loadCabinetTable).toHaveBeenCalledWith(439, abortSignal);

    expect(data.id).toBe("class");
    expect(data.manifest.label).toBe("Class");
    expect(data.manifest.defaults).toEqual({});
    expect(data.catalog.customization?.collectionId).toBe("class");
    expect(data.catalog.navigation?.prebuilt).toEqual([
      { id: "model", label: "Class Models", path: "/prebuilt/model" },
    ]);
    expect(data.catalog.presets).toBeUndefined();
    expect(data.catalog.productProfile).toBeUndefined();
    expect(data.catalog.runtimeBindings).toBeUndefined();
    expect(data.catalog.cabinetSkuMappings).toBeUndefined();
    expect(data.sources.local).toMatchObject({ ui: { collectionId: "class" } });
    expect(data.diagnostics).toEqual([]);
  });

  it.each([
    ["urban-low-height", urbanLowHeightUi],
    ["class", classUi],
  ])("validates the %s collection-specific UI contract", (collectionId, document) => {
    const result = validateCustomizationSchema(document);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.schema.collectionId).toBe(collectionId);
  });
});
