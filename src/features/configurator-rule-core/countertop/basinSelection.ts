import type { ProductProfile } from "@/entities/collection";
import {
  extractCountertopBasinMaterialScopeTokens,
  getMaterialAliases,
  materialMatchesRule,
  matchesDepthForStyle,
  normalizeBasinKey,
  normalizeMaterialToken,
  parseThicknessValue,
  selectMaterialAliasTable,
  type MaterialAliasTable,
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
  /** Active collection: its `ruleData.materialNormalization` decides which materials match. */
  profile?: ProductProfile | null;
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
  profile,
}: ResolveIntegratedCountertopBasinOptionsInput): CountertopBasinOptionLike[] => {
  const aliasTable = selectMaterialAliasTable(profile ?? null);
  const applicableRules = rules.filter((rule) => {
    if (!matchesDepthForStyle(rule, dimensions.depth, "integrated")) return false;
    if (!matchesThickness(rule, activeThickness)) return false;
    if (!activeMaterialTokens.length) return true;
    return activeMaterialTokens.some((material) => materialMatchesRule(material, rule.material, aliasTable));
  });

  if (!applicableRules.length) return [];

  const integratedWidthContext = {
    sinkBaseWidth: dimensions.sinkBaseWidth,
    totalWidth: dimensions.totalWidth,
  };

  return basinOptions.filter((option) =>
    findIntegratedBasinRules(option, applicableRules, activeMaterialTokens, aliasTable).some((rule) =>
      isRuleWidthEligibleForIntegratedContext(rule, integratedWidthContext),
    ),
  );
};

/**
 * The matrix rows an integrated basin option names. A row names the basin as the option's label
 * does without its material ("HPL Cover 50" is the HPL row "Cover 50"); a label that names a
 * material only counts while that material is the active one, so Fenix Cover 50 is no HPL basin.
 */
export const findIntegratedBasinRules = (
  option: CountertopBasinOptionLike,
  rules: readonly CountertopMatrixRule[],
  activeMaterialTokens: readonly string[],
  aliasTable: MaterialAliasTable,
): CountertopMatrixRule[] => {
  const label = option.title ?? option.name ?? "";
  if (!label) return [];

  const [, ...restTokens] = label.trim().split(/\s+/);
  const materialTokens = extractCountertopBasinMaterialScopeTokens(label, option.name, aliasTable);
  const isMaterialSpecific = materialTokens.length > 0;
  const normalizedActiveMaterials = activeMaterialTokens.map((material) => normalizeMaterialToken(material));

  if (isMaterialSpecific && normalizedActiveMaterials.length > 0) {
    const matchesMaterial = materialTokens.some((token) =>
      getMaterialAliases(token, aliasTable).some((alias) => normalizedActiveMaterials.includes(alias)),
    );
    if (!matchesMaterial) return [];
  }

  const basinLabelCandidates = isMaterialSpecific ? [restTokens.join(" "), label] : [label];
  const normalizedBasinLabelCandidates = new Set(
    basinLabelCandidates.map((candidate) => normalizeBasinKey(candidate)).filter(Boolean),
  );

  return rules.filter((rule) => normalizedBasinLabelCandidates.has(normalizeBasinKey(rule.basinStyle)));
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
