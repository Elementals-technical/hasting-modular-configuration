import { describe, expect, it } from "vitest";

import { collectionSkuProfileSchema } from "@/entities/collection/model/schemas";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { URBAN_DUPLEX, URBAN_FREESTANDING } from "@/shared/lib/pricing/__tests__/fixtures/collectionPricingScenarios";
import { ulhCoverConfigurator } from "@/shared/lib/pricing/__tests__/fixtures/ulhCoverConfigurator";
import { resolveCabinetCoverColorAttributeId } from "@/shared/lib/sku";
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
  it("offers the decorative-panel materials, HPL included, not Upper's palette", () => {
    expect(buildCoverColorOptions(options, skuProfile).map(({ value }) => value)).toEqual([
      "3D",
      "LACM",
      "LACG",
      "ST",
      "BM",
      "ESS",
      "HPL",
    ]);
  });

  it("reads the active Cabinet Color catalog with its material SKU metadata", () => {
    const result = buildCoverColorOptions(
      resolveConfiguratorOptions(profile, "CabinetColor", ulhCoverConfigurator),
      skuProfile,
    );
    expect(result.some(({ value }) => value === "Castagno chiaro 1C1")).toBe(true);
    // The HPL colour Urban Low Height cabinets start in, which the Lower takes by default.
    expect(result.some(({ value }) => value === "Rox Black TKQ")).toBe(true);
    expect(
      result.every(({ traits }) => traits?.sku && skuProfile.cabinetCover?.materialSkus.includes(traits.sku)),
    ).toBe(true);
  });

  it("reads the Countertop Color catalog Urban Duplex names for its covers, in the countertop's materials", () => {
    const cover = URBAN_DUPLEX.skuProfile.cabinetCover;
    if (!cover) throw new Error("Urban Duplex has no cover contract");
    const attributeId = resolveCabinetCoverColorAttributeId(cover);
    const countertopColors = resolveConfiguratorOptions(URBAN_DUPLEX.profile, attributeId, URBAN_DUPLEX.configurator);
    const result = buildCoverColorOptions(countertopColors, URBAN_DUPLEX.skuProfile);

    expect(attributeId).toBe("CountertopColor");
    // The Upper's colours of every material an SKU names: Fenix, HPL, Porcelain and Solid Surface.
    expect([...new Set(result.map(({ traits }) => traits?.sku))].sort()).toEqual(["FX", "HPL", "POR", "SSTL"]);
    expect(result.map(({ value }) => value)).toEqual(
      countertopColors.filter(({ traits }) => traits?.sku).map(({ value }) => value),
    );
    // A cabinet colour is not one of them.
    expect(result.some(({ value }) => value === "Bianco Calce DA ST")).toBe(false);
  });

  it("offers Urban Freestanding the whole palette of its own cabinets, and no countertop-only material", () => {
    const cover = URBAN_FREESTANDING.skuProfile.cabinetCover;
    if (!cover) throw new Error("Urban Freestanding has no cover contract");
    const attributeId = resolveCabinetCoverColorAttributeId(cover);
    const cabinetColors = resolveConfiguratorOptions(
      URBAN_FREESTANDING.profile,
      attributeId,
      URBAN_FREESTANDING.configurator,
    );
    const result = buildCoverColorOptions(cabinetColors, URBAN_FREESTANDING.skuProfile);

    expect(attributeId).toBe("CabinetColor");
    // Every colour the Urban Freestanding cabinets come in, each of its eight materials.
    expect(result.map(({ value }) => value)).toEqual(cabinetColors.map(({ value }) => value));
    expect(new Set(result.map(({ traits }) => traits?.sku))).toEqual(
      new Set(["LACG", "LACM", "ST", "HPL", "3D", "BM", "WDV", "ESS"]),
    );
    // Porcelain and Fenix are Upper's materials, not the cabinets'.
    expect(buildCoverColorOptions(options, URBAN_FREESTANDING.skuProfile).map(({ value }) => value)).not.toContain(
      "POR",
    );
  });

  it("keeps Cabinet Color for a collection that names no attribute", () => {
    expect(skuProfile.cabinetCover && resolveCabinetCoverColorAttributeId(skuProfile.cabinetCover)).toBe("CabinetColor");
  });

  it("does not invent a palette when the collection has no cover contract", () => {
    expect(buildCoverColorOptions(options, null)).toEqual([]);
    expect(buildCoverColorOptions(options, { ...skuProfile, cabinetCover: undefined })).toEqual([]);
  });
});
