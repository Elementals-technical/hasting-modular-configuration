import { extractColorCode } from "./extractColorCode";
import { resolveCountertopMaterialSkuFromBasinType, resolveCountertopMaterialSkuFromColorCode } from "./countertopSkuMaps";
import { resolveDefaultBasinByCountertopColor } from "./resolveDefaultBasinByCountertopColor";

type ConfiguratorVariantMetadataLike = {
  sku?: string;
  value?: string;
  codeColor?: string;
  codecolor?: string;
  Material?: string;
  metadata?: Record<string, unknown>;
};

type ConfiguratorVariantLike = {
  name: string;
  enabled: boolean;
  metadata: ConfiguratorVariantMetadataLike;
};

type ConfiguratorOptionLike = {
  name: string;
  variants: ConfiguratorVariantLike[];
};

type ConfiguratorAvailableOptionLike = {
  proxyName: string;
  options: ConfiguratorOptionLike[];
};

export type CountertopColorSkuCandidate = {
  sku: string;
  colorCode?: string;
  materialTokens: string[];
};

export type CountertopColorSkuCandidatesByValue = Map<string, CountertopColorSkuCandidate[]>;

const normalizeToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const COUNTERTOP_MATERIAL_TOKENS_BY_SKU: Record<string, string[]> = {
  FX: ["fx", "fenix", "hplfenix"],
  GLSG: ["glass", "glassgl"],
  GLSM: ["glass", "glassmt"],
  HPL: ["hpl"],
  POR: ["por", "porcelain"],
  SSOCR: ["ocritech", "ssocr", "solidsurface", "sst1c", "sst1d"],
  SSMMO: ["mineralmarmo", "minermalmaro", "ssmmo"],
  SSSYN: ["syntesi"],
  SSTM: ["sstm", "tekormud", "tekorund"],
  SSTKR: ["sstkr", "tal", "tam", "tekorlux"],
  SYNTESI: ["syntesi"],
};

const MATERIAL_ALIAS_GROUPS = [
  ["fx", "fenix", "hplfenix"],
  ["glass", "glassgl", "glassmt"],
  ["hpl"],
  ["mineralmarmo", "minermalmaro", "ssmmo"],
  ["ocritech", "solidsurface", "ssocr", "sst1c", "sst1d"],
  ["por", "porcelain"],
  ["sstkr", "tal", "tam", "tekorlux"],
  ["syntesi"],
  ["sstm", "tekormud", "tekorund"],
];

const MATERIAL_ALIASES = MATERIAL_ALIAS_GROUPS.reduce<Record<string, string[]>>((acc, group) => {
  group.forEach((token) => {
    acc[token] = group.filter((candidate) => candidate !== token);
  });

  return acc;
}, {});

const getString = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);

const getNestedMetadataRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const getCountertopMaterialAliases = (material: string): string[] => {
  const normalized = normalizeToken(material);
  const aliases = MATERIAL_ALIASES[normalized] ?? [];
  return [normalized, ...aliases];
};

const addMaterialToken = (set: Set<string>, rawValue: string | null) => {
  if (!rawValue) return;

  const normalized = normalizeToken(rawValue);
  if (!normalized) return;

  getCountertopMaterialAliases(normalized).forEach((token) => set.add(token));
};

const getFinishTokenFromValue = (value: string): "mt" | "gl" | null => {
  const match = value.trim().match(/\b(MT|GL)\b$/i);
  if (!match) return null;
  return match[1].toLowerCase() === "mt" ? "mt" : "gl";
};

const filterCandidatesByFinish = (
  candidates: CountertopColorSkuCandidate[],
  value: string,
): CountertopColorSkuCandidate[] => {
  const finish = getFinishTokenFromValue(value);
  if (!finish) return candidates;

  const matched = candidates.filter((candidate) => {
    if (finish === "mt") return candidate.materialTokens.includes("glassmt") || candidate.sku.toUpperCase() === "GLSM";
    return candidate.materialTokens.includes("glassgl") || candidate.sku.toUpperCase() === "GLSG";
  });

  return matched.length > 0 ? matched : candidates;
};

export const getCountertopMaterialTokensBySku = (sku?: string | null): string[] => {
  if (!sku) return [];
  return COUNTERTOP_MATERIAL_TOKENS_BY_SKU[sku.trim().toUpperCase()] ?? [];
};

