import type { CountertopMatrixRule } from "./types";
import {
  materialMatchesRule,
  matchesDepth,
  normalizeBasinToken,
  normalizeMaterialToken,
  parseThicknessValue,
} from "./parse";

export type CountertopRuleInput = {
  rules: CountertopMatrixRule[];
  activeMaterialTokens: string[];
  width: number | null;
  depth: number | null;
  activeBasinStyle: string | null;
};

export type CountertopRuleResult = {
  matchingRules: CountertopMatrixRule[];
  allowedMaterials: Set<string>;
  allowedThicknesses: Set<number>;
  allowedBasinTokens: Set<string>;
  allowedStyles: Set<string>;
};

export const buildCountertopRuleState = ({
  rules,
  activeMaterialTokens,
  width,
  depth,
  activeBasinStyle,
}: CountertopRuleInput): CountertopRuleResult => {
  const allowedMaterials = new Set<string>();
  const allowedThicknesses = new Set<number>();
  const allowedBasinTokens = new Set<string>();
  const allowedStyles = new Set<string>();

  if (!rules.length) {
    return {
      matchingRules: [],
      allowedMaterials,
      allowedThicknesses,
      allowedBasinTokens,
      allowedStyles,
    };
  }

  rules.forEach((rule) => {
    if (!matchesDepth(rule, depth)) return;
    allowedMaterials.add(normalizeMaterialToken(rule.material));
  });

  const matchingRules = rules.filter((rule) => {
    if (!matchesDepth(rule, depth)) return false;
    if (!activeMaterialTokens.length) return true;
    return activeMaterialTokens.some((material) => materialMatchesRule(material, rule.material));
  });

  matchingRules.forEach((rule) => {
    if (width && rule.minSbCm && width < rule.minSbCm) {
      return;
    }

    allowedBasinTokens.add(normalizeBasinToken(rule.basinStyle));

    rule.topThicknesses.forEach((value) => {
      const parsed = parseThicknessValue(value);
      if (parsed !== null) allowedThicknesses.add(parsed);
    });
  });

  const activeBasinToken = activeBasinStyle ? normalizeBasinToken(activeBasinStyle) : null;

  matchingRules.forEach((rule) => {
    if (activeBasinToken && normalizeBasinToken(rule.basinStyle) !== activeBasinToken) return;

    const isWidthValid = (maxValue: number | null) => maxValue !== null && (!width || width <= maxValue);

    if (isWidthValid(rule.maxIntegratedCm)) {
      if (
        rule.integratedAllowedSizesOnly.length === 0 ||
        !width ||
        rule.integratedAllowedSizesOnly.some((value) => Math.abs(value - width) < 0.01)
      ) {
        allowedStyles.add("integrated");
      }
    }

    if (isWidthValid(rule.maxVesselCm)) {
      allowedStyles.add("vessel");
    }

    if (isWidthValid(rule.maxUndermountCm)) {
      allowedStyles.add("undermount");
    }
  });

  return {
    matchingRules,
    allowedMaterials,
    allowedThicknesses,
    allowedBasinTokens,
    allowedStyles,
  };
};
