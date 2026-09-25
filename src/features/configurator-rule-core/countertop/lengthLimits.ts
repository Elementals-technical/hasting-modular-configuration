import type { CountertopMatrixRule } from "./types";
import {
  materialMatchesRule,
  matchesDepthForStyle,
  normalizeBasinKey,
  parseThicknessValue,
  scopeCountertopRulesByBasinStyle,
  selectMaterialAliasTable,
} from "./parse";
import type { ProductProfile } from "@/entities/collection";
import { selectMessageOr } from "@/entities/collection";
import { cmToInches } from "@/shared/lib/sku/cmToInches";

export const REASON_COMPOSITION_LENGTH_REACHED = "countertop.compositionLengthReached";
export const REASON_COMPOSITION_LENGTH_REACHED_NO_MAX = "countertop.compositionLengthReachedNoMax";
export const REASON_SIDE_PANELS_EXCEED_MAX_LENGTH = "countertop.sidePanelsExceedMaxLength";

/**
 * The text comes from the collection's `messages`; the English one is the legacy fallback.
 * Without a known maximum the reason names no length.
 */
export const formatCompositionLengthReachedReason = (maxCm: number | null, profile: ProductProfile | null): string =>
  maxCm === null
    ? selectMessageOr(
        profile,
        REASON_COMPOSITION_LENGTH_REACHED_NO_MAX,
        "Maximum composition length reached for the selected countertop setup.",
      )
    : selectMessageOr(
        profile,
        REASON_COMPOSITION_LENGTH_REACHED,
        `Maximum composition length reached for the selected countertop setup (${maxCm} cm / ${cmToInches(maxCm)}").`,
        { maxCm, maxIn: cmToInches(maxCm) },
      );

export const formatSidePanelsExceedMaxReason = (
  withPanelsCm: number,
  maxCm: number,
  profile: ProductProfile | null,
): string =>
  selectMessageOr(
    profile,
    REASON_SIDE_PANELS_EXCEED_MAX_LENGTH,
    `Enabling side panels would exceed max countertop length (with panels: ${withPanelsCm} cm / ${cmToInches(withPanelsCm)}", max ${maxCm} cm / ${cmToInches(maxCm)}").`,
    { withPanelsCm, withPanelsIn: cmToInches(withPanelsCm), maxCm, maxIn: cmToInches(maxCm) },
  );

export const resolveMaxResizableCabinetWidthCm = ({
  maxCm,
  currentTotalCm,
  currentCabinetWidthCm,
}: {
  maxCm: number | null;
  currentTotalCm: number | null;
  currentCabinetWidthCm: number | null;
}): number | null => {
  if (maxCm === null || currentTotalCm === null || currentCabinetWidthCm === null) return null;
  if (!Number.isFinite(maxCm) || !Number.isFinite(currentTotalCm) || !Number.isFinite(currentCabinetWidthCm)) return null;

  return maxCm - (currentTotalCm - currentCabinetWidthCm);
};

export const resolveMaxAddableCabinetWidthCm = ({
  maxCm,
  currentTotalCm,
}: {
  maxCm: number | null;
  currentTotalCm: number | null;
}): number | null => {
  if (maxCm === null || currentTotalCm === null) return null;
  if (!Number.isFinite(maxCm) || !Number.isFinite(currentTotalCm)) return null;

  return Math.max(0, maxCm - currentTotalCm);
};

type CountertopStyle = "integrated" | "vessel" | "undermount" | "plain";

type ResolveCountertopMaxLengthInput = {
  rules: CountertopMatrixRule[];
  materialTokens: string[];
  style: string | null;
  depth: number | null;
  thickness: string | null;
  activeBasinStyle?: string | null;
  /** Active collection: its `ruleData.materialNormalization` decides which materials match. */
  profile?: ProductProfile | null;
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
  profile,
}: ResolveCountertopMaxLengthInput): number | null => {
  if (!rules.length) return null;

  // Before a countertop style is chosen (a collection without a default style, whose builder
  // comes before its countertop step), the composition is held to the longer of the two styles.
  if (!style?.trim()) {
    const limits = (["integrated", "vessel"] as const)
      .map((candidate) =>
        resolveCountertopMaxLengthByRules({
          rules,
          materialTokens,
          style: candidate,
          depth,
          thickness,
          activeBasinStyle,
          profile,
        }),
      )
      .filter((value): value is number => value !== null);

    return limits.length ? Math.max(...limits) : null;
  }

  const aliasTable = selectMaterialAliasTable(profile ?? null);

  const normalizedStyle = normalizeStyle(style);
  if (normalizedStyle === "plain") return null;

  const normalizedMaterials = materialTokens.map((token) => token.trim()).filter(Boolean);
  const activeThicknessValue = thickness ? parseThicknessValue(thickness) : null;

  const matchingRules = rules.filter((rule) => {
    if (!matchesDepthForStyle(rule, depth, normalizedStyle)) return false;

    if (activeThicknessValue !== null) {
      const hasThickness = rule.topThicknesses
        .map((value) => parseThicknessValue(value))
        .filter((value): value is number => value !== null)
        .some((value) => Math.abs(value - activeThicknessValue) < 0.001);
      if (!hasThickness) return false;
    }

    if (!normalizedMaterials.length) return true;

    return normalizedMaterials.some((material) => materialMatchesRule(material, rule.material, aliasTable));
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
