import { describe, expect, it } from "vitest";

import productionRegistry from "../../../../public/collections/registry.json";
import productionManifest from "../../../../public/collections/urban-standard-height/manifest.json";
import urbanLowHeightManifest from "../../../../public/collections/urban-low-height/manifest.json";
import urbanLowHeightUi from "../../../../public/collections/urban-low-height/ui.json";
import classManifestDocument from "../../../../public/collections/class/manifest.json";
import classUi from "../../../../public/collections/class/ui.json";
import makoManifestDocument from "../../../../public/collections/mako/manifest.json";
import makoUi from "../../../../public/collections/mako/ui.json";

import { withCollectionId } from "../lib/collectionUrl";
import { resolveCollectionImageUrl, resolveCollectionJsonUrl } from "../lib/paths";
import { resolveCollection } from "../lib/resolveCollection";
import { validateCollectionManifest, validateCollectionRegistry } from "../lib/validation";

const registryUrl = "https://app.test/collections/registry.json";
const rootUrl = "https://app.test/collections/";

describe("collection contracts", () => {
  it("validates the production registry and collection manifests", () => {
    const registry = validateCollectionRegistry(productionRegistry, registryUrl, rootUrl);
    expect(registry.defaultCollectionId).toBe("urban-standard-height");
    expect(registry.collections).toEqual([
      { id: "urban-standard-height", manifest: "urban-standard-height/manifest.json" },
      { id: "urban-low-height", manifest: "urban-low-height/manifest.json" },
      { id: "class", manifest: "class/manifest.json" },
      { id: "mako", manifest: "mako/manifest.json" },
    ]);

    const manifest = validateCollectionManifest(
      productionManifest,
      "urban-standard-height",
      "https://app.test/collections/urban-standard-height/manifest.json",
      rootUrl,
    );
    expect(manifest.defaultPresetId).toBe(1);
    expect(manifest.local?.ui).toBe("ui.json");
    expect(manifest.local?.runtimeBindings).toBe("runtime-bindings.json");
    expect(manifest.remote).toMatchObject({
      configurator: { id: 4 },
      countertopTable: { id: 438 },
      cabinetTable: { id: 439 },
    });

    const urbanLowHeight = validateCollectionManifest(
      urbanLowHeightManifest,
      "urban-low-height",
      "https://app.test/collections/urban-low-height/manifest.json",
      rootUrl,
    );
    expect(urbanLowHeight.defaults).toEqual({});
    expect(urbanLowHeight.local).toEqual({
      presets: "presets.json",
      ui: "ui.json",
      productProfile: "product-profile.json",
    });
    expect(urbanLowHeight.defaultPresetId).toBeUndefined();
    expect(urbanLowHeight.remote).toEqual({
      configurator: { id: 4, view: "full", serialize: true },
      countertopTable: { id: 438 },
      cabinetTable: { id: 439 },
    });
    expect(urbanLowHeightUi.collectionId).toBe("urban-low-height");

    const classManifest = validateCollectionManifest(
      classManifestDocument,
      "class",
      "https://app.test/collections/class/manifest.json",
      rootUrl,
    );
    expect(classManifest.defaults).toEqual({});
    expect(classManifest.local).toEqual({
      presets: "presets.json",
      ui: "ui.json",
      productProfile: "product-profile.json",
      skuProfile: "sku-profile.json",
    });
    expect(classManifest.defaultPresetId).toBeUndefined();
    expect(classManifest.remote).toEqual({
      configurator: { id: 4, view: "full", serialize: true },
      countertopTable: { id: 438 },
      cabinetTable: { id: 439 },
    });
    expect(classUi.collectionId).toBe("class");

    const makoManifest = validateCollectionManifest(
      makoManifestDocument,
      "mako",
      "https://app.test/collections/mako/manifest.json",
      rootUrl,
    );
    expect(makoManifest.defaults).toEqual({});
    expect(makoManifest.local).toEqual({
      presets: "presets.json",
      ui: "ui.json",
      productProfile: "product-profile.json",
      skuProfile: "sku-profile.json",
    });
    expect(makoManifest.defaultPresetId).toBeUndefined();
    expect(makoManifest.remote).toEqual({
      configurator: { id: 4, view: "full", serialize: true },
      countertopTable: { id: 438 },
      cabinetTable: { id: 439 },
    });
    expect(makoUi.collectionId).toBe("mako");
  });

  it("rejects unknown fields, duplicate IDs, mismatched identities, and escaping paths", () => {
    expect(() => validateCollectionRegistry({ ...productionRegistry, typo: true }, registryUrl, rootUrl)).toThrow(
      "failed validation",
    );
    expect(() =>
      validateCollectionRegistry(
        { ...productionRegistry, collections: [...productionRegistry.collections, ...productionRegistry.collections] },
        registryUrl,
        rootUrl,
      ),
    ).toThrow("duplicate");
    expect(() =>
      validateCollectionManifest(
        productionManifest,
        "another-collection",
        "https://app.test/collections/urban-standard-height/manifest.json",
        rootUrl,
      ),
    ).toThrow("does not match");
    expect(() => resolveCollectionJsonUrl("../outside.json", registryUrl, rootUrl)).toThrow("safe relative path");
    expect(() => resolveCollectionJsonUrl("https://evil.test/data.json", registryUrl, rootUrl)).toThrow(
      "safe relative path",
    );
  });

  it("resolves local and HTTPS images while rejecting insecure or escaping image references", () => {
    const manifestUrl = "https://app.test/collections/urban-standard-height/manifest.json";
    expect(resolveCollectionImageUrl("images/model.png", manifestUrl, rootUrl)).toBe(
      "https://app.test/collections/urban-standard-height/images/model.png",
    );
    expect(resolveCollectionImageUrl("https://cdn.test/model.png", manifestUrl, rootUrl)).toBe(
      "https://cdn.test/model.png",
    );
    expect(() => resolveCollectionImageUrl("http://cdn.test/model.png", manifestUrl, rootUrl)).toThrow("HTTPS");
    expect(() => resolveCollectionImageUrl("../../model.png", manifestUrl, rootUrl)).toThrow("safe relative path");
  });
});

