import type { CountertopMatrixRule } from "./types";
import { materialMatchesRule, matchesDepth, normalizeBasinKey, normalizeBasinToken, parseThicknessValue } from "./parse";

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

  const matchingRules = rules.filter((rule) => {
    if (!matchesDepth(rule, selectedDepth)) return false;
    return activeMaterialTokens.some((material) => materialMatchesRule(material, rule.material));
  });

  if (!matchingRules.length) return values;

  const normalizedStyle = activeCountertopStyle?.trim().toLowerCase() ?? "";
  const basinLooksIntegrated =
    Boolean(activeBasinStyle) && !String(activeBasinStyle).trim().toLowerCase().startsWith("vessel_");
  const isIntegratedStyle = normalizedStyle === "integrated" || basinLooksIntegrated;
  const isVesselStyle = normalizedStyle === "vessel";
  const isUndermountStyle = normalizedStyle === "undermount";
  const activeBasinKey = activeBasinStyle ? normalizeBasinKey(activeBasinStyle) : "";
  const activeThicknessValue = activeThickness ? parseThicknessValue(activeThickness) : null;

  const matchesThickness = (rule: CountertopMatrixRule): boolean => {
    if (activeThicknessValue === null) return true;
    return rule.topThicknesses
      .map((value) => parseThicknessValue(value))
      .filter((value): value is number => value !== null)
      .some((value) => Math.abs(value - activeThicknessValue) < 0.001);
  };

  const basinScopedRules = (() => {
    if (!(isIntegratedStyle && activeBasinKey)) return matchingRules;

    const keyMatched = matchingRules.filter((rule) => normalizeBasinKey(rule.basinStyle) === activeBasinKey);
    if (keyMatched.length > 0) return keyMatched;

    const activeBasinToken = activeBasinStyle ? normalizeBasinToken(activeBasinStyle) : "";
    if (!activeBasinToken) return matchingRules;

    const tokenMatched = matchingRules.filter((rule) => normalizeBasinToken(rule.basinStyle) === activeBasinToken);
    return tokenMatched.length > 0 ? tokenMatched : matchingRules;
  })();

  const thicknessScopedRules = basinScopedRules.filter((rule) => matchesThickness(rule));

  const rulesForWidth =
    thicknessScopedRules.length > 0 ? thicknessScopedRules : basinScopedRules.length > 0 ? basinScopedRules : matchingRules;
  const shouldEnforceMinSb =
    Boolean(isSinkBaseCabinet) ||
    (activeCabinetCode ? /(^|[-_\s])sink[-_\s]?base($|[-_\s])|^sb$/i.test(activeCabinetCode) : false);

  const isWidthAllowedByAnyRule = (width: number) =>
    rulesForWidth.some((rule) => {
      if (shouldEnforceMinSb && rule.minSbCm !== null && width < rule.minSbCm) return false;

      const maxLimits = (
        isIntegratedStyle
          ? [rule.maxIntegratedCm]
          : isVesselStyle
            ? [rule.maxVesselCm]
            : isUndermountStyle
              ? [rule.maxUndermountCm]
              : [rule.maxIntegratedCm, rule.maxVesselCm, rule.maxUndermountCm]
      ).filter((value): value is number => value !== null);
      if (maxLimits.length > 0 && !maxLimits.some((limit) => width <= limit)) return false;

      if (
        isIntegratedStyle &&
        rule.integratedAllowedSizesOnly.length > 0 &&
        !rule.integratedAllowedSizesOnly.some((value) => Math.abs(value - width) < 0.01)
      ) {
        return false;
      }

      return true;
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
};

export const filterDepthValuesByCountertopRules = ({
  values,
  activeMaterialTokens,
  rules,
}: FilterDepthValuesParams): Array<string | number> => {
  if (!values.length) return values;
  if (!activeMaterialTokens.length || !rules.length) return values;

  const allowedDepths = new Set<number>();
  rules.forEach((rule) => {
    const matchesMaterial = activeMaterialTokens.some((material) => materialMatchesRule(material, rule.material));
    if (!matchesMaterial) return;

    [...rule.depths, ...rule.depthOnlyCm].forEach((depth) => {
      if (Number.isFinite(depth)) {
        allowedDepths.add(Number(depth.toFixed(3)));
      }
    });
  });

  if (!allowedDepths.size) return values;

  return values.filter((value) => {
    const numeric = toNumericDimension(value);
    if (numeric === null) return true;
    return Array.from(allowedDepths).some((depth) => Math.abs(depth - numeric) < 0.01);
  });
};
