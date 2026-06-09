import {
  extractCountertopBasinMaterialScopeTokens,
  getMaterialAliases,
  materialMatchesRule,
  matchesDepthForStyle,
  normalizeBasinKey,
  normalizeMaterialToken,
  parseThicknessValue,
} from "./parse";
import { isRuleWidthEligibleForIntegratedContext } from "./rules";
import type { CountertopMatrixRule } from "./types";

export type CountertopBasinOptionLike = {
  title?: string;
  name?: string;
};

export type CountertopBasinSelectionDimensions = {
  sinkBaseWidth: number | null;
  totalWidth: number | null;
  depth: number | null;
};

type ResolveIntegratedCountertopBasinOptionsInput = {
  basinOptions: CountertopBasinOptionLike[];
  rules: CountertopMatrixRule[];
  activeMaterialTokens: string[];
  activeThickness?: string | null;
  dimensions: CountertopBasinSelectionDimensions;
};

type ResolveIntegratedCountertopBasinFallbackInput = ResolveIntegratedCountertopBasinOptionsInput & {
  activeBasinStyle?: string | null;
  preferredBasinStyle?: string | null;
};

const getBasinOptionValue = (option: CountertopBasinOptionLike): string | null => option.name ?? option.title ?? null;

const matchesThickness = (rule: CountertopMatrixRule, activeThickness?: string | null): boolean => {
  if (!activeThickness) return true;

  const activeThicknessValue = parseThicknessValue(activeThickness);
  if (activeThicknessValue === null) return true;

  return rule.topThicknesses
    .map((value) => parseThicknessValue(value))
    .filter((value): value is number => value !== null)
    .some((value) => Math.abs(value - activeThicknessValue) < 0.001);
};

export const resolveAvailableIntegratedCountertopBasinOptions = ({
  basinOptions,
  rules,
  activeMaterialTokens,
  activeThickness,
  dimensions,
}: ResolveIntegratedCountertopBasinOptionsInput): CountertopBasinOptionLike[] => {
  const normalizedActiveMaterials = activeMaterialTokens.map((material) => normalizeMaterialToken(material));
  const applicableRules = rules.filter((rule) => {
    if (!matchesDepthForStyle(rule, dimensions.depth, "integrated")) return false;
    if (!matchesThickness(rule, activeThickness)) return false;
    if (!activeMaterialTokens.length) return true;
    return activeMaterialTokens.some((material) => materialMatchesRule(material, rule.material));
  });

  if (!applicableRules.length) return [];

  const integratedWidthContext = {
    sinkBaseWidth: dimensions.sinkBaseWidth,
    totalWidth: dimensions.totalWidth,
  };

  return basinOptions.flatMap((option) => {
    const label = option.title ?? option.name ?? "";
    if (!label) return [];

    const [, ...restTokens] = label.trim().split(/\s+/);
    const materialTokens = extractCountertopBasinMaterialScopeTokens(label, option.name);
    const isMaterialSpecific = materialTokens.length > 0;

    if (isMaterialSpecific && normalizedActiveMaterials.length > 0) {
      const matchesMaterial = materialTokens.some((token) =>
        getMaterialAliases(token).some((alias) => normalizedActiveMaterials.includes(alias)),
      );
      if (!matchesMaterial) return [];
    }

    const basinLabelCandidates = isMaterialSpecific ? [restTokens.join(" "), label] : [label];
    const normalizedBasinLabelCandidates = new Set(
      basinLabelCandidates.map((candidate) => normalizeBasinKey(candidate)).filter(Boolean),
    );
    const basinRules = applicableRules.filter((rule) =>
      normalizedBasinLabelCandidates.has(normalizeBasinKey(rule.basinStyle)),
    );
    if (!basinRules.length) return [];

    const isAvailable = basinRules.some((rule) =>
      isRuleWidthEligibleForIntegratedContext(rule, integratedWidthContext),
    );

    return isAvailable ? [option] : [];
  });
};

export const resolveIntegratedCountertopBasinFallback = ({
  activeBasinStyle,
  preferredBasinStyle,
  ...input
}: ResolveIntegratedCountertopBasinFallbackInput): string | null => {
  const availableOptions = resolveAvailableIntegratedCountertopBasinOptions(input);
  const availableValues = availableOptions.map(getBasinOptionValue).filter((value): value is string => Boolean(value));

  if (!availableValues.length) return null;
  if (activeBasinStyle && availableValues.includes(activeBasinStyle)) return activeBasinStyle;
  if (preferredBasinStyle && availableValues.includes(preferredBasinStyle)) return preferredBasinStyle;

  return availableValues[0] ?? null;
};
