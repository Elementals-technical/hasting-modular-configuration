import type { CountertopMatrixRule } from "./types";
import {
  getCountertopRuleDepthsForStyle,
  materialMatchesRule,
  matchesDepthForStyle,
  normalizeBasinKey,
  normalizeMaterialToken,
  parseThicknessValue,
  scopeCountertopRulesByBasinStyle,
} from "./parse";

const INTEGRATED_STYLE_RESTRICTED_DEPTHS_CM = [46];
const INTEGRATED_STYLE_RESTRICTED_MATERIAL_TOKENS = new Set([
  "tekormud",
  "tekorund",
  "sstm",
  "solidsurface",
  "ssocr",
  "sst1c",
  "sst1d",
]);

const toNumericDimension = (value: string | number): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

type FilterWidthValuesParams = {
  values: Array<string | number>;
  activeCabinetCode?: string | null;
  isSinkBaseCabinet?: boolean;
  activeCabinetIsOpen?: boolean;
  activeMaterialTokens: string[];
  rules: CountertopMatrixRule[];
  selectedDepth: number | null;
  activeCountertopStyle?: string | null;
  activeBasinStyle?: string | null;
  activeThickness?: string | null;
};

export type CountertopWidthRuleStyle = "integrated" | "vessel" | "undermount" | "plain";
export type CountertopWidthRuleContext = "sink-base" | "generic";

export const resolveCountertopWidthRuleStyle = ({
  activeCountertopStyle,
  activeBasinStyle,
}: {
  activeCountertopStyle?: string | null;
  activeBasinStyle?: string | null;
}): CountertopWidthRuleStyle => {
  const normalizedStyle = activeCountertopStyle?.trim().toLowerCase() ?? "";
  const basinLooksIntegrated =
    Boolean(activeBasinStyle) && !String(activeBasinStyle).trim().toLowerCase().startsWith("vessel_");

  if (normalizedStyle === "integrated" || basinLooksIntegrated) return "integrated";
  if (normalizedStyle === "vessel") return "vessel";
  if (normalizedStyle === "undermount") return "undermount";
  return "plain";
};

export const getCountertopRuleMaxWidthsForStyle = (
  rule: CountertopMatrixRule,
  style: CountertopWidthRuleStyle,
): number[] =>
  (
    style === "integrated"
      ? [rule.maxIntegratedCm]
      : style === "vessel"
        ? [rule.maxVesselCm]
        : style === "undermount"
          ? [rule.maxUndermountCm]
          : [rule.maxIntegratedCm, rule.maxVesselCm, rule.maxUndermountCm]
  ).filter((value): value is number => value !== null);

export const isCountertopRuleWidthAllowed = ({
  rule,
  width,
  style,
  context,
}: {
  rule: CountertopMatrixRule;
  width: number;
  style: CountertopWidthRuleStyle;
  context: CountertopWidthRuleContext;
}): boolean => {
  const isIntegratedSinkBaseContext = style === "integrated" && context === "sink-base";

  if (isIntegratedSinkBaseContext && rule.minSbCm !== null && width < rule.minSbCm) return false;

  const maxLimits = getCountertopRuleMaxWidthsForStyle(rule, style);
  if (maxLimits.length > 0 && !maxLimits.some((limit) => width <= limit)) return false;

  if (
    isIntegratedSinkBaseContext &&
    rule.integratedAllowedSizesOnly.length > 0 &&
    !rule.integratedAllowedSizesOnly.some((value) => Math.abs(value - width) < 0.01)
  ) {
    return false;
  }

  return true;
};

export const filterWidthValuesByCountertopRules = ({
  values,
  activeCabinetCode,
  isSinkBaseCabinet,
  activeCabinetIsOpen,
  activeMaterialTokens,
  rules,
  selectedDepth,
  activeCountertopStyle,
  activeBasinStyle,
  activeThickness,
}: FilterWidthValuesParams): Array<string | number> => {
  if (!values.length) return values;
  if (activeCabinetIsOpen) return values;
  if (activeCabinetCode === "Sink-Cabinet") return values;
  if (!activeMaterialTokens.length || !rules.length) return values;

  const widthRuleStyle = resolveCountertopWidthRuleStyle({
    activeCountertopStyle,
    activeBasinStyle,
  });
  const matchingRules = rules.filter((rule) => {
    if (!matchesDepthForStyle(rule, selectedDepth, widthRuleStyle)) return false;
    return activeMaterialTokens.some((material) => materialMatchesRule(material, rule.material));
  });

  if (!matchingRules.length) return values;

  const isIntegratedStyle = widthRuleStyle === "integrated";
  const activeBasinKey = activeBasinStyle ? normalizeBasinKey(activeBasinStyle) : "";
  const activeThicknessValue = activeThickness ? parseThicknessValue(activeThickness) : null;

  const matchesThickness = (rule: CountertopMatrixRule): boolean => {
    if (activeThicknessValue === null) return true;
    return rule.topThicknesses
      .map((value) => parseThicknessValue(value))
      .filter((value): value is number => value !== null)
      .some((value) => Math.abs(value - activeThicknessValue) < 0.001);
  };

  const basinScopedRules =
    isIntegratedStyle && activeBasinKey ? scopeCountertopRulesByBasinStyle(matchingRules, activeBasinStyle) : matchingRules;

  const thicknessScopedRules = basinScopedRules.filter((rule) => matchesThickness(rule));

  const rulesForWidth =
    thicknessScopedRules.length > 0 ? thicknessScopedRules : basinScopedRules.length > 0 ? basinScopedRules : matchingRules;
  const shouldEnforceMinSb =
    Boolean(isSinkBaseCabinet) ||
    (activeCabinetCode ? /(^|[-_\s])sink[-_\s]?base($|[-_\s])|^sb$/i.test(activeCabinetCode) : false);

  const isWidthAllowedByAnyRule = (width: number) =>
    rulesForWidth.some((rule) => {
      return isCountertopRuleWidthAllowed({
        rule,
        width,
        style: widthRuleStyle,
        context: shouldEnforceMinSb ? "sink-base" : "generic",
      });
    });

  return values.filter((value) => {
    const numeric = toNumericDimension(value);
    if (numeric === null) return true;
    return isWidthAllowedByAnyRule(numeric);
  });
};

