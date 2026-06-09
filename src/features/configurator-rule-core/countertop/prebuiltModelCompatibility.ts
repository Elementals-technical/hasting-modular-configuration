import type { PresetProduct } from "@/entities/product/types";

import { resolveCountertopCabinetCompositionConstraint } from "./compositionConstraints";
import {
  materialMatchesRule,
  matchesDepthForStyle,
  normalizeBasinKey,
  normalizeBasinToken,
  normalizeMaterialToken,
  parseThicknessValue,
} from "./parse";
import { buildCountertopRuleState } from "./rules";
import { isCountertopRuleWidthAllowed, resolveCountertopWidthRuleStyle } from "./sizeFilters";
import type { CountertopMatrixRule } from "./types";

type PrebuiltPresetDimensions = {
  sinkBaseWidth: number | null;
  sinkBaseDepth: number | null;
  totalWidth: number | null;
  cabinetCount: number;
};

export type PrebuiltModelCountertopCompatibilityInput = {
  rules: CountertopMatrixRule[];
  presetProducts: PresetProduct[];
  activeMaterialTokens: string[];
  activeCountertopStyle?: string | null;
  activeBasinStyle?: string | null;
  activeThickness?: string | null;
};

export type PrebuiltModelCountertopCompatibilityResult = {
  isCompatible: boolean;
  reason?: string;
};

const normalizeProductName = (value?: string | null): string => value?.toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";

const isSinkBasePreset = (preset: PresetProduct): boolean => normalizeProductName(preset.name).includes("sinkbase");

const toFiniteNumber = (value: number | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const resolvePresetDimensions = (presetProducts: PresetProduct[]): PrebuiltPresetDimensions => {
  const totalWidthValues = presetProducts.map((preset) => toFiniteNumber(preset.Width));
  const totalWidth = totalWidthValues.some((value) => value !== null)
    ? totalWidthValues.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;

  let sinkBaseWidth: number | null = null;
  let sinkBaseDepth: number | null = null;

  presetProducts.forEach((preset) => {
    if (!isSinkBasePreset(preset)) return;

    const width = toFiniteNumber(preset.Width);
    const depth = toFiniteNumber(preset.Depth);

    if (width !== null && (sinkBaseWidth === null || width > sinkBaseWidth)) {
      sinkBaseWidth = width;
      sinkBaseDepth = depth;
    }
  });

  return {
    sinkBaseWidth,
    sinkBaseDepth,
    totalWidth,
    cabinetCount: presetProducts.length,
  };
};

const resolveStyleKey = (value?: string | null): "integrated" | "vessel" | "undermount" | null => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "integrated" || normalized === "vessel" || normalized === "undermount") return normalized;
  return null;
};

const matchesThickness = (rule: CountertopMatrixRule, activeThickness?: string | null): boolean => {
  if (!activeThickness) return true;

  const activeThicknessValue = parseThicknessValue(activeThickness);
  if (activeThicknessValue === null) return true;

  return rule.topThicknesses
    .map((value) => parseThicknessValue(value))
    .filter((value): value is number => value !== null)
    .some((value) => Math.abs(value - activeThicknessValue) < 0.001);
};

const getBasinScopedRules = ({
  rules,
  activeBasinStyle,
  widthRuleStyle,
}: {
  rules: CountertopMatrixRule[];
  activeBasinStyle?: string | null;
  widthRuleStyle: ReturnType<typeof resolveCountertopWidthRuleStyle>;
}): CountertopMatrixRule[] => {
  if (widthRuleStyle !== "integrated" || !activeBasinStyle) return rules;

  const activeBasinKey = normalizeBasinKey(activeBasinStyle);
  if (activeBasinKey) {
    const keyMatched = rules.filter((rule) => normalizeBasinKey(rule.basinStyle) === activeBasinKey);
    if (keyMatched.length > 0) return keyMatched;
  }

  const activeBasinToken = normalizeBasinToken(activeBasinStyle);
  if (!activeBasinToken) return [];

  return rules.filter((rule) => normalizeBasinToken(rule.basinStyle) === activeBasinToken);
};

