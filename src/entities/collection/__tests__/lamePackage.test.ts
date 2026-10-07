import { describe, expect, it, vi } from "vitest";

import productionRegistry from "../../../../public/collections/registry.json";
import lameManifest from "../../../../public/collections/lame/manifest.json";
import lamePresets from "../../../../public/collections/lame/presets.json";
import lameProductProfile from "../../../../public/collections/lame/product-profile.json";
import lameSkuProfile from "../../../../public/collections/lame/sku-profile.json";
import lameUi from "../../../../public/collections/lame/ui.json";

import configurator9 from "./fixtures/remote/configurator-9.json";
import { validateCustomizationSchema } from "../lib/customization/validateCustomizationSchema";
import { loadResolvedCollection } from "../lib/loadCollection";
import { parseProductProfile } from "../lib/parseProductProfile";
import { selectAttribute } from "../lib/productProfileSelectors";
import { resolveCollection } from "../lib/resolveCollection";
import { collectCustomizationAttributeIds } from "../lib/runtimeBindings/collectionRuntimeContract";
import { validateCollectionManifest, validateCollectionRegistry } from "../lib/validation";
import { CUSTOMIZATION_FLOW_IDS } from "../model/customizationSchema";
import type { CollectionRegistry } from "../model/schemas";
import { isReadyCollectionData, type CollectionRuntimeDependencies } from "../model/types";

/**
 * The Lame package: its own data, configurator 9 and two tables still to be uploaded to Render Admin.
 *
 * The PlayCanvas export has no Lame product yet, so Lame is not in the production registry and has no
 * runtime bindings. This test registers it itself and proves the package loads as the shell needs it.
 */

const registryUrl = "https://app.test/collections/registry.json";
const collectionsRootUrl = "https://app.test/collections/";
const manifestUrl = `${collectionsRootUrl}lame/manifest.json`;

const lameRegistry: CollectionRegistry = {
  defaultCollectionId: "lame",
  collections: [{ id: "lame", manifest: "lame/manifest.json" }],
};

const sources: Record<string, unknown> = {
  [manifestUrl]: lameManifest,
  [`${collectionsRootUrl}lame/presets.json`]: lamePresets,
  [`${collectionsRootUrl}lame/product-profile.json`]: lameProductProfile,
  [`${collectionsRootUrl}lame/sku-profile.json`]: lameSkuProfile,
  [`${collectionsRootUrl}lame/ui.json`]: lameUi,
};

const makeDependencies = () => {
  const remote = {
    loadConfigurator: vi.fn(async () => configurator9),
    loadCountertopTable: vi.fn(async () => {
      throw new Error("Lame declares no countertop table yet");
    }),
    loadCabinetTable: vi.fn(async () => {
      throw new Error("Lame declares no cabinet table yet");
    }),
  };
  const dependencies: CollectionRuntimeDependencies = {
    registryUrl,
    collectionsRootUrl,
    fetchJson: vi.fn(async (url: string) => {
      if (!(url in sources)) throw new Error(`Unexpected local request: ${url}`);
      return sources[url];
    }),
    remote,
  };

  return { dependencies, remote };
};

/** Every file of the collection's image folder, keyed by its path from the collection folder. */
const shippedImages = new Set(
  Object.keys(import.meta.glob("/public/collections/lame/images/**/*", { query: "?url" })).map((path) =>
    path.replace("/public/collections/lame/", ""),
  ),
);

describe("lame collection package", () => {
  it("stays out of the production registry until the scene places Lame cabinets", () => {
    expect(productionRegistry.collections.map(({ id }) => id)).not.toContain("lame");
  });

  it("declares its own data and configurator 9, with no table or runtime bindings yet", () => {
    const manifest = validateCollectionManifest(lameManifest, "lame", manifestUrl, collectionsRootUrl);

    expect(manifest.local).toEqual({
      presets: "presets.json",
      ui: "ui.json",
      productProfile: "product-profile.json",
      skuProfile: "sku-profile.json",
    });
    expect(manifest.remote).toEqual({ configurator: { id: 9, view: "full", serialize: true } });
  });

  it("loads ready for the shell from its own files and configurator 9", async () => {
    const registry = validateCollectionRegistry(lameRegistry, registryUrl, collectionsRootUrl);
    const resolution = resolveCollection({ registry, urlCollectionId: "lame" });
    if (!resolution.ok) throw new Error(resolution.error.message);
    const { dependencies, remote } = makeDependencies();

    const data = await loadResolvedCollection(resolution, dependencies, new AbortController().signal);

    expect(isReadyCollectionData(data)).toBe(true);
    expect(data.diagnostics).toEqual([]);
    expect(remote.loadConfigurator).toHaveBeenCalledWith({ id: 9, view: "full", serialize: true }, expect.anything());
    expect(remote.loadCountertopTable).not.toHaveBeenCalled();
    expect(remote.loadCabinetTable).not.toHaveBeenCalled();
    expect(data.catalog.productProfile?.collectionId).toBe("lame");
    expect(data.catalog.skuProfile?.collectionId).toBe("lame");
    expect(data.catalog.customization?.collectionId).toBe("lame");
    expect(data.catalog.runtimeBindings).toBeUndefined();
    expect(data.catalog.cabinets).toBeUndefined();
    expect(data.catalog.countertops).toBeUndefined();
    expect(data.catalog.presets).toHaveLength(43);
    expect(data.catalog.presets?.[0]?.img).toBe(
      new URL("lame/images/Lame Vanity · 24_ 1-Drawer.png", collectionsRootUrl).href,
    );
  });

  it("describes both flows with fields its profile can fill", () => {
    const validation = validateCustomizationSchema(lameUi);
    const parsed = parseProductProfile(lameProductProfile);
    if (!validation.ok) throw new Error(JSON.stringify(validation.diagnostics));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const { schema } = validation;

    for (const flowId of CUSTOMIZATION_FLOW_IDS) {
      const { steps } = schema.flows[flowId];
      expect(schema.steps[steps[steps.length - 1].stepId]?.kind).toBe("summary");
    }
    for (const attributeId of collectCustomizationAttributeIds(schema)) {
      const attribute = selectAttribute(parsed.profile, attributeId);
      expect(attribute, attributeId).not.toBeNull();
      expect(Boolean(attribute?.options?.length || attribute?.optionsSource), attributeId).toBe(true);
    }
    expect(schema.steps.color?.sectionIds).toEqual(["cabinet-color", "cabinet-pattern", "handle-color"]);
  });

  it("ships every option picture it declares", () => {
    const pictures = Object.values(lameUi.optionImages).flatMap((byValue) => Object.values(byValue));

    expect(pictures.length).toBeGreaterThan(0);
    for (const picture of pictures) expect(shippedImages.has(picture), picture).toBe(true);
  });
});
