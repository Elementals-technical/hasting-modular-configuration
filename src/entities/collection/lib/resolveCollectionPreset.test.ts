import { describe, expect, it } from "vitest";

import type { ProductModel } from "@/entities/product/types";

import type { CollectionConfig } from "../types";
import { getPresetById, resolveCollectionPreset } from "./resolveCollectionPreset";

const makeModel = (id: number): ProductModel => ({
  id,
  img: "",
  title: `model-${id}`,
  isProductModel: true,
  presetProducts: [],
  size: "24_29",
  style: [],
});

// Fixture keyed by the real DEFAULT_COLLECTION_SLUG ("urban-standard") so the
// no-collection resolution paths exercise the default-collection lookup.
const fixture: Record<string, CollectionConfig> = {
  "urban-standard": {
    slug: "urban-standard",
    title: "Urban Standard",
    presets: [
      { legacyId: 1, slug: "urban-standard-24-1-drawer", model: makeModel(1) },
      { legacyId: 2, slug: "urban-standard-24-2-drawer", model: makeModel(2) },
    ],
    defaults: { cabinetColor: "c", countertopColor: "ct", sinkType: "s" },
  },
};

describe("resolveCollectionPreset", () => {
  it("resolves a canonical collection + preset slug pair", () => {
    const result = resolveCollectionPreset(
      { collection: "urban-standard", preset: "urban-standard-24-1-drawer" },
      fixture,
    );
    expect(result?.legacyId).toBe(1);
  });

  it("resolves a legacy numeric preset id against the default collection", () => {
    const result = resolveCollectionPreset({ preset: "1" }, fixture);
    expect(result?.legacyId).toBe(1);
  });

  it("returns null for a non-numeric, non-slug preset", () => {
    expect(resolveCollectionPreset({ preset: "abc" }, fixture)).toBeNull();
  });

  it("resolves a slug without a collection against the default collection", () => {
    const result = resolveCollectionPreset({ preset: "urban-standard-24-2-drawer" }, fixture);
    expect(result?.legacyId).toBe(2);
  });

  it("returns null for an unknown collection", () => {
    expect(resolveCollectionPreset({ collection: "nope", preset: "urban-standard-24-1-drawer" }, fixture)).toBeNull();
  });

  it("returns null for an unknown preset in a valid collection", () => {
    expect(resolveCollectionPreset({ collection: "urban-standard", preset: "nope" }, fixture)).toBeNull();
  });

  it("returns null when preset is missing", () => {
    expect(resolveCollectionPreset({}, fixture)).toBeNull();
    expect(resolveCollectionPreset({ collection: "urban-standard" }, fixture)).toBeNull();
  });
});

describe("getPresetById (real catalog)", () => {
  it("returns the model for a known legacy id", () => {
    const model = getPresetById(1);
    expect(model).not.toBeNull();
    expect(model?.id).toBe(1);
  });

  it("returns null for an unknown legacy id", () => {
    expect(getPresetById(99999)).toBeNull();
  });
});
