import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import skuTiersData from "./skuTiers.json";

export const SKU_TIERS: Record<string, number> = skuTiersData;

type FilterOption = { label: string; value: string; description?: string };

export const TIER_DEFINITIONS = [
  {
    label: "Standard $",
    value: "tier-1",
    tier: 1,
    description: "Quality finishes offered at a great value.",
  },
  {
    label: "Classic $$",
    value: "tier-2",
    tier: 2,
    description: "Client and designer favorites that are timeless.",
  },
  {
    label: "Specialty $$$",
    value: "tier-3",
    tier: 3,
    description: "High-performance surfaces designed to elevate form and function.",
  },
  {
    label: "Exclusive $$$$",
    value: "tier-4",
    tier: 4,
    description: "Top tier materials that deliver unrivaled longevity and an ultra-luxe feel.",
  },
] as const;

export const getTierForSku = (sku?: string): number | undefined => {
  if (!sku) return undefined;
  const normalized = sku.trim().toUpperCase();
  if (!normalized) return undefined;

  const exact = SKU_TIERS[normalized] ?? SKU_TIERS[sku];
  if (exact !== undefined) return exact;

  const byPrefix = Object.entries(SKU_TIERS).find(([knownSku]) => normalized.startsWith(knownSku));
  if (byPrefix) return byPrefix[1];

  return undefined;
};

const normalizeToken = (value?: string) =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const MATERIAL_TIER_MAP: Record<string, number> = {
  "3d": 1,
  lacqmt: 2,
  lacqueredmt: 2,
  lacqgl: 3,
  lacqueredgl: 3,
  softtouch: 3,
  brushedmetal: 3,
  hpl: 4,
  essenze: 4,
  fenix: 4,
  porcelain: 4,
  glassmt: 2,
  glassgl: 2,
  glass: 2,
  mineralmarmo: 2,
  minermalmaro: 2,
  ocritech: 1,
  tekorlux: 3,
  tekormud: 3,
  tekorund: 3,
};

const resolveTierFromMaterialToken = (token: string): number | undefined => {
  const exact = MATERIAL_TIER_MAP[token];
  if (exact !== undefined) return exact;

  for (const [materialToken, tier] of Object.entries(MATERIAL_TIER_MAP)) {
    if (token.includes(materialToken)) return tier;
  }

  return undefined;
};

const includesWhiteToken = (value?: string): boolean => {
  const normalized = normalizeToken(value);
  return normalized.includes("white") || normalized.includes("bianco");
};

const isWhiteLacquerOption = (option: ProductOptionData): boolean => {
  const colors = option.metadata?.colors ?? [];
  const hasWhiteColor = colors.some((color) => includesWhiteToken(color));
  if (hasWhiteColor) return true;

  if (includesWhiteToken(option.title)) return true;
  if (includesWhiteToken(option.name)) return true;
  if (includesWhiteToken(option.desc)) return true;

  const value = option.metadata?.value;
  return includesWhiteToken(value);
};

const WHITE_LACQUER_TIER1_EXCEPTIONS = new Set([
  "biancocalcedagl",
  "biancomalefagl",
  "biancocalcedamt",
  "biancomalefamt",
]);

const isWhiteLacquerTier1Exception = (option: ProductOptionData): boolean => {
  const tokens = [option.title, option.name, option.desc, option.metadata?.value]
    .map((value) => normalizeToken(value))
    .filter(Boolean);

  return tokens.some((token) => WHITE_LACQUER_TIER1_EXCEPTIONS.has(token));
};

const WHITE_LACQUER_TIER1_MATERIAL_EXCLUSIONS = new Set(["glass", "glassmt", "glassgl", "tekorlux"]);

const hasTier1ExcludedMaterial = (option: ProductOptionData): boolean => {
  const materialTokens = [
    ...(option.metadata?.materials ?? []),
    option.desc,
    option.title,
    option.name,
    option.metadata?.value,
  ]
    .map((value) => normalizeToken(value))
    .filter(Boolean);

  return materialTokens.some((token) => {
    for (const excluded of WHITE_LACQUER_TIER1_MATERIAL_EXCLUSIONS) {
      if (token.includes(excluded)) return true;
    }
    return false;
  });
};

const isLacquerOption = (option: ProductOptionData): boolean => {
  const sku = option.metadata?.sku?.trim().toUpperCase();
  if (sku === "LACM" || sku === "LACG") return true;

  const materials = option.metadata?.materials ?? [];
  return materials.some((material) => {
    const token = normalizeToken(material);
    return token.includes("lacq") || token.includes("lacquered");
  });
};

const getTierForOption = (option: ProductOptionData): number | undefined => {
  // Rule from table: Lacq MT/GL White => Tier 1.
  if (
    isLacquerOption(option) &&
    isWhiteLacquerOption(option) &&
    !isWhiteLacquerTier1Exception(option) &&
    !hasTier1ExcludedMaterial(option)
  ) {
    return 1;
  }

  const bySku = getTierForSku(option.metadata?.sku);
  if (bySku !== undefined) return bySku;

  // Fallback when sku is empty: derive tier from material/name/description tokens.
  const materials = option.metadata?.materials ?? [];
  const candidates = [
    ...materials,
    option.desc,
    option.title,
    option.name,
    option.metadata?.value,
  ];

  for (const candidate of candidates) {
    const token = normalizeToken(candidate);
    if (!token) continue;

    const byMaterial = resolveTierFromMaterialToken(token);
    if (byMaterial !== undefined) return byMaterial;
  }

  return undefined;
};

export const buildTierFilterOptions = (options: ProductOptionData[]): FilterOption[] => {
  const usedTiers = new Set<number>();

  for (const option of options) {
    const tier = getTierForOption(option);
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
    const tier = getTierForOption(option);
    if (tier === undefined) return false;
    return tier === def.tier;
  });
};