type FilterDepthValuesParams = {
  values: Array<string | number>;
  activeMaterialTokens: string[];
  rules: CountertopMatrixRule[];
  activeCountertopStyle?: string | null;
  activeBasinStyle?: string | null;
};

type FilterThicknessValuesParams = {
  values: Array<string | number>;
  allowedThicknesses: Set<number>;
};

const INTEGRATED_STYLE_RESTRICTED_BASIN_KEYS = new Set(["oly55", "oly56", "orion"]);

export const isIntegratedCountertopDepthRestrictedByMaterial = ({
  activeMaterialTokens,
  depth,
}: {
  activeMaterialTokens: string[];
  depth: number | null;
}): boolean => {
  if (depth === null || !Number.isFinite(depth)) return false;

  const matchesRestrictedDepth = INTEGRATED_STYLE_RESTRICTED_DEPTHS_CM.some(
    (restrictedDepth) => Math.abs(restrictedDepth - depth) < 0.01,
  );
  if (!matchesRestrictedDepth) return false;

  return activeMaterialTokens.some((token) =>
    INTEGRATED_STYLE_RESTRICTED_MATERIAL_TOKENS.has(normalizeMaterialToken(token)),
  );
};

export const isIntegratedCountertopDepthRestrictedByBasin = ({
  activeBasinStyle,
  depth,
}: {
  activeBasinStyle?: string | null;
  depth: number | null;
}): boolean => {
  if (depth === null || !Number.isFinite(depth)) return false;

  const matchesRestrictedDepth = INTEGRATED_STYLE_RESTRICTED_DEPTHS_CM.some(
    (restrictedDepth) => Math.abs(restrictedDepth - depth) < 0.01,
  );
  if (!matchesRestrictedDepth) return false;
  if (!activeBasinStyle) return false;

  return INTEGRATED_STYLE_RESTRICTED_BASIN_KEYS.has(normalizeBasinKey(activeBasinStyle));
};

export const filterDepthValuesByCountertopRules = ({
  values,
  activeMaterialTokens,
  rules,
  activeCountertopStyle,
  activeBasinStyle,
}: FilterDepthValuesParams): Array<string | number> => {
  if (!values.length) return values;

  const normalizedStyle = activeCountertopStyle?.trim().toLowerCase() ?? "";
  const basinLooksIntegrated =
    Boolean(activeBasinStyle) && !String(activeBasinStyle).trim().toLowerCase().startsWith("vessel_");
  const isIntegratedStyle = normalizedStyle === "integrated" || basinLooksIntegrated;

  const allowedDepths = new Set<number>();
  if (activeMaterialTokens.length && rules.length) {
    const matchingRules = rules.filter((rule) =>
      activeMaterialTokens.some((material) => materialMatchesRule(material, rule.material)),
    );
    const scopedRules =
      isIntegratedStyle && activeBasinStyle
        ? scopeCountertopRulesByBasinStyle(matchingRules, activeBasinStyle)
        : matchingRules;

    scopedRules.forEach((rule) => {
      const matchesMaterial = activeMaterialTokens.some((material) => materialMatchesRule(material, rule.material));
      if (!matchesMaterial) return;

      getCountertopRuleDepthsForStyle(rule, normalizedStyle).forEach((depth) => {
        if (Number.isFinite(depth)) {
          allowedDepths.add(Number(depth.toFixed(3)));
        }
      });
    });
  }

  return values.filter((value) => {
    const numeric = toNumericDimension(value);
    if (numeric === null) return true;
    const hasMatrixDepths = allowedDepths.size > 0;

    if (
      !hasMatrixDepths &&
      isIntegratedStyle &&
      isIntegratedCountertopDepthRestrictedByMaterial({
        activeMaterialTokens,
        depth: numeric,
      })
    ) {
      return false;
    }

    if (
      !hasMatrixDepths &&
      isIntegratedStyle &&
      isIntegratedCountertopDepthRestrictedByBasin({
        activeBasinStyle,
        depth: numeric,
      })
    ) {
      return false;
    }

    if (!allowedDepths.size) return true;
    return Array.from(allowedDepths).some((depth) => Math.abs(depth - numeric) < 0.01);
  });
};

export const filterThicknessValuesByCountertopRules = ({
  values,
  allowedThicknesses,
}: FilterThicknessValuesParams): Array<string | number> => {
  if (!values.length || allowedThicknesses.size === 0) return values;

  return values.filter((value) => {
    const numeric = toNumericDimension(value);
    if (numeric === null) return true;

    return Array.from(allowedThicknesses).some((allowedValue) => Math.abs(allowedValue - numeric) < 0.001);
  });
};
