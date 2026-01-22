import type { CountertopMatrixRule } from "./types";
import {
  materialMatchesRule,
  matchesDepth,
  normalizeBasinToken,
  normalizeFaucetHoleToken,
  normalizeMaterialToken,
  parseThicknessValue,
} from "./parse";

export type CountertopRuleInput = {
  rules: CountertopMatrixRule[];
  activeMaterialTokens: string[];
  width: number | null;
  depth: number | null;
  activeBasinStyle: string | null;
  activeThickness: string | null;
};

export type CountertopRuleResult = {
  matchingRules: CountertopMatrixRule[];
  allowedMaterials: Set<string>;
  allowedThicknesses: Set<number>;
  allowedBasinTokens: Set<string>;
  allowedFaucetHoles: Set<string>;
  allowedStyles: Set<string>;
};

export const buildCountertopRuleState = ({
  rules,
  activeMaterialTokens,
  width,
  depth,
  activeBasinStyle,
  activeThickness,
}: CountertopRuleInput): CountertopRuleResult => {
  const allowedMaterials = new Set<string>();
  const allowedThicknesses = new Set<number>();
  const allowedBasinTokens = new Set<string>();
  const allowedFaucetHoles = new Set<string>();
  const allowedStyles = new Set<string>();
  const activeThicknessValue = activeThickness ? parseThicknessValue(activeThickness) : null;

  if (!rules.length) {
    return {
      matchingRules: [],
      allowedMaterials,
      allowedThicknesses,
      allowedBasinTokens,
      allowedFaucetHoles,
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

  const matchesActiveThickness = (rule: CountertopMatrixRule): boolean => {
    if (activeThicknessValue === null) return true;
    const parsedThicknesses = rule.topThicknesses
      .map((value) => parseThicknessValue(value))
      .filter((value): value is number => value !== null);

    return parsedThicknesses.some((value) => Math.abs(value - activeThicknessValue) < 0.001);
  };

  matchingRules.forEach((rule) => {
    if (width && rule.minSbCm && width < rule.minSbCm) {
      return;
    }

    if (matchesActiveThickness(rule)) {
      allowedBasinTokens.add(normalizeBasinToken(rule.basinStyle));
    }

    rule.topThicknesses.forEach((value) => {
      const parsed = parseThicknessValue(value);
      if (parsed !== null) allowedThicknesses.add(parsed);
    });
  });

  const activeBasinToken = activeBasinStyle ? normalizeBasinToken(activeBasinStyle) : null;

  matchingRules.forEach((rule) => {
    if (width && rule.minSbCm && width < rule.minSbCm) return;
    if (!matchesActiveThickness(rule)) return;
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

    rule.faucetHoles.forEach((value) => {
      if (value) allowedFaucetHoles.add(normalizeFaucetHoleToken(value));
    });
  });

  return {
    matchingRules,
    allowedMaterials,
    allowedThicknesses,
    allowedBasinTokens,
    allowedFaucetHoles,
    allowedStyles,
  };
};