export const getCountertopMaterialTokensFromBasinType = (basinType?: string | null): string[] => {
  const basin = basinType?.trim() ?? "";
  if (!basin) return [];

  const materialSku = resolveCountertopMaterialSkuFromBasinType(basin);
  const skuMaterialTokens = getCountertopMaterialTokensBySku(materialSku);
  if (skuMaterialTokens.length > 0) return skuMaterialTokens;

  if (basin.startsWith("Top_Glass_")) return ["glass"];
  if (basin.startsWith("Top_Tekorlux_")) return ["tekorlux", "sstkr"];
  if (basin.startsWith("Top_Tekormud_") || basin.startsWith("Top_Tekorund_")) return ["tekormud", "tekorund", "sstm"];
  if (basin.startsWith("Top_Ocritech_")) return ["ocritech", "ssocr", "solidsurface"];
  if (basin.startsWith("Top_Mineralmarmo_")) return ["mineralmarmo", "minermalmaro", "ssmmo"];
  if (basin.startsWith("Top_Porcelain_")) return ["porcelain", "por"];
  if (basin.startsWith("Top_HPL/Fenix_") || basin === "Fenix_Strip_Gres") return ["fenix", "fx", "hplfenix"];
  if (basin.startsWith("Top_HPL")) return ["hpl"];

  return [];
};

const getMaterialTokensForOptionCandidate = ({
  optionName,
  rawMaterial,
  sku = null,
}: {
  optionName: string;
  rawMaterial: string | null;
  sku?: string | null;
}): string[] => {
  const tokens = new Set<string>();

  addMaterialToken(tokens, optionName);
  addMaterialToken(tokens, rawMaterial);
  getCountertopMaterialTokensBySku(sku).forEach((token) => addMaterialToken(tokens, token));

  return Array.from(tokens);
};

const resolveCountertopMaterialSkuFromTokens = (tokens: readonly string[]): string | null => {
  const normalizedTokens = new Set<string>();
  tokens.forEach((token) => addMaterialToken(normalizedTokens, token));

  const matchedSkus = Object.entries(COUNTERTOP_MATERIAL_TOKENS_BY_SKU)
    .filter(([, skuTokens]) => skuTokens.some((token) => normalizedTokens.has(token)))
    .map(([sku]) => sku);

  return matchedSkus.length === 1 ? matchedSkus[0] : null;
};

export const buildCountertopColorSkuCandidates = (
  availableOptions?: ConfiguratorAvailableOptionLike[],
): CountertopColorSkuCandidatesByValue => {
  const result: CountertopColorSkuCandidatesByValue = new Map();
  if (!availableOptions?.length) return result;

  availableOptions
    .filter((group) => group.proxyName === "Countertop Color")
    .forEach((group) => {
      group.options.forEach((option) => {
        option.variants.forEach((variant) => {
          if (!variant.enabled) return;

          const variantMetadata = variant.metadata ?? {};
          const nestedMetadata = getNestedMetadataRecord(variantMetadata.metadata);
          const value = getString(variantMetadata.value) ?? getString(nestedMetadata?.value) ?? variant.name;
          const explicitSku = getString(variantMetadata.sku);
          const rawMaterial = getString(variantMetadata.Material) ?? getString(nestedMetadata?.Material);
          const colorCode =
            getString(variantMetadata.codeColor) ??
            getString(variantMetadata.codecolor) ??
            getString(nestedMetadata?.codeColor) ??
            getString(nestedMetadata?.codecolor) ??
            null;

          if (!value) return;

          const materialTokens = getMaterialTokensForOptionCandidate({
            optionName: option.name,
            rawMaterial,
            sku: explicitSku,
          });
          const sku =
            explicitSku ??
            resolveCountertopMaterialSkuFromColorCode(colorCode) ??
            resolveCountertopMaterialSkuFromTokens(materialTokens);
          if (!sku) return;
          const normalizedColorCode = colorCode ? extractColorCode(colorCode) : null;

          const candidate: CountertopColorSkuCandidate = {
            sku,
            colorCode: normalizedColorCode ?? undefined,
            materialTokens,
          };

          const existing = result.get(value) ?? [];
          existing.push(candidate);
          result.set(value, existing);
        });
      });
    });

  return result;
};

const resolveEffectivePreferredMaterialTokens = (
  value: string,
  preferredMaterialTokens: readonly string[],
): readonly string[] => {
  if (preferredMaterialTokens.length > 0) return preferredMaterialTokens;
  return getCountertopMaterialTokensFromBasinType(resolveDefaultBasinByCountertopColor(value));
};

