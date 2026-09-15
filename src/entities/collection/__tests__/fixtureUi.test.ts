import { describe, expect, it, vi } from "vitest";

import registryFixture from "./fixtures/collections/registry.json";
import manifestFixture from "./fixtures/collections/fixture-ui/manifest.json";
import navigationFixture from "./fixtures/collections/fixture-ui/navigation.json";
import presetsFixture from "./fixtures/collections/fixture-ui/presets.json";
import profileFixture from "./fixtures/collections/fixture-ui/product-profile.json";
import bindingsFixture from "./fixtures/collections/fixture-ui/runtime-bindings.json";
import optionsFixture from "./fixtures/collections/fixture-ui/static-options.json";
import uiFixture from "./fixtures/collections/fixture-ui/ui.json";
import productionRegistry from "../../../../public/collections/registry.json";

import { loadCollectionRegistry, loadResolvedCollection } from "../lib/loadCollection";
import { selectOptionValues } from "../lib/productProfileSelectors";
import { resolveCollection } from "../lib/resolveCollection";
import { resolveRuntimeBinding } from "../lib/runtimeBindings/resolveRuntimeBinding";
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
      [`${rootUrl}fixture-ui/product-profile.json`]: profileFixture,
      [`${rootUrl}fixture-ui/ui.json`]: uiFixture,
      [`${rootUrl}fixture-ui/runtime-bindings.json`]: bindingsFixture,
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
    expect(data.catalog.productProfile?.collectionId).toBe("fixture-ui");
    expect(selectOptionValues(data.catalog.productProfile ?? null, "TestGrooveFinish")).toEqual(["test-finish"]);
    expect(data.catalog.customization?.sections["test-finish"]?.fields[0]?.attributeId).toBe("TestGrooveFinish");
    expect(resolveRuntimeBinding(data.catalog.runtimeBindings!, "TestGrooveFinish", "test-finish")).toMatchObject({
      ok: true,
      patch: { HandleGrooveColor: "test-finish" },
    });
    expect(data.diagnostics).toEqual([]);
    expect(data.sources.remote).toEqual({});
    expect(remote.loadConfigurator).not.toHaveBeenCalled();
    expect(remote.loadCountertopTable).not.toHaveBeenCalled();
    expect(remote.loadCabinetTable).not.toHaveBeenCalled();
  });

  it("keeps synthetic collection ids out of the production registry", () => {
    expect(productionRegistry.collections.map(({ id }) => id)).not.toContain("fixture-ui");
  });
});
