import type { CountertopMatrixRule } from "./types";
import { materialMatchesRule, matchesDepth } from "./parse";

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
  activeCabinetIsOpen?: boolean;
  activeMaterialTokens: string[];
  rules: CountertopMatrixRule[];
  selectedDepth: number | null;
};

export const filterWidthValuesByCountertopRules = ({
  values,
  activeCabinetCode,
  activeCabinetIsOpen,
  activeMaterialTokens,
  rules,
  selectedDepth,
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

  const isWidthAllowedByAnyRule = (width: number) =>
    matchingRules.some((rule) => {
      if (rule.minSbCm !== null && width < rule.minSbCm) return false;

      const maxLimits = [rule.maxIntegratedCm, rule.maxVesselCm, rule.maxUndermountCm].filter(
        (value): value is number => value !== null,
      );
      if (maxLimits.length > 0 && !maxLimits.some((limit) => width <= limit)) return false;

      if (
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
