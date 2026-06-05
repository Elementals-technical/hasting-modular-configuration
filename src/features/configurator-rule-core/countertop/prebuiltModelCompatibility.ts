import type { PresetProduct } from "@/entities/product/types";

import { resolveCountertopCabinetCompositionConstraint } from "./compositionConstraints";
import { materialMatchesRule, matchesDepthForStyle, normalizeMaterialToken } from "./parse";
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

const isMaterialCompatible = ({
  rules,
  activeMaterialTokens,
  activeCountertopStyle,
  activeBasinStyle,
  dimensions,
}: {
  rules: CountertopMatrixRule[];
  activeMaterialTokens: string[];
  activeCountertopStyle?: string | null;
  activeBasinStyle?: string | null;
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

  const matchesWidth = (width: number, context: "total" | "sb") =>
    applicableRules.some((rule) =>
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
