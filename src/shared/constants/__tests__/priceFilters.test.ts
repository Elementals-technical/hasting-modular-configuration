import { describe, expect, it } from "vitest";

import { buildTierFilterOptions, filterOptionsByTier } from "../priceFilters";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

const TIER_LABELS: Record<number, string> = {
  1: "Standard $",
  2: "Classic $$",
  3: "Specialty $$$",
  4: "Exclusive $$$$",
};

const buildOption = (material: string): ProductOptionData => ({
  id: `${material}-countertop-test`,
  title: `${material} sample`,
  desc: material,
  isShortDesc: false,
  metadata: {
    materials: [material],
    value: `${material} sample`,
  },
});

const MATERIAL_TIER_CASES: Array<{ material: string; tier: number }> = [
  { material: "3D", tier: 1 },
  { material: "Ocritech", tier: 1 },
  { material: "Syntesi", tier: 1 },
  { material: "Lacq MT", tier: 2 },
  { material: "Lacquered MT", tier: 2 },
  { material: "Glass MT", tier: 2 },
  { material: "Glass GL", tier: 2 },
  { material: "Glass", tier: 2 },
  { material: "Mineralmarmo", tier: 2 },
  { material: "Minermalmaro", tier: 2 },
  { material: "Lacq GL", tier: 3 },
  { material: "Lacquered GL", tier: 3 },
  { material: "Soft Touch", tier: 3 },
  { material: "Brushed Metal", tier: 3 },
  { material: "Tekorlux", tier: 3 },
  { material: "Tekormud", tier: 3 },
  { material: "Tekorund", tier: 3 },
  { material: "HPL", tier: 4 },
  { material: "Essenze", tier: 4 },
  { material: "Fenix", tier: 4 },
  { material: "Porcelain", tier: 4 },
];

describe("countertop material price filters", () => {
  it.each(MATERIAL_TIER_CASES)("classifies $material as tier $tier", ({ material, tier }) => {
    const options = [buildOption(material)];
    const tierValue = `tier-${tier}`;

    expect(buildTierFilterOptions(options)).toEqual([
      expect.objectContaining({
        label: TIER_LABELS[tier],
        value: tierValue,
      }),
    ]);
    expect(filterOptionsByTier(options, tierValue)).toEqual(options);

    const otherTierValue = tier === 1 ? "tier-3" : "tier-1";
    expect(filterOptionsByTier(options, otherTierValue)).toEqual([]);
  });
});

const buildCabinetColor = (title: string, sku: string, material: string, colors: string[] = []): ProductOptionData => ({
  id: title,
  title,
  desc: material,
  isShortDesc: false,
  metadata: { sku, materials: [material], colors, value: title },
});

describe("cabinet colour price tiers", () => {
  const latte = buildCabinetColor("Latte 417 MT", "LACM", "Lacquered MT", ["White"]);
  const salvia = buildCabinetColor("Salvia 415 MT", "LACM", "Lacquered MT", ["Green"]);
  const rovere = buildCabinetColor("Rovere Oro 932", "WDV", "Wood Veneer");
  const options = [latte, salvia, rovere];

  it("ranks by the shared table without a collection's own tiers: white lacquer first, wood veneer in no tier", () => {
    expect(buildTierFilterOptions(options).map(({ value }) => value)).toEqual(["tier-1", "tier-2"]);
    expect(filterOptionsByTier(options, "tier-1")).toEqual([latte]);
    expect(filterOptionsByTier(options, "tier-2")).toEqual([salvia]);
  });

  it("ranks by the collection's own tiers before the shared table and its white lacquer rule", () => {
    const override = { bySku: { LACM: 1, WDV: 2 } };

    expect(buildTierFilterOptions(options, override)).toEqual([
      expect.objectContaining({ label: "Standard $", value: "tier-1" }),
      expect.objectContaining({ label: "Classic $$", value: "tier-2" }),
    ]);
    expect(filterOptionsByTier(options, "tier-1", override)).toEqual([latte, salvia]);
    expect(filterOptionsByTier(options, "tier-2", override)).toEqual([rovere]);
  });

  it("leaves a SKU the collection does not rank to the shared table", () => {
    const override = { bySku: { WDV: 3 } };

    expect(filterOptionsByTier(options, "tier-1", override)).toEqual([latte]);
    expect(filterOptionsByTier(options, "tier-2", override)).toEqual([salvia]);
    expect(filterOptionsByTier(options, "tier-3", override)).toEqual([rovere]);
  });
});
