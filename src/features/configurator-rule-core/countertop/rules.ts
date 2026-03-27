import type { CountertopMatrixRule } from "./types";
import {
  normalizeBasinKey,
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
  allowedBasinKeys: Set<string>;
  allowedFaucetHoles: Set<string>;
  allowedStyles: Set<string>;
};

type ResolveDefaultThicknessInput = {
  rules: CountertopMatrixRule[];
  activeMaterialTokens: string[];
  depth: number | null;
};

/** Returns first valid thickness (as string) for current material/depth matrix context. */
export const resolveDefaultThicknessFromRules = ({
  rules,
  activeMaterialTokens,
  depth,
}: ResolveDefaultThicknessInput): string | null => {
  const matchingRules = rules.filter((rule) => {
    if (!matchesDepth(rule, depth)) return false;
    if (!activeMaterialTokens.length) return true;
    return activeMaterialTokens.some((material) => materialMatchesRule(material, rule.material));
  });

  for (const rule of matchingRules) {
    for (const raw of rule.topThicknesses) {
      const parsed = parseThicknessValue(raw);
      if (parsed !== null) return String(parsed);
    }
  }

  return null;
};

export const buildCountertopRuleState = ({
  rules,
  activeMaterialTokens,
  width,
  depth,
  activeThickness,
}: CountertopRuleInput): CountertopRuleResult => {
  const allowedMaterials = new Set<string>();
  const allowedThicknesses = new Set<number>();
  const allowedBasinTokens = new Set<string>();
  const allowedBasinKeys = new Set<string>();
  const allowedFaucetHoles = new Set<string>();
  const allowedStyles = new Set<string>();
  const activeThicknessValue = activeThickness ? parseThicknessValue(activeThickness) : null;

  if (!rules.length) {
    return {
      matchingRules: [],
      allowedMaterials,
      allowedThicknesses,
      allowedBasinTokens,
      allowedBasinKeys,
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
    rule.topThicknesses.forEach((value) => {
      const parsed = parseThicknessValue(value);
      if (parsed !== null) allowedThicknesses.add(parsed);
    });
  });

  const isWidthValid = (maxValue: number | null) => maxValue !== null && (!width || width <= maxValue);
  const meetsMinSb = (rule: CountertopMatrixRule) => !width || !rule.minSbCm || width >= rule.minSbCm;

  matchingRules.forEach((rule) => {
    if (!matchesActiveThickness(rule)) return;

    if (meetsMinSb(rule)) {
      allowedBasinTokens.add(normalizeBasinToken(rule.basinStyle));
      allowedBasinKeys.add(normalizeBasinKey(rule.basinStyle));
    }
  });

  // Countertop-style constraints (Vessel / Undermount) should not depend on basin rules.
  matchingRules.forEach((rule) => {
    if (!matchesActiveThickness(rule)) return;

    if (isWidthValid(rule.maxVesselCm)) {
      allowedStyles.add("vessel");
    }

    if (isWidthValid(rule.maxUndermountCm)) {
      allowedStyles.add("undermount");
    }
  });

  // Integrated rules are basin-driven.
  matchingRules.forEach((rule) => {
    if (!meetsMinSb(rule)) return;
    if (!matchesActiveThickness(rule)) return;

    if (isWidthValid(rule.maxIntegratedCm)) {
      if (
        rule.integratedAllowedSizesOnly.length === 0 ||
        !width ||
        rule.integratedAllowedSizesOnly.some((value) => Math.abs(value - width) < 0.01)
      ) {
        allowedStyles.add("integrated");
      }
    }
  });

  matchingRules.forEach((rule) => {
    rule.faucetHoles.forEach((value) => {
      if (value) allowedFaucetHoles.add(normalizeFaucetHoleToken(value));
    });
  });

  return {
    matchingRules,
    allowedMaterials,
    allowedThicknesses,
    allowedBasinTokens,
    allowedBasinKeys,
    allowedFaucetHoles,
    allowedStyles,
  };
};