describe("collection identity resolution", () => {
  const registry = validateCollectionRegistry(productionRegistry, registryUrl, rootUrl);
  const extendedRegistry = validateCollectionRegistry(
    {
      defaultCollectionId: "urban-standard-height",
      collections: [...productionRegistry.collections, { id: "fixture-ui", manifest: "fixture-ui/manifest.json" }],
    },
    registryUrl,
    rootUrl,
  );

  it("uses URL identity or the registry default for a new launch", () => {
    expect(resolveCollection({ registry, urlCollectionId: null })).toMatchObject({
      ok: true,
      collectionId: "urban-standard-height",
      source: "default",
    });
    expect(resolveCollection({ registry: extendedRegistry, urlCollectionId: "fixture-ui" })).toMatchObject({
      ok: true,
      collectionId: "fixture-ui",
      source: "url",
    });
    expect(resolveCollection({ registry, urlCollectionId: "" })).toMatchObject({
      ok: false,
      error: { code: "invalid-collection-id" },
    });
    expect(resolveCollection({ registry, urlCollectionId: "unknown" })).toMatchObject({
      ok: false,
      error: { code: "unknown-collection" },
    });
  });

  it("gives saved identity precedence and preserves legacy USH restore behavior", () => {
    expect(
      resolveCollection({
        registry: extendedRegistry,
        urlCollectionId: "urban-standard-height",
        savedCollection: { collectionId: "fixture-ui" },
      }),
    ).toMatchObject({ ok: true, collectionId: "fixture-ui", source: "saved" });
    expect(resolveCollection({ registry, urlCollectionId: "unknown", savedCollection: {} })).toMatchObject({
      ok: true,
      collectionId: "urban-standard-height",
      source: "legacy-saved",
    });
    expect(
      resolveCollection({ registry, urlCollectionId: null, savedCollection: { collectionId: null } }),
    ).toMatchObject({
      ok: false,
      error: { code: "invalid-collection-id" },
    });
    expect(resolveCollection({ registry, urlCollectionId: null, savedCollection: { collectionId: "" } })).toMatchObject(
      {
        ok: false,
        error: { code: "invalid-collection-id" },
      },
    );
    expect(
      resolveCollection({ registry, urlCollectionId: null, savedCollection: { collectionId: "unknown" } }),
    ).toMatchObject({ ok: false, error: { code: "unknown-collection" } });
  });
});

describe("collection URL propagation", () => {
  it("changes only collectionId in the target URL", () => {
    expect(withCollectionId("/custom/countertop?help=1&preset=8#top", "fixture-ui")).toBe(
      "/custom/countertop?help=1&preset=8&collectionId=fixture-ui#top",
    );
    expect(withCollectionId("prebuilt/model?collectionId=old&hostUrl=target", "urban-standard-height")).toBe(
      "prebuilt/model?collectionId=urban-standard-height&hostUrl=target",
    );
    expect(withCollectionId("https://host.test/restore?configId=4", "fixture-ui")).toBe(
      "https://host.test/restore?configId=4&collectionId=fixture-ui",
    );
  });
});
