import type { ProductProfile } from "@/entities/collection";
import { isVesselBasin, selectRuleData } from "@/entities/collection";

import { getMaterialAliases, normalizeMaterialToken, selectMaterialAliasTable } from "./parse";

/**
 * Which countertop materials and colours a vessel basin accepts, and which vessel styles are
 * hidden. The lists come from `ruleData.vesselCompatibility` of the active collection; without
 * that section every vessel style is shown and no material is restricted. A vessel is a basin of
 * the profile's vessel category (isVesselBasin), whatever the collection names it.
 */

export const REASON_VESSEL_COLOR_UNAVAILABLE = "vessel.colorUnavailable";
/** A vessel refused because the countertop colour is one the style's `unavailableColorCodesByStyle` lists. */
export const REASON_VESSEL_COUNTERTOP_COLOR_UNAVAILABLE = "vessel.countertopColorUnavailable";

type VesselMaterialColorCodeRule = {
  materialTokens: Set<string>;
  colorCodes: Set<string>;
};

type VesselFinishPreference = {
  materialTokens: Set<string>;
  colorCodes: Set<string>;
};

const selectVesselCompatibility = (profile: ProductProfile | null) => selectRuleData(profile, "vesselCompatibility");

export const isVisibleVesselSinkStyle = (value: string | null | undefined, profile: ProductProfile | null): boolean => {
  const normalizedValue = value?.trim();
  const hiddenStyles = selectVesselCompatibility(profile)?.hiddenStyles ?? [];

  return Boolean(normalizedValue && isVesselBasin(profile, normalizedValue) && !hiddenStyles.includes(normalizedValue));
};

const resolveVesselStyleRule = <T,>(ruleMap: Record<string, T> | undefined, vesselStyle: string): T | null => {
  if (!ruleMap) return null;

  const directMatch = ruleMap[vesselStyle];
  if (directMatch !== undefined) return directMatch;

  const inheritedKey = Object.keys(ruleMap)
    .filter((key) => vesselStyle.startsWith(`${key}_`))
    .sort((left, right) => right.length - left.length)[0];

  return inheritedKey ? ruleMap[inheritedKey] : null;
};

export const getAllowedVesselMaterialTokens = (
  vesselStyle: string | null | undefined,
  profile: ProductProfile | null,
): Set<string> | null => {
  if (!isVesselBasin(profile, vesselStyle)) return null;

  const allowedTokens = resolveVesselStyleRule(
    selectVesselCompatibility(profile)?.allowedMaterialsByStyle,
    vesselStyle?.trim() ?? "",
  );
  if (!allowedTokens?.length) return null;

  return new Set(
    allowedTokens
      .flatMap((token) => getMaterialAliases(token, selectMaterialAliasTable(profile)))
      .map((token) => normalizeMaterialToken(token))
      .filter(Boolean),
  );
};

const getDefaultVesselFinishPreference = (
  vesselStyle: string | null | undefined,
  profile: ProductProfile | null,
): VesselFinishPreference | null => {
  if (!isVesselBasin(profile, vesselStyle)) return null;

  const rawPreference = resolveVesselStyleRule(
    selectVesselCompatibility(profile)?.defaultFinishByStyle,
    vesselStyle?.trim() ?? "",
  );
  if (!rawPreference) return null;

  const materialTokens = new Set(
    rawPreference.materialTokens
      .flatMap((token) => getMaterialAliases(token, selectMaterialAliasTable(profile)))
      .map((token) => normalizeMaterialToken(token))
      .filter(Boolean),
  );
  const colorCodes = new Set(rawPreference.colorCodes.map((code) => normalizeMaterialToken(code)).filter(Boolean));

  if (!materialTokens.size && !colorCodes.size) return null;

  return { materialTokens, colorCodes };
};

const getMaterialColorCodeRules = (
  ruleMap: Record<string, Record<string, string[]>> | undefined,
  vesselStyle: string | null | undefined,
  profile: ProductProfile | null,
): VesselMaterialColorCodeRule[] => {
  if (!isVesselBasin(profile, vesselStyle)) return [];

  const aliasTable = selectMaterialAliasTable(profile);
  const rawRules = resolveVesselStyleRule(ruleMap, vesselStyle?.trim() ?? "");
  if (!rawRules) return [];

  return Object.entries(rawRules)
    .map(([materialToken, colorCodes]) => {
      const materialTokens = new Set(
        getMaterialAliases(materialToken, aliasTable)
          .map((token) => normalizeMaterialToken(token))
          .filter(Boolean),
      );
      const normalizedColorCodes = new Set(colorCodes.map((code) => normalizeMaterialToken(code)).filter(Boolean));

      return { materialTokens, colorCodes: normalizedColorCodes };
    })
    .filter((rule) => rule.materialTokens.size > 0 && rule.colorCodes.size > 0);
};

