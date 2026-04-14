import type { CountertopMatrixRule } from "./types";
import {
  normalizeBasinKey,
  materialMatchesRule,
  matchesDepth,
  normalizeBasinToken,
  normalizeFaucetHoleToken,
  normalizeMaterialToken,
  parseThicknessValue,
  scopeCountertopRulesByBasinStyle,
} from "./parse";

export type CountertopRuleInput = {
  rules: CountertopMatrixRule[];
  activeMaterialTokens: string[];
  width: number | null;
  sinkBaseWidth?: number | null;
  totalWidth?: number | null;
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
  width?: number | null;
};

type IntegratedWidthContext =
  | number
  | {
      sinkBaseWidth?: number | null;
      totalWidth?: number | null;
    }
  | null;

const resolveIntegratedWidthContext = (context: IntegratedWidthContext) => {
  if (typeof context === "number") {
    return { sinkBaseWidth: context, totalWidth: context };
  }

  return {
    sinkBaseWidth: context?.sinkBaseWidth ?? null,
    totalWidth: context?.totalWidth ?? null,
  };
};

export const isRuleWidthEligibleForIntegratedContext = (
  rule: CountertopMatrixRule,
  context: IntegratedWidthContext,
): boolean => {
  const { sinkBaseWidth, totalWidth } = resolveIntegratedWidthContext(context);

  if (sinkBaseWidth !== null && rule.minSbCm !== null && sinkBaseWidth < rule.minSbCm) return false;
  if (totalWidth !== null && rule.maxIntegratedCm !== null && totalWidth > rule.maxIntegratedCm) return false;

  if (
    sinkBaseWidth !== null &&
    rule.integratedAllowedSizesOnly.length > 0 &&
    !rule.integratedAllowedSizesOnly.some((value) => Math.abs(value - sinkBaseWidth) < 0.01)
  ) {
    return false;
  }

  return true;
};

/** Returns first valid thickness (as string) for current material/depth matrix context. */
export const resolveDefaultThicknessFromRules = ({
  rules,
  activeMaterialTokens,
  depth,
  width = null,
}: ResolveDefaultThicknessInput): string | null => {
  const matchingRules = rules.filter((rule) => {
    if (!matchesDepth(rule, depth)) return false;
    if (!activeMaterialTokens.length) return true;
    return activeMaterialTokens.some((material) => materialMatchesRule(material, rule.material));
  });

  const rulesForThickness = matchingRules.filter((rule) => isRuleWidthEligibleForIntegratedContext(rule, width));

  for (const rule of rulesForThickness) {
    for (const raw of rule.topThicknesses) {
      const parsed = parseThicknessValue(raw);
      if (parsed !== null) return String(parsed);
    }
  }

  return null;
};

export const getSupportedCountertopFaucetHoles = (rules: CountertopMatrixRule[]): string[] => {
  const supportedValues = new Set<string>();

  rules.forEach((rule) => {
    rule.faucetHoles.forEach((value) => {
      if (value) supportedValues.add(normalizeFaucetHoleToken(value));
    });
  });

  return Array.from(supportedValues).sort((left, right) => Number(left) - Number(right));
};

export const buildCountertopRuleState = ({
  rules,
  activeMaterialTokens,
  width,
  sinkBaseWidth,
  totalWidth,
  depth,
  activeBasinStyle,
  activeThickness,
}: CountertopRuleInput): CountertopRuleResult => {
  const allowedMaterials = new Set<string>();
  const allowedThicknesses = new Set<number>();
  const allowedBasinTokens = new Set<string>();
  const allowedBasinKeys = new Set<string>();
  const allowedFaucetHoles = new Set<string>();
  const allowedStyles = new Set<string>();
  const activeThicknessValue = activeThickness ? parseThicknessValue(activeThickness) : null;
  const integratedWidthContext = {
    sinkBaseWidth: sinkBaseWidth ?? width,
    totalWidth: totalWidth ?? width,
  };

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

  matchingRules
    .filter((rule) => isRuleWidthEligibleForIntegratedContext(rule, integratedWidthContext))
    .forEach((rule) => {
      rule.topThicknesses.forEach((value) => {
        const parsed = parseThicknessValue(value);
        if (parsed !== null) allowedThicknesses.add(parsed);
      });
    });

  const isWidthValid = (maxValue: number | null) => maxValue !== null && (!width || width <= maxValue);

  matchingRules.forEach((rule) => {
    if (!matchesActiveThickness(rule)) return;
    if (!isRuleWidthEligibleForIntegratedContext(rule, integratedWidthContext)) return;

    allowedBasinTokens.add(normalizeBasinToken(rule.basinStyle));
    allowedBasinKeys.add(normalizeBasinKey(rule.basinStyle));
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
    if (!matchesActiveThickness(rule)) return;
    if (!isRuleWidthEligibleForIntegratedContext(rule, integratedWidthContext)) return;
    allowedStyles.add("integrated");
  });

  const thicknessScopedRules = matchingRules.filter((rule) => matchesActiveThickness(rule));
  const faucetHoleRules = scopeCountertopRulesByBasinStyle(
    thicknessScopedRules.length > 0 ? thicknessScopedRules : matchingRules,
    activeBasinStyle,
  );

  faucetHoleRules.forEach((rule) => {
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
