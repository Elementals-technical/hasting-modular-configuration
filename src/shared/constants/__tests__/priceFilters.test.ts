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