const scopeRulesBySelection = ({
  rules,
  activeBasinStyle,
  activeThickness,
  widthRuleStyle,
}: {
  rules: CountertopMatrixRule[];
  activeBasinStyle?: string | null;
  activeThickness?: string | null;
  widthRuleStyle: ReturnType<typeof resolveCountertopWidthRuleStyle>;
}): CountertopMatrixRule[] => {
  const basinScopedRules = getBasinScopedRules({
    rules,
    activeBasinStyle,
    widthRuleStyle,
  });
  const thicknessScopedRules = basinScopedRules.filter((rule) => matchesThickness(rule, activeThickness));

  const activeThicknessValue = activeThickness ? parseThicknessValue(activeThickness) : null;
  if (activeThicknessValue !== null) return thicknessScopedRules;

  return thicknessScopedRules.length > 0 ? thicknessScopedRules : basinScopedRules;
};

const isMaterialCompatible = ({
  rules,
  activeMaterialTokens,
  activeCountertopStyle,
  activeBasinStyle,
  activeThickness,
  dimensions,
}: {
  rules: CountertopMatrixRule[];
  activeMaterialTokens: string[];
  activeCountertopStyle?: string | null;
  activeBasinStyle?: string | null;
  activeThickness?: string | null;
  dimensions: PrebuiltPresetDimensions;
}): boolean => {
  if (!activeMaterialTokens.length) return true;

  const compositionConstraint = resolveCountertopCabinetCompositionConstraint({
    materialTokens: activeMaterialTokens,
    cabinetCount: dimensions.cabinetCount,
  });
  if (!compositionConstraint.isWithinCabinetLimit) return false;

  const widthRuleStyle = resolveCountertopWidthRuleStyle({
    activeCountertopStyle,
    activeBasinStyle,
  });

  const materialMatchingRules = rules.filter((rule) =>
    activeMaterialTokens.some((material) => materialMatchesRule(material, rule.material)),
  );
  const applicableRules = materialMatchingRules.filter((rule) =>
    matchesDepthForStyle(rule, dimensions.sinkBaseDepth, widthRuleStyle),
  );

  if (!applicableRules.length) {
    return materialMatchingRules.length === 0 && activeMaterialTokens.some((token) => normalizeMaterialToken(token) === "ceramic");
  }

  const selectionScopedRules = scopeRulesBySelection({
    rules: applicableRules,
    activeBasinStyle,
    activeThickness,
    widthRuleStyle,
  });

  if (!selectionScopedRules.length) return false;

  const matchesWidth = (width: number, context: "total" | "sb") =>
    selectionScopedRules.some((rule) =>
      isCountertopRuleWidthAllowed({
        rule,
        width,
        style: widthRuleStyle,
        context: context === "sb" ? "sink-base" : "generic",
        activeBasinStyle,
      }),
    );

  if (dimensions.sinkBaseWidth !== null && !matchesWidth(dimensions.sinkBaseWidth, "sb")) return false;
  if (dimensions.totalWidth !== null && !matchesWidth(dimensions.totalWidth, "total")) return false;

  return true;
};

export const resolvePrebuiltModelCountertopCompatibility = ({
  rules,
  presetProducts,
  activeMaterialTokens,
  activeCountertopStyle,
  activeBasinStyle,
  activeThickness,
}: PrebuiltModelCountertopCompatibilityInput): PrebuiltModelCountertopCompatibilityResult => {
  if (!rules.length || !presetProducts.length) return { isCompatible: true };
  if (!activeMaterialTokens.length && !activeCountertopStyle) return { isCompatible: true };

  const dimensions = resolvePresetDimensions(presetProducts);
  const materialCompatible = isMaterialCompatible({
    rules,
    activeMaterialTokens,
    activeCountertopStyle,
    activeBasinStyle,
    activeThickness,
    dimensions,
  });
  if (!materialCompatible) {
    return {
      isCompatible: false,
      reason: "The selected countertop material/finish is not available for this model.",
    };
  }

  const ruleState = buildCountertopRuleState({
    rules,
    activeMaterialTokens,
    width: dimensions.sinkBaseWidth,
    sinkBaseWidth: dimensions.sinkBaseWidth,
    totalWidth: dimensions.totalWidth,
    depth: dimensions.sinkBaseDepth,
    activeCountertopStyle,
    activeBasinStyle: activeBasinStyle ?? null,
    activeThickness: activeThickness ?? null,
  });

  const styleKey = resolveStyleKey(activeCountertopStyle);
  if (styleKey && !ruleState.styleAvailability[styleKey].isAvailable) {
    return {
      isCompatible: false,
      reason: ruleState.styleAvailability[styleKey].disabledReason,
    };
  }

  return { isCompatible: true };
};
