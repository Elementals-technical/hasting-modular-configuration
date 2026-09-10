import { describe, expect, it } from "vitest";

import { resolveRestoredCollection } from "../lib/resolveRestoredCollection";
import type { CollectionRegistry } from "../model/schemas";

const registry: CollectionRegistry = {
  defaultCollectionId: "fixture-ui",
  collections: [
    { id: "urban-standard-height", manifest: "urban-standard-height/manifest.json" },
    { id: "fixture-ui", manifest: "fixture-ui/manifest.json" },
  ],
};

describe("resolveRestoredCollection", () => {
  it("gives a valid saved identity precedence over URL identity", () => {
    expect(
      resolveRestoredCollection({
        registry,
        urlCollectionId: "fixture-ui",
        savedCollection: { collectionId: "urban-standard-height" },
      }),
    ).toMatchObject({ ok: true, collectionId: "urban-standard-height", source: "saved" });
  });

  it("maps an absent legacy field to USH", () => {
    expect(
      resolveRestoredCollection({ registry, urlCollectionId: "fixture-ui", savedCollection: {} }),
    ).toMatchObject({ ok: true, collectionId: "urban-standard-height", source: "legacy-saved" });
  });

  it.each([null, "", "unknown"])("rejects the explicit saved identity %s", (collectionId) => {
    expect(
      resolveRestoredCollection({ registry, urlCollectionId: "fixture-ui", savedCollection: { collectionId } }),
    ).toMatchObject({ ok: false });
  });
});
