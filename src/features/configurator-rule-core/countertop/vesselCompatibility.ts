import {
  vesselAllowedMaterialColorCodesMap,
  vesselAllowedMaterialsMap,
  vesselUnavailableMaterialColorCodesMap,
} from "@/shared/lib/sku";

import { getMaterialAliases, normalizeMaterialToken } from "./parse";

export const VESSEL_COLOR_UNAVAILABLE_REASON = "Not available for selected vessel sink style.";

const HIDDEN_VESSEL_SINK_STYLES = new Set(["Vessel_UrbanModo_Cover", "Vessel_UrbanModo_Seam", "Vessel_UrbanModo_Flat"]);

type VesselMaterialColorCodeRule = {
  materialTokens: Set<string>;
  colorCodes: Set<string>;
};

export const isVesselSinkStyle = (value?: string | null): boolean => {
  return Boolean(value?.trim().startsWith("Vessel_"));
};

export const isVisibleVesselSinkStyle = (value?: string | null): boolean => {
  const normalizedValue = value?.trim();
  return Boolean(normalizedValue && isVesselSinkStyle(normalizedValue) && !HIDDEN_VESSEL_SINK_STYLES.has(normalizedValue));
};

const resolveVesselStyleRule = <T,>(ruleMap: Record<string, T>, vesselStyle: string): T | null => {
  const directMatch = ruleMap[vesselStyle];
  if (directMatch !== undefined) return directMatch;

  const inheritedKey = Object.keys(ruleMap)
    .filter((key) => vesselStyle.startsWith(`${key}_`))
    .sort((left, right) => right.length - left.length)[0];

  return inheritedKey ? ruleMap[inheritedKey] : null;
};

export const getAllowedVesselMaterialTokens = (vesselStyle?: string | null): Set<string> | null => {
  if (!isVesselSinkStyle(vesselStyle)) return null;

  const allowedTokens = resolveVesselStyleRule(vesselAllowedMaterialsMap, vesselStyle?.trim() ?? "");
  if (!allowedTokens?.length) return null;

  return new Set(
    allowedTokens
      .flatMap((token) => getMaterialAliases(token))
      .map((token) => normalizeMaterialToken(token))
      .filter(Boolean),
  );
};

const getMaterialColorCodeRules = (
  ruleMap: Record<string, Record<string, string[]>>,
  vesselStyle?: string | null,
): VesselMaterialColorCodeRule[] => {
  if (!isVesselSinkStyle(vesselStyle)) return [];

  const rawRules = resolveVesselStyleRule(ruleMap, vesselStyle?.trim() ?? "");
  if (!rawRules) return [];

  return Object.entries(rawRules)
    .map(([materialToken, colorCodes]) => {
      const materialTokens = new Set(
        getMaterialAliases(materialToken)
          .map((token) => normalizeMaterialToken(token))
          .filter(Boolean),
      );
      const normalizedColorCodes = new Set(colorCodes.map((code) => normalizeMaterialToken(code)).filter(Boolean));

      return { materialTokens, colorCodes: normalizedColorCodes };
    })
    .filter((rule) => rule.materialTokens.size > 0 && rule.colorCodes.size > 0);
};

const getAllowedMaterialColorCodeRules = (vesselStyle?: string | null): VesselMaterialColorCodeRule[] =>
  getMaterialColorCodeRules(vesselAllowedMaterialColorCodesMap, vesselStyle);

const getUnavailableMaterialColorCodeRules = (vesselStyle?: string | null): VesselMaterialColorCodeRule[] =>
  getMaterialColorCodeRules(vesselUnavailableMaterialColorCodesMap, vesselStyle);

export const isMaterialCompatibleWithVesselStyle = ({
  vesselStyle,
  materialTokens,
  colorCode,
}: {
  vesselStyle?: string | null;
  materialTokens: readonly string[];
  colorCode?: string | null;
}): boolean => {
  const allowedTokens = getAllowedVesselMaterialTokens(vesselStyle);
  if (!allowedTokens) return true;

  const materialCandidateTokens = new Set<string>();
  const candidateTokens = new Set<string>();
  materialTokens.forEach((token) => {
    getMaterialAliases(token)
      .map((alias) => normalizeMaterialToken(alias))
      .filter(Boolean)
      .forEach((alias) => {
        materialCandidateTokens.add(alias);
        candidateTokens.add(alias);
      });
  });

  const normalizedColorCode = normalizeMaterialToken(colorCode ?? "");
  if (normalizedColorCode) candidateTokens.add(normalizedColorCode);

  if (candidateTokens.size === 0) return true;

  const hasAllowedToken = Array.from(candidateTokens).some((token) => allowedTokens.has(token));
  if (!hasAllowedToken) return false;

  const materialMatchesRule = (rule: VesselMaterialColorCodeRule) =>
    Array.from(materialCandidateTokens).some((token) => rule.materialTokens.has(token));

  const unavailableMaterialColorCodeRules = getUnavailableMaterialColorCodeRules(vesselStyle);
  if (
    normalizedColorCode &&
    unavailableMaterialColorCodeRules.some(
      (rule) => materialMatchesRule(rule) && rule.colorCodes.has(normalizedColorCode),
    )
  ) {
    return false;
  }

  const materialColorCodeRules = getAllowedMaterialColorCodeRules(vesselStyle);
  if (!materialColorCodeRules.length) return true;

  const hasMaterialColorCodeRule = materialColorCodeRules.some((rule) => materialMatchesRule(rule));
  if (!hasMaterialColorCodeRule) return true;

  return Boolean(
    normalizedColorCode &&
      materialColorCodeRules.some((rule) => materialMatchesRule(rule) && rule.colorCodes.has(normalizedColorCode)),
  );
};
