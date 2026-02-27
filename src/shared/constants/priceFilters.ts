import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import skuTiersData from "./skuTiers.json";

export const SKU_TIERS: Record<string, number> = skuTiersData;

type FilterOption = { label: string; value: string; description?: string };

export const TIER_DEFINITIONS = [
  {
    label: "Tier 1 – Standard",
    value: "tier-1",
    tier: 1,
    description: "Quality fabrics offered at a great value.",
  },
  {
    label: "Tier 2 – Best Sellers",
    value: "tier-2",
    tier: 2,
    description: "Customer and designer favorites that are built to last.",
  },
  {
    label: "Tier 3 – Specialty",
    value: "tier-3",
    tier: 3,
    description: "Design-forward fabrics with novelty textures and patterns.",
  },
  {
    label: "Tier 4 – Premium",
    value: "tier-4",
    tier: 4,
    description: "High-end, natural fabrics that offer durability and a luxe hand feel.",
  },
] as const;

export const getTierForSku = (sku?: string): number | undefined => {
  if (!sku) return undefined;
  return SKU_TIERS[sku.toUpperCase()] ?? SKU_TIERS[sku] ?? undefined;
};

export const buildTierFilterOptions = (options: ProductOptionData[]): FilterOption[] => {
  const usedTiers = new Set<number>();

  for (const option of options) {
    const tier = getTierForSku(option.metadata?.sku);
    if (tier !== undefined) usedTiers.add(tier);
  }

  return TIER_DEFINITIONS.filter((t) => usedTiers.has(t.tier)).map((t) => ({
    label: t.label,
    value: t.value,
    description: t.description,
  }));
};

export const filterOptionsByTier = (options: ProductOptionData[], tierValue?: string): ProductOptionData[] => {
  if (!tierValue) return options;

  const def = TIER_DEFINITIONS.find((t) => t.value === tierValue);
  if (!def) return options;

  return options.filter((option) => {
    const tier = getTierForSku(option.metadata?.sku);
    if (tier === undefined) return true;
    return tier === def.tier;
  });
};
