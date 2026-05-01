import { vesselAllowedMaterialsMap } from "@/shared/lib/sku";

import { getMaterialAliases, normalizeMaterialToken } from "./parse";

export const VESSEL_COLOR_UNAVAILABLE_REASON = "Not available for selected vessel sink style.";

const HIDDEN_VESSEL_SINK_STYLES = new Set(["Vessel_UrbanModo_Cover", "Vessel_UrbanModo_Seam", "Vessel_UrbanModo_Flat"]);

export const isVesselSinkStyle = (value?: string | null): boolean => {
  return Boolean(value?.trim().startsWith("Vessel_"));
};

export const isVisibleVesselSinkStyle = (value?: string | null): boolean => {
  const normalizedValue = value?.trim();
  return Boolean(normalizedValue && isVesselSinkStyle(normalizedValue) && !HIDDEN_VESSEL_SINK_STYLES.has(normalizedValue));
};

const getAllowedTokensForVesselStyle = (vesselStyle: string): string[] | null => {
  const directMatch = vesselAllowedMaterialsMap[vesselStyle];
  if (directMatch !== undefined) return directMatch;

  const inheritedKey = Object.keys(vesselAllowedMaterialsMap)
    .filter((key) => vesselStyle.startsWith(`${key}_`))
    .sort((left, right) => right.length - left.length)[0];

  return inheritedKey ? vesselAllowedMaterialsMap[inheritedKey] : null;
};

export const getAllowedVesselMaterialTokens = (vesselStyle?: string | null): Set<string> | null => {
  if (!isVesselSinkStyle(vesselStyle)) return null;

  const allowedTokens = getAllowedTokensForVesselStyle(vesselStyle?.trim() ?? "");
  if (!allowedTokens?.length) return null;

  return new Set(
    allowedTokens
      .flatMap((token) => getMaterialAliases(token))
      .map((token) => normalizeMaterialToken(token))
      .filter(Boolean),
  );
};

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

  const candidateTokens = new Set<string>();
  materialTokens.forEach((token) => {
    getMaterialAliases(token)
      .map((alias) => normalizeMaterialToken(alias))
      .filter(Boolean)
      .forEach((alias) => candidateTokens.add(alias));
  });

  const normalizedColorCode = normalizeMaterialToken(colorCode ?? "");
  if (normalizedColorCode) candidateTokens.add(normalizedColorCode);

  if (candidateTokens.size === 0) return true;

  return Array.from(candidateTokens).some((token) => allowedTokens.has(token));
};