const toMaterialCandidateTokens = (materialTokens: readonly string[], profile: ProductProfile | null): Set<string> => {
  const candidateTokens = new Set<string>();
  materialTokens.forEach((token) => {
    getMaterialAliases(token, selectMaterialAliasTable(profile))
      .map((alias) => normalizeMaterialToken(alias))
      .filter(Boolean)
      .forEach((alias) => candidateTokens.add(alias));
  });
  return candidateTokens;
};

const hasRuleMaterial = (materialCandidateTokens: ReadonlySet<string>, rule: VesselMaterialColorCodeRule): boolean =>
  Array.from(materialCandidateTokens).some((token) => rule.materialTokens.has(token));

/**
 * Whether the style's `unavailableColorCodesByStyle` lists this material and colour code. The list reads both
 * ways: a vessel colour the style refuses, and a countertop colour the style cannot stand on.
 */
export const isColorCodeUnavailableForVesselStyle = ({
  vesselStyle,
  materialTokens,
  colorCode,
  profile,
}: {
  vesselStyle?: string | null;
  materialTokens: readonly string[];
  colorCode?: string | null;
  profile: ProductProfile | null;
}): boolean => {
  const normalizedColorCode = normalizeMaterialToken(colorCode ?? "");
  if (!normalizedColorCode) return false;

  const materialCandidateTokens = toMaterialCandidateTokens(materialTokens, profile);

  return getMaterialColorCodeRules(
    selectVesselCompatibility(profile)?.unavailableColorCodesByStyle,
    vesselStyle,
    profile,
  ).some((rule) => hasRuleMaterial(materialCandidateTokens, rule) && rule.colorCodes.has(normalizedColorCode));
};

export const isPreferredVesselFinish = ({
  vesselStyle,
  materialTokens,
  colorCode,
  profile,
}: {
  vesselStyle?: string | null;
  materialTokens: readonly string[];
  colorCode?: string | null;
  profile: ProductProfile | null;
}): boolean => {
  const preference = getDefaultVesselFinishPreference(vesselStyle, profile);
  if (!preference) return false;

  const candidateMaterialTokens = toMaterialCandidateTokens(materialTokens, profile);

  const normalizedColorCode = normalizeMaterialToken(colorCode ?? "");
  const matchesMaterial =
    preference.materialTokens.size === 0 ||
    Array.from(candidateMaterialTokens).some((token) => preference.materialTokens.has(token));
  const matchesColor =
    preference.colorCodes.size === 0 ||
    (normalizedColorCode.length > 0 && preference.colorCodes.has(normalizedColorCode));

  return matchesMaterial && matchesColor;
};

export const isMaterialCompatibleWithVesselStyle = ({
  vesselStyle,
  materialTokens,
  colorCode,
  profile,
}: {
  vesselStyle?: string | null;
  materialTokens: readonly string[];
  colorCode?: string | null;
  profile: ProductProfile | null;
}): boolean => {
  const allowedTokens = getAllowedVesselMaterialTokens(vesselStyle, profile);
  if (!allowedTokens) return true;

  const materialCandidateTokens = toMaterialCandidateTokens(materialTokens, profile);
  const candidateTokens = new Set(materialCandidateTokens);

  const normalizedColorCode = normalizeMaterialToken(colorCode ?? "");
  if (normalizedColorCode) candidateTokens.add(normalizedColorCode);

  if (candidateTokens.size === 0) return true;

  const hasAllowedToken = Array.from(candidateTokens).some((token) => allowedTokens.has(token));
  if (!hasAllowedToken) return false;

  if (isColorCodeUnavailableForVesselStyle({ vesselStyle, materialTokens, colorCode, profile })) return false;

  const materialColorCodeRules = getMaterialColorCodeRules(
    selectVesselCompatibility(profile)?.allowedColorCodesByStyle,
    vesselStyle,
    profile,
  );
  if (!materialColorCodeRules.length) return true;

  const hasMaterialColorCodeRule = materialColorCodeRules.some((rule) =>
    hasRuleMaterial(materialCandidateTokens, rule),
  );
  if (!hasMaterialColorCodeRule) return true;

  return Boolean(
    normalizedColorCode &&
    materialColorCodeRules.some(
      (rule) => hasRuleMaterial(materialCandidateTokens, rule) && rule.colorCodes.has(normalizedColorCode),
    ),
  );
};