const selectCountertopColorCandidates = ({
  value,
  candidates,
  preferredMaterialTokens = [],
}: {
  value: string;
  candidates: CountertopColorSkuCandidate[];
  preferredMaterialTokens?: string[];
}): CountertopColorSkuCandidate[] => {
  if (!candidates.length) return [];
  if (candidates.length === 1) return candidates;

  const preferredTokens = new Set<string>();
  resolveEffectivePreferredMaterialTokens(value, preferredMaterialTokens).forEach((token) =>
    addMaterialToken(preferredTokens, token),
  );

  const preferredMatches =
    preferredTokens.size > 0
      ? candidates.filter((candidate) => candidate.materialTokens.some((token) => preferredTokens.has(token)))
      : candidates;

  return filterCandidatesByFinish(preferredMatches, value);
};

export const resolveCountertopColorSkuFromCandidates = ({
  value,
  candidatesByValue,
  preferredMaterialTokens = [],
}: {
  value?: string | null;
  candidatesByValue: CountertopColorSkuCandidatesByValue;
  preferredMaterialTokens?: string[];
}): string | null => {
  if (!value) return null;

  const colorMaterialSku = resolveCountertopMaterialSkuFromColorCode(extractColorCode(value));
  if (colorMaterialSku) return colorMaterialSku;

  const candidates = candidatesByValue.get(value) ?? [];
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0].sku;

  const narrowedCandidates = selectCountertopColorCandidates({
    value,
    candidates,
    preferredMaterialTokens,
  });
  const uniqueSkus = Array.from(new Set(narrowedCandidates.map((candidate) => candidate.sku)));

  if (uniqueSkus.length === 1) return uniqueSkus[0];

  const finishFilteredAll = filterCandidatesByFinish(candidates, value);
  const uniqueFinishFilteredSkus = Array.from(new Set(finishFilteredAll.map((candidate) => candidate.sku)));

  return uniqueFinishFilteredSkus.length === 1 ? uniqueFinishFilteredSkus[0] : null;
};

export const resolveCountertopColorCodeFromCandidates = ({
  value,
  candidatesByValue,
  preferredMaterialTokens = [],
}: {
  value?: string | null;
  candidatesByValue: CountertopColorSkuCandidatesByValue;
  preferredMaterialTokens?: string[];
}): string | null => {
  if (!value) return null;

  const extractedColorCode = extractColorCode(value);
  const candidates = candidatesByValue.get(value) ?? [];
  if (!candidates.length) return extractedColorCode;

  const narrowedCandidates = selectCountertopColorCandidates({
    value,
    candidates,
    preferredMaterialTokens,
  });
  const colorCodes = Array.from(
    new Set(narrowedCandidates.map((candidate) => candidate.colorCode).filter((code): code is string => Boolean(code))),
  );

  if (colorCodes.length === 1) return colorCodes[0];

  const allColorCodes = Array.from(
    new Set(candidates.map((candidate) => candidate.colorCode).filter((code): code is string => Boolean(code))),
  );

  return allColorCodes.length === 1 ? allColorCodes[0] : extractedColorCode;
};

export const resolveCountertopMaterialTokensFromCandidates = ({
  value,
  candidatesByValue,
  preferredSku = null,
  preferredMaterialTokens = [],
}: {
  value?: string | null;
  candidatesByValue: CountertopColorSkuCandidatesByValue;
  preferredSku?: string | null;
  preferredMaterialTokens?: string[];
}): string[] => {
  if (!value) return [];

  const candidates = candidatesByValue.get(value) ?? [];
  if (!candidates.length) return preferredSku ? getCountertopMaterialTokensBySku(preferredSku) : [];

  const normalizedPreferredSku = preferredSku?.trim().toUpperCase() ?? null;
  if (normalizedPreferredSku) {
    const exactSkuMatch = candidates.find((candidate) => candidate.sku.trim().toUpperCase() === normalizedPreferredSku);
    if (exactSkuMatch) return exactSkuMatch.materialTokens;
  }

  const preferredTokens = new Set<string>();
  resolveEffectivePreferredMaterialTokens(value, preferredMaterialTokens).forEach((token) =>
    addMaterialToken(preferredTokens, token),
  );

  const preferredMatches =
    preferredTokens.size > 0
      ? candidates.filter((candidate) => candidate.materialTokens.some((token) => preferredTokens.has(token)))
      : candidates;
  const narrowedCandidates = filterCandidatesByFinish(preferredMatches, value);

  if (narrowedCandidates.length === 1) return narrowedCandidates[0].materialTokens;

  const finishFilteredAll = filterCandidatesByFinish(candidates, value);
  return finishFilteredAll[0]?.materialTokens ?? candidates[0]?.materialTokens ?? [];
};
