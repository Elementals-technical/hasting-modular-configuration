import { describe, expect, it } from "vitest";

import productionRegistry from "../../../../public/collections/registry.json";
import productionManifest from "../../../../public/collections/urban-standard-height/manifest.json";

import { withCollectionId } from "../lib/collectionUrl";
import { resolveCollectionImageUrl, resolveCollectionJsonUrl } from "../lib/paths";
import { resolveCollection } from "../lib/resolveCollection";
import { validateCollectionManifest, validateCollectionRegistry } from "../lib/validation";

const registryUrl = "https://app.test/collections/registry.json";
const rootUrl = "https://app.test/collections/";

describe("collection contracts", () => {
  it("validates the single production collection and its matching manifest", () => {
    const registry = validateCollectionRegistry(productionRegistry, registryUrl, rootUrl);
    expect(registry.defaultCollectionId).toBe("urban-standard-height");
    expect(registry.collections).toEqual([
      { id: "urban-standard-height", manifest: "urban-standard-height/manifest.json" },
    ]);

    const manifest = validateCollectionManifest(
      productionManifest,
      "urban-standard-height",
      "https://app.test/collections/urban-standard-height/manifest.json",
      rootUrl,
    );
    expect(manifest.defaultPresetId).toBe(1);
    expect(manifest.remote).toMatchObject({
      configurator: { id: 4 },
      countertopTable: { id: 438 },
      cabinetTable: { id: 439 },
    });
  });

  it("rejects unknown fields, duplicate IDs, mismatched identities, and escaping paths", () => {
    expect(() =>
      validateCollectionRegistry({ ...productionRegistry, typo: true }, registryUrl, rootUrl),
    ).toThrow("failed validation");
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
      collections: [
        ...productionRegistry.collections,
        { id: "fixture-ui", manifest: "fixture-ui/manifest.json" },
      ],
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
    expect(resolveCollection({ registry, urlCollectionId: null, savedCollection: { collectionId: null } })).toMatchObject({
      ok: false,
      error: { code: "invalid-collection-id" },
    });
    expect(resolveCollection({ registry, urlCollectionId: null, savedCollection: { collectionId: "" } })).toMatchObject({
      ok: false,
      error: { code: "invalid-collection-id" },
    });
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
