import { describe, expect, it, vi } from "vitest";

import { applyConfiguratorRules } from "@/features/configurator-rule-core/cabinetBuilder";

import productionRegistry from "../../../../public/collections/registry.json";
import fixtureRegistry from "./fixtures/collections/registry.json";
import cabinetTable from "./fixtures/collections/fixture-rules/cabinet-table.json";
import countertopTable from "./fixtures/collections/fixture-rules/countertop-table.json";
import manifest from "./fixtures/collections/fixture-rules/manifest.json";
import productProfile from "./fixtures/collections/fixture-rules/product-profile.json";
import runtimeBindings from "./fixtures/collections/fixture-rules/runtime-bindings.json";
import ui from "./fixtures/collections/fixture-rules/ui.json";

import { loadCollectionRegistry, loadResolvedCollection } from "../lib/loadCollection";
import { selectOptionValues } from "../lib/productProfileSelectors";
import { resolveCollection } from "../lib/resolveCollection";
import { resolveRuntimeBinding } from "../lib/runtimeBindings/resolveRuntimeBinding";
import type { CollectionRuntimeDependencies } from "../model/types";

const rootUrl = "https://app.test/collections/";

const loadFixtureRules = async () => {
  const values: Record<string, unknown> = {
    [`${rootUrl}fixture-rules/manifest.json`]: manifest,
    [`${rootUrl}fixture-rules/product-profile.json`]: productProfile,
    [`${rootUrl}fixture-rules/runtime-bindings.json`]: runtimeBindings,
    [`${rootUrl}fixture-rules/ui.json`]: ui,
  };
  const remote = {
    loadConfigurator: vi.fn(async () => Promise.reject(new Error("Unexpected remote request"))),
    loadCountertopTable: vi.fn(async () => Promise.reject(new Error("Unexpected remote request"))),
    loadCabinetTable: vi.fn(async () => Promise.reject(new Error("Unexpected remote request"))),
  };
  const dependencies: CollectionRuntimeDependencies = {
    registryUrl: `${rootUrl}registry.json`,
    collectionsRootUrl: rootUrl,
    registry: fixtureRegistry,
    fetchJson: vi.fn(async (url) => {
      if (!(url in values)) throw new Error(`Unexpected local request: ${url}`);
      return values[url];
    }),
    remote,
    sourceOverrides: {
      "fixture-rules": { cabinetTable, countertopTable },
    },
  };
  const signal = new AbortController().signal;
  const registry = await loadCollectionRegistry(dependencies, signal);
  const resolution = resolveCollection({ registry, urlCollectionId: "fixture-rules" });
  if (!resolution.ok) throw new Error("fixture-rules did not resolve");

  return { data: await loadResolvedCollection(resolution, dependencies, signal), remote };
};

describe("fixture-rules collection", () => {
  it("loads a complete rule profile without production remote requests or USH fallback data", async () => {
    const { data, remote } = await loadFixtureRules();

    expect(data.id).toBe("fixture-rules");
    expect(data.manifest.remote).toBeUndefined();
    expect(data.manifest.defaults).not.toHaveProperty("CountertopColor");
    expect(data.catalog.navigation?.prebuilt[0]?.label).toBe("Finish");
    expect(data.catalog.customization?.steps.finish?.sectionIds).toEqual(["handle", "drawers", "height"]);
    expect(selectOptionValues(data.catalog.productProfile ?? null, "Drawers")).toEqual(["2"]);
    expect(selectOptionValues(data.catalog.productProfile ?? null, "Handle")).toEqual(["handle_urban_topcut"]);
    expect(data.catalog.cabinets?.typeCabinetRules).toEqual([
      expect.objectContaining({
        code: "Fixture-Cabinet",
        widths: [60],
        depths: [50.5],
        heights: [56],
        drawers: ["2"],
      }),
    ]);
    expect(data.catalog.cabinets?.typeCabinetRules.some(({ code }) => code === "Sink-Base")).toBe(false);
    expect(data.diagnostics).toEqual([]);
    expect(remote.loadConfigurator).not.toHaveBeenCalled();
    expect(remote.loadCountertopTable).not.toHaveBeenCalled();
    expect(remote.loadCabinetTable).not.toHaveBeenCalled();
  });

  it("blocks drawer 1 in the real rule function and translates only the declared drawer 2 runtime value", async () => {
    const { data } = await loadFixtureRules();
    const profile = data.catalog.productProfile;
    const catalog = data.catalog.cabinets;
    const bindings = data.catalog.runtimeBindings;
    if (!profile || !catalog || !bindings) throw new Error("fixture-rules contract is incomplete");

    const blocked = applyConfiguratorRules(
      {
        cabinetType: "Fixture-Cabinet",
        width: 60,
        depth: 50.5,
        height: 56,
        drawers: "1",
        handle: "handle_urban_topcut",
      },
      undefined,
      { selectedProductIds: [] },
      catalog,
      profile,
    );
    const allowed = applyConfiguratorRules(
      {
        cabinetType: "Fixture-Cabinet",
        width: 60,
        depth: 50.5,
        height: 56,
        drawers: "2",
        handle: "handle_urban_topcut",
      },
      undefined,
      { selectedProductIds: [] },
      catalog,
      profile,
    );

    expect(blocked.violations).toContainEqual({
      field: "drawers",
      reason: "Not available for selected cabinet type",
      reasonCode: "cabinet.notAvailableForType",
    });
    expect(allowed.violations.some(({ field }) => field === "drawers")).toBe(false);
    expect(allowed.availableOptions.drawers).toEqual([expect.objectContaining({ value: "2", enabled: true })]);
    expect(resolveRuntimeBinding(bindings, "Drawers", "2")).toMatchObject({
      ok: true,
      patch: { Drawers: "2D" },
    });
    expect(resolveRuntimeBinding(bindings, "Drawers", "1")).toMatchObject({
      ok: false,
      reason: "unknown-value",
    });
  });

  it("keeps the synthetic fixture out of the production registry", () => {
    expect(productionRegistry.collections.map(({ id }) => id)).not.toContain("fixture-rules");
  });
});
