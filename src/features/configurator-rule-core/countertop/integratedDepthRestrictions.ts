import { selectRuleData, type ProductProfile } from "@/entities/collection";

import { normalizeBasinKey, normalizeMaterialToken } from "./parse";

/**
 * Integrated-countertop depths the collection restricts for some materials and basins when the
 * countertop table lists no depths (`ruleData.countertopFallbacks`). Without that section nothing
 * is restricted.
 */
const isRestrictedIntegratedDepth = (depth: number | null, profile: ProductProfile | null): depth is number => {
  if (depth === null || !Number.isFinite(depth)) return false;

  const restrictedDepths = selectRuleData(profile, "countertopFallbacks")?.restrictedIntegratedDepthsCm ?? [];
  return restrictedDepths.some((restrictedDepth) => Math.abs(restrictedDepth - depth) < 0.01);
};

export const isIntegratedCountertopDepthRestrictedByMaterial = ({
  activeMaterialTokens,
  depth,
  profile,
}: {
  activeMaterialTokens: string[];
  depth: number | null;
  profile: ProductProfile | null;
}): boolean => {
  if (!isRestrictedIntegratedDepth(depth, profile)) return false;

  const restrictedMaterials = selectRuleData(profile, "countertopFallbacks")?.restrictedIntegratedMaterialTokens ?? [];
  return activeMaterialTokens.some((token) => restrictedMaterials.includes(normalizeMaterialToken(token)));
};

export const isIntegratedCountertopDepthRestrictedByBasin = ({
  activeBasinStyle,
  depth,
  profile,
}: {
  activeBasinStyle?: string | null;
  depth: number | null;
  profile: ProductProfile | null;
}): boolean => {
  if (!isRestrictedIntegratedDepth(depth, profile)) return false;
  if (!activeBasinStyle) return false;

  const restrictedBasins = selectRuleData(profile, "countertopFallbacks")?.restrictedIntegratedBasinKeys ?? [];
  return restrictedBasins.includes(normalizeBasinKey(activeBasinStyle));
};
