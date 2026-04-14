import type { CountertopMatrixRule } from "./types";
import {
  materialMatchesRule,
  matchesDepth,
  normalizeBasinKey,
  parseThicknessValue,
  scopeCountertopRulesByBasinStyle,
} from "./parse";

type CountertopStyle = "integrated" | "vessel" | "undermount" | "plain";

type ResolveCountertopMaxLengthInput = {
  rules: CountertopMatrixRule[];
  materialTokens: string[];
  style: string | null;
  depth: number | null;
  thickness: string | null;
  activeBasinStyle?: string | null;
};

const normalizeStyle = (style: string | null): CountertopStyle => {
  const value = style?.trim().toLowerCase();
  if (value === "integrated") return "integrated";
  if (value === "vessel") return "vessel";
  if (value === "undermount") return "undermount";
  return "plain";
};

const resolveRuleMaxByStyle = (rule: CountertopMatrixRule, style: CountertopStyle): number | null => {
  if (style === "integrated") return rule.maxIntegratedCm;
  if (style === "vessel") return rule.maxVesselCm;
  if (style === "undermount") return rule.maxUndermountCm;
  return null;
};

export const resolveCountertopMaxLengthByRules = ({
  rules,
  materialTokens,
  style,
  depth,
  thickness,
  activeBasinStyle,
}: ResolveCountertopMaxLengthInput): number | null => {
  if (!rules.length) return null;

  const normalizedStyle = normalizeStyle(style);
  if (normalizedStyle === "plain") return null;

  const normalizedMaterials = materialTokens.map((token) => token.trim()).filter(Boolean);
  const activeThicknessValue = thickness ? parseThicknessValue(thickness) : null;

  const matchingRules = rules.filter((rule) => {
    if (!matchesDepth(rule, depth)) return false;

    if (activeThicknessValue !== null) {
      const hasThickness = rule.topThicknesses
        .map((value) => parseThicknessValue(value))
        .filter((value): value is number => value !== null)
        .some((value) => Math.abs(value - activeThicknessValue) < 0.001);
      if (!hasThickness) return false;
    }

    if (!normalizedMaterials.length) return true;

    return normalizedMaterials.some((material) => materialMatchesRule(material, rule.material));
  });

  if (!matchingRules.length) return null;

  const basinScopedRules =
    normalizedStyle === "integrated" && normalizeBasinKey(activeBasinStyle ?? "")
      ? scopeCountertopRulesByBasinStyle(matchingRules, activeBasinStyle)
      : matchingRules;

  const limits = basinScopedRules
    .map((rule) => resolveRuleMaxByStyle(rule, normalizedStyle))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (!limits.length) return null;
  return Math.max(...limits);
};
