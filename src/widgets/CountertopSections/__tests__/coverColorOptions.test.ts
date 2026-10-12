import { describe, expect, it } from "vitest";

import { collectionSkuProfileSchema } from "@/entities/collection/model/schemas";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { URBAN_LOW_HEIGHT } from "@/shared/lib/pricing/__tests__/fixtures/collectionPricingScenarios";
import { resolveConfiguratorOptions } from "@/features/collectionCustomization/lib/resolveSectionState";

import profileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import skuDocument from "../../../../public/collections/urban-low-height/sku-profile.json";
import { buildCoverColorOptions } from "../lib/coverColorOptions";

const parsed = parseProductProfile(profileDocument);
if (!parsed.ok) throw new Error("Invalid ULH profile");
const profile = parsed.profile;
const skuProfile = collectionSkuProfileSchema.parse(skuDocument);
const options = ["3D", "LACM", "LACG", "ST", "BM", "ESS", "HPL", "FX", "POR"].map((material) => ({
  value: material,
  enabled: true,
  traits: { sku: material },
}));

describe("Lower countertop colors", () => {
  it("offers only the six confirmed decorative-panel materials, not Upper's palette", () => {
    expect(buildCoverColorOptions(options, skuProfile).map(({ value }) => value)).toEqual([
      "3D",
      "LACM",
      "LACG",
      "ST",
      "BM",
      "ESS",
    ]);
  });

  it("reads the active Cabinet Color catalog with its material SKU metadata", () => {
    const result = buildCoverColorOptions(
      resolveConfiguratorOptions(profile, "CabinetColor", URBAN_LOW_HEIGHT.configurator),
      skuProfile,
    );
    expect(result.some(({ value }) => value === "Castagno chiaro 1C1")).toBe(true);
    expect(result.some(({ value }) => value === "Pulpis Chiaro TKH")).toBe(false);
    expect(
      result.every(({ traits }) => traits?.sku && skuProfile.cabinetCover?.materialSkus.includes(traits.sku)),
    ).toBe(true);
  });

  it("does not invent a palette when the collection has no cover contract", () => {
    expect(buildCoverColorOptions(options, null)).toEqual([]);
    expect(buildCoverColorOptions(options, { ...skuProfile, cabinetCover: undefined })).toEqual([]);
  });
});
