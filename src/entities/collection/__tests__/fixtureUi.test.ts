import { describe, expect, it, vi } from "vitest";

import registryFixture from "./fixtures/collections/registry.json";
import manifestFixture from "./fixtures/collections/fixture-ui/manifest.json";
import navigationFixture from "./fixtures/collections/fixture-ui/navigation.json";
import presetsFixture from "./fixtures/collections/fixture-ui/presets.json";
import optionsFixture from "./fixtures/collections/fixture-ui/static-options.json";

import { loadCollectionRegistry, loadResolvedCollection } from "../lib/loadCollection";
import { resolveCollection } from "../lib/resolveCollection";
import type { CollectionRuntimeDependencies } from "../model/types";

describe("fixture-ui collection", () => {
  it("loads distinct UI data without requesting a production remote source", async () => {
    const rootUrl = "https://app.test/collections/";
    const remote = {
      loadConfigurator: vi.fn(async () => Promise.reject(new Error("Unexpected remote request"))),
      loadCountertopTable: vi.fn(async () => Promise.reject(new Error("Unexpected remote request"))),
      loadCabinetTable: vi.fn(async () => Promise.reject(new Error("Unexpected remote request"))),
    };
    const values: Record<string, unknown> = {
      [`${rootUrl}fixture-ui/manifest.json`]: manifestFixture,
      [`${rootUrl}fixture-ui/navigation.json`]: navigationFixture,
      [`${rootUrl}fixture-ui/presets.json`]: presetsFixture,
      [`${rootUrl}fixture-ui/static-options.json`]: optionsFixture,
    };
    const dependencies: CollectionRuntimeDependencies = {
      registryUrl: `${rootUrl}registry.json`,
      collectionsRootUrl: rootUrl,
      registry: registryFixture,
      fetchJson: vi.fn(async (url) => values[url]),
      remote,
    };
    const signal = new AbortController().signal;
    const registry = await loadCollectionRegistry(dependencies, signal);
    const resolution = resolveCollection({ registry, urlCollectionId: "fixture-ui" });
    if (!resolution.ok) throw new Error("fixture-ui did not resolve");
    const data = await loadResolvedCollection(resolution, dependencies, signal);

    expect(data.id).toBe("fixture-ui");
    expect(data.catalog.navigation?.prebuilt[0]?.label).toBe("Fixture Models");
    expect(data.catalog.presets?.[0]?.id).toBe(901);
    expect(data.catalog.staticOptions?.cabinetTypes).toEqual(["Fixture-Cabinet"]);
    expect(data.manifest.defaults.CabinetColor).toBe("Fixture Blue");
    expect(data.sources.remote).toEqual({});
    expect(remote.loadConfigurator).not.toHaveBeenCalled();
    expect(remote.loadCountertopTable).not.toHaveBeenCalled();
    expect(remote.loadCabinetTable).not.toHaveBeenCalled();
  });
});
