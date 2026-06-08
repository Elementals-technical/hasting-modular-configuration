import { describe, expect, it } from "vitest";

import { productMockData } from "@/entities/product/ui/ProductModelsGrid/ProductModelsGrid";

import { urbanStandardCollection } from "./collectionCatalog";

describe("urbanStandardCollection", () => {
  const { presets } = urbanStandardCollection;

  it("has all unique legacyIds", () => {
    const ids = presets.map((p) => p.legacyId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("preserves the full set of legacy productMockData ids (round-trip guard)", () => {
    const legacyIds = new Set(presets.map((p) => p.legacyId));
    const sourceIds = new Set(productMockData.map((m) => m.id));
    expect(legacyIds).toEqual(sourceIds);
  });

  it("has all unique slugs within the collection", () => {
    const slugs = presets.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every preset a non-empty slug and a model", () => {
    for (const preset of presets) {
      expect(preset.slug.length).toBeGreaterThan(0);
      expect(preset.model).toBeTruthy();
      expect(preset.model.id).toBe(preset.legacyId);
    }
  });
});
