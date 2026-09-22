import type { CountertopMatrixRule } from "./types";
import type { MessageParams, ProductProfile } from "@/entities/collection";
import { selectMessageOr } from "@/entities/collection";
import { cmToInches } from "@/shared/lib/sku";
import {
  normalizeBasinKey,
  materialMatchesRule,
  matchesDepthForStyle,
  normalizeBasinToken,
  normalizeFaucetHoleToken,
  normalizeMaterialToken,
  parseThicknessValue,
  scopeCountertopRulesByBasinStyle,
  selectMaterialAliasTable,
} from "./parse";

export type CountertopRuleInput = {
  rules: CountertopMatrixRule[];
  activeMaterialTokens: string[];
  width: number | null;
  sinkBaseWidth?: number | null;
  totalWidth?: number | null;
  depth: number | null;
  activeCountertopStyle?: string | null;
  activeBasinStyle: string | null;
  activeThickness: string | null;
  /** Active collection: the reason texts come from its `messages`. */
  profile?: ProductProfile | null;
};

export type CountertopRuleResult = {
  matchingRules: CountertopMatrixRule[];
  allowedMaterials: Set<string>;
  allowedThicknesses: Set<number>;
  allowedBasinTokens: Set<string>;
  allowedBasinKeys: Set<string>;
  allowedFaucetHoles: Set<string>;
  allowedStyles: Set<string>;
  styleAvailability: Record<CountertopStyleKey, CountertopStyleAvailability>;
  vesselSinkAvailability: VesselSinkAvailability;
};

export type CountertopStyleKey = "integrated" | "vessel" | "undermount";

/** Why an option is unavailable: a stable code with its values, and the text for it. */
export type CountertopRuleReason = {
  reasonCode: string;
  reasonParams?: MessageParams;
  disabledReason: string;
};

export type CountertopStyleAvailability = {
  isAvailable: boolean;
  maxCompatibleWidthCm: number | null;
} & Partial<CountertopRuleReason>;

export type VesselSinkAvailability = {
  isAvailable: boolean;
  minSinkBaseWidthCm: number | null;
} & Partial<CountertopRuleReason>;

type ResolveDefaultThicknessInput = {
  rules: CountertopMatrixRule[];
  activeMaterialTokens: string[];
  depth: number | null;
  activeCountertopStyle?: string | null;
  width?: number | null;
  /** Active collection: its `ruleData.materialNormalization` decides which materials match. */
  profile?: ProductProfile | null;
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

const STYLE_WIDTH_EPSILON = 0.01;

export const REASON_COUNTERTOP_STYLE_UNAVAILABLE = "countertop.styleUnavailable";
export const REASON_COUNTERTOP_MAX_COMPATIBLE_WIDTH = "countertop.maxCompatibleWidth";
export const REASON_COUNTERTOP_TOTAL_WIDTH_ABOVE_MAX = "countertop.totalWidthAboveMax";
export const REASON_COUNTERTOP_SINK_BASE_BELOW_MIN = "countertop.sinkBaseBelowMin";
export const REASON_COUNTERTOP_SINK_BASE_WIDTH_NOT_ALLOWED = "countertop.sinkBaseWidthNotAllowed";
export const REASON_COUNTERTOP_VESSEL_SINK_BASE_MIN = "countertop.vesselSinkBaseMin";
export const REASON_COUNTERTOP_MATERIAL_NOT_AVAILABLE_FOR_SELECTION = "countertop.materialNotAvailableForSelection";

/**
 * Builds a reason from its code. The text comes from the collection's `messages`; the
 * English one is the legacy fallback for a collection that has none.
 */
const ruleReason = (
  profile: ProductProfile | null | undefined,
  reasonCode: string,
  legacyText: string,
  reasonParams?: MessageParams,
): CountertopRuleReason => ({
  reasonCode,
  ...(reasonParams ? { reasonParams } : {}),
  disabledReason: selectMessageOr(profile ?? null, reasonCode, legacyText, reasonParams),
});

const styleUnavailableReason = (profile: ProductProfile | null | undefined) =>
  ruleReason(
    profile,
    REASON_COUNTERTOP_STYLE_UNAVAILABLE,
    "Not available for selected cabinet width/depth/thickness on scene",
  );

const maxCompatibleWidthReason = (profile: ProductProfile | null | undefined, maxWidth: number) =>
  ruleReason(
    profile,
    REASON_COUNTERTOP_MAX_COMPATIBLE_WIDTH,
    `Not available for current configuration width, maximum compatibility size ${maxWidth} cm (${cmToInches(maxWidth)}").`,
    { maxCm: maxWidth, maxIn: cmToInches(maxWidth) },
  );

const sinkBaseBelowMinReason = (profile: ProductProfile | null | undefined, currentWidth: number, minWidth: number) =>
  ruleReason(
    profile,
    REASON_COUNTERTOP_SINK_BASE_BELOW_MIN,
    `Not available for current sink base width. Current ${currentWidth} cm (${cmToInches(currentWidth)}"), minimum ${minWidth} cm (${cmToInches(minWidth)}").`,
    { currentCm: currentWidth, currentIn: cmToInches(currentWidth), minCm: minWidth, minIn: cmToInches(minWidth) },
  );

const sinkBaseWidthNotAllowedReason = (profile: ProductProfile | null | undefined, allowedWidths: number[]) => {
  const formattedAllowedWidths = allowedWidths.map((value) => `${value} cm (${cmToInches(value)}")`).join(", ");
  return ruleReason(
    profile,
    REASON_COUNTERTOP_SINK_BASE_WIDTH_NOT_ALLOWED,
    `Not available for current sink base width. Allowed widths: ${formattedAllowedWidths}.`,
    { allowedWidths: formattedAllowedWidths },
  );
};

const vesselSinkBaseMinReason = (profile: ProductProfile | null | undefined, minWidth: number) =>
  ruleReason(
    profile,
    REASON_COUNTERTOP_VESSEL_SINK_BASE_MIN,
    `Not available for selected sink base cabinet width. Minimum width required ${minWidth}cm (${cmToInches(minWidth)}")`,
    { minCm: minWidth, minIn: cmToInches(minWidth) },
  );

const totalWidthAboveMaxReason = (profile: ProductProfile | null | undefined, currentWidth: number, maxWidth: number) =>
  ruleReason(
    profile,
    REASON_COUNTERTOP_TOTAL_WIDTH_ABOVE_MAX,
    `Not available for current total cabinets width on scene. Current ${currentWidth} cm (${cmToInches(currentWidth)}"), max ${maxWidth} cm (${cmToInches(maxWidth)}").`,
    { currentCm: currentWidth, currentIn: cmToInches(currentWidth), maxCm: maxWidth, maxIn: cmToInches(maxWidth) },
  );

/**
 * Why an integrated basin is unavailable for the current composition, checked in the order
 * the countertop step shows it: total width over the basin's maximum, sink base under its
 * minimum, sink base outside the exact sizes, and otherwise the selection as a whole.
 */
export const resolveIntegratedBasinUnavailableReason = ({
  basinRules,
  sinkBaseWidth,
  totalWidth,
  profile,
}: {
  basinRules: CountertopMatrixRule[];
  sinkBaseWidth: number | null;
  totalWidth: number | null;
  profile: ProductProfile | null;
}): CountertopRuleReason => {
  const maxIntegrated = basinRules.map((rule) => rule.maxIntegratedCm).filter((value): value is number => value !== null);
  if (typeof totalWidth === "number" && maxIntegrated.length > 0) {
    const maxAllowed = Math.max(...maxIntegrated);
    if (totalWidth > maxAllowed + STYLE_WIDTH_EPSILON) return totalWidthAboveMaxReason(profile, totalWidth, maxAllowed);
  }

  const minSinkBase = basinRules.map((rule) => rule.minSbCm).filter((value): value is number => value !== null);
  if (typeof sinkBaseWidth === "number" && minSinkBase.length > 0) {
    const minAllowed = Math.min(...minSinkBase);
    if (sinkBaseWidth + STYLE_WIDTH_EPSILON < minAllowed) return sinkBaseBelowMinReason(profile, sinkBaseWidth, minAllowed);
  }

  const allowedSinkBaseWidths = Array.from(new Set(basinRules.flatMap((rule) => rule.integratedAllowedSizesOnly))).sort(
    (left, right) => left - right,
  );
  if (
    typeof sinkBaseWidth === "number" &&
    allowedSinkBaseWidths.length > 0 &&
    !allowedSinkBaseWidths.some((value) => Math.abs(value - sinkBaseWidth) < STYLE_WIDTH_EPSILON)
  ) {
    return sinkBaseWidthNotAllowedReason(profile, allowedSinkBaseWidths);
  }

  return ruleReason(
    profile,
    REASON_COUNTERTOP_MATERIAL_NOT_AVAILABLE_FOR_SELECTION,
    "Not available for selected cabinet width/depth/thickness on scene",
  );
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

export const isRuleWidthEligibleForVesselSinkContext = (
  rule: CountertopMatrixRule,
  sinkBaseWidth: number | null,
): boolean => {
  if (sinkBaseWidth === null || rule.minVesselCm === null) return true;
  return sinkBaseWidth + STYLE_WIDTH_EPSILON >= rule.minVesselCm;
};

const resolveCountertopStyleKey = (style?: string | null): CountertopStyleKey | null => {
  const normalized = style?.trim().toLowerCase();
  if (normalized === "integrated" || normalized === "vessel" || normalized === "undermount") return normalized;
  return null;
};

const getRuleMaxWidthForStyle = (rule: CountertopMatrixRule, style: CountertopStyleKey): number | null => {
  if (style === "vessel") return rule.maxVesselCm;
  if (style === "undermount") return rule.maxUndermountCm;
  return rule.maxIntegratedCm;
};

const isRuleWidthEligibleForCountertopStyleContext = (
  rule: CountertopMatrixRule,
  style: CountertopStyleKey,
  context: IntegratedWidthContext,
): boolean => {
  if (style === "integrated") return isRuleWidthEligibleForIntegratedContext(rule, context);

  const { totalWidth } = resolveIntegratedWidthContext(context);
  const maxWidth = getRuleMaxWidthForStyle(rule, style);
  return maxWidth !== null && (totalWidth === null || totalWidth <= maxWidth + STYLE_WIDTH_EPSILON);
};

/** Returns first valid thickness (as string) for current material/depth matrix context. */
export const resolveDefaultThicknessFromRules = ({
  rules,
  activeMaterialTokens,
  depth,
  activeCountertopStyle,
  width = null,
  profile,
}: ResolveDefaultThicknessInput): string | null => {
  const aliasTable = selectMaterialAliasTable(profile ?? null);
  const matchingRules = rules.filter((rule) => {
    if (!matchesDepthForStyle(rule, depth, activeCountertopStyle)) return false;
    if (!activeMaterialTokens.length) return true;
    return activeMaterialTokens.some((material) => materialMatchesRule(material, rule.material, aliasTable));
  });

  const activeStyle = resolveCountertopStyleKey(activeCountertopStyle);
  const rulesForThickness = matchingRules.filter((rule) =>
    activeStyle
      ? isRuleWidthEligibleForCountertopStyleContext(rule, activeStyle, width)
      : isRuleWidthEligibleForIntegratedContext(rule, width),
  );

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
  activeCountertopStyle,
  activeBasinStyle,
  activeThickness,
  profile,
}: CountertopRuleInput): CountertopRuleResult => {
  const allowedMaterials = new Set<string>();
  const allowedThicknesses = new Set<number>();
  const allowedBasinTokens = new Set<string>();
  const allowedBasinKeys = new Set<string>();
  const allowedFaucetHoles = new Set<string>();
  const allowedStyles = new Set<string>();
  const styleAvailability: Record<CountertopStyleKey, CountertopStyleAvailability> = {
    integrated: { isAvailable: false, maxCompatibleWidthCm: null, ...styleUnavailableReason(profile) },
    vessel: { isAvailable: false, maxCompatibleWidthCm: null, ...styleUnavailableReason(profile) },
    undermount: { isAvailable: false, maxCompatibleWidthCm: null, ...styleUnavailableReason(profile) },
  };
  let vesselSinkAvailability: VesselSinkAvailability = {
    isAvailable: true,
    minSinkBaseWidthCm: null,
  };
  const activeThicknessValue = activeThickness ? parseThicknessValue(activeThickness) : null;
  const aliasTable = selectMaterialAliasTable(profile ?? null);
  const integratedWidthContext = {
    sinkBaseWidth: sinkBaseWidth ?? width,
    totalWidth: totalWidth ?? width,
  };
  const styleWidth = totalWidth ?? width;
  const activeStyle = activeCountertopStyle?.trim().toLowerCase() ?? null;
  const activeStyleKey = resolveCountertopStyleKey(activeCountertopStyle);

  if (!rules.length) {
    return {
      matchingRules: [],
      allowedMaterials,
      allowedThicknesses,
      allowedBasinTokens,
      allowedBasinKeys,
      allowedFaucetHoles,
      allowedStyles,
      styleAvailability,
      vesselSinkAvailability,
    };
  }

  rules.forEach((rule) => {
    if (!matchesDepthForStyle(rule, depth, activeStyle)) return;
    allowedMaterials.add(normalizeMaterialToken(rule.material));
  });

  const getMatchingRulesForStyle = (style: string | null) =>
    rules.filter((rule) => {
      if (!matchesDepthForStyle(rule, depth, style)) return false;
      if (!activeMaterialTokens.length) return true;
      return activeMaterialTokens.some((material) => materialMatchesRule(material, rule.material, aliasTable));
    });

  const matchesActiveThickness = (rule: CountertopMatrixRule): boolean => {
    if (activeThicknessValue === null) return true;
    const parsedThicknesses = rule.topThicknesses
      .map((value) => parseThicknessValue(value))
      .filter((value): value is number => value !== null);

    return parsedThicknesses.some((value) => Math.abs(value - activeThicknessValue) < 0.001);
  };

  const matchingRules = getMatchingRulesForStyle(activeStyle);

  const getThicknessScopedRulesForStyle = (style: CountertopStyleKey) =>
    getMatchingRulesForStyle(style).filter((rule) => matchesActiveThickness(rule));

  matchingRules
    .filter((rule) =>
      activeStyleKey
        ? isRuleWidthEligibleForCountertopStyleContext(rule, activeStyleKey, integratedWidthContext)
        : isRuleWidthEligibleForIntegratedContext(rule, integratedWidthContext),
    )
    .forEach((rule) => {
      rule.topThicknesses.forEach((value) => {
        const parsed = parseThicknessValue(value);
        if (parsed !== null) allowedThicknesses.add(parsed);
      });
    });

  const isWidthValid = (maxValue: number | null) => maxValue !== null && (styleWidth === null || styleWidth <= maxValue);

  matchingRules.forEach((rule) => {
    if (!matchesActiveThickness(rule)) return;
    if (!isRuleWidthEligibleForIntegratedContext(rule, integratedWidthContext)) return;

    allowedBasinTokens.add(normalizeBasinToken(rule.basinStyle));
    allowedBasinKeys.add(normalizeBasinKey(rule.basinStyle));
  });

  // Countertop-style constraints (Vessel / Undermount) should not depend on basin rules.
  getThicknessScopedRulesForStyle("vessel").forEach((rule) => {
    if (isWidthValid(rule.maxVesselCm)) {
      allowedStyles.add("vessel");
    }
  });

  getThicknessScopedRulesForStyle("undermount").forEach((rule) => {
    if (isWidthValid(rule.maxUndermountCm)) {
      allowedStyles.add("undermount");
    }
  });

  // Integrated rules are basin-driven.
  getThicknessScopedRulesForStyle("integrated").forEach((rule) => {
    if (!isRuleWidthEligibleForIntegratedContext(rule, integratedWidthContext)) return;
    allowedStyles.add("integrated");
  });

  const thicknessScopedRules = matchingRules.filter((rule) => matchesActiveThickness(rule));

  const buildStyleAvailabilityState = (style: CountertopStyleKey): CountertopStyleAvailability => {
    const styleThicknessScopedRules = getThicknessScopedRulesForStyle(style);
    if (!styleThicknessScopedRules.length) {
      return { isAvailable: false, maxCompatibleWidthCm: null, ...styleUnavailableReason(profile) };
    }

    if (style === "integrated") {
      const integratedRules = styleThicknessScopedRules.filter(
        (rule) => rule.maxIntegratedCm !== null || rule.minSbCm !== null || rule.integratedAllowedSizesOnly.length > 0,
      );
      if (!integratedRules.length) {
        return { isAvailable: false, maxCompatibleWidthCm: null, ...styleUnavailableReason(profile) };
      }

      // Reachable rules = those whose sink-base preconditions (minSbCm, integratedAllowedSizesOnly)
      // are satisfied by the current setup. maxCompatibleWidthCm and width-eligibility
      // must be computed on the same subset, otherwise an unreachable outlier with a
      // higher max_integrated_cm inflates the displayed max and/or bypasses the guard.
      const currentSinkBaseWidthValue = integratedWidthContext.sinkBaseWidth;
      const isRuleSinkBaseReachable = (rule: CountertopMatrixRule): boolean => {
        if (typeof currentSinkBaseWidthValue !== "number") return true;
        if (rule.minSbCm !== null && currentSinkBaseWidthValue + STYLE_WIDTH_EPSILON < rule.minSbCm) return false;
        if (
          rule.integratedAllowedSizesOnly.length > 0 &&
          !rule.integratedAllowedSizesOnly.some(
            (value) => Math.abs(value - currentSinkBaseWidthValue) < STYLE_WIDTH_EPSILON,
          )
        ) {
          return false;
        }
        return true;
      };

      const sinkBaseReachableIntegratedRules = integratedRules.filter(isRuleSinkBaseReachable);

      const maxCompatibleWidthCm = (
        sinkBaseReachableIntegratedRules.length > 0 ? sinkBaseReachableIntegratedRules : integratedRules
      )
        .map((rule) => rule.maxIntegratedCm)
        .filter((value): value is number => value !== null)
        .reduce<number | null>((currentMax, value) => (currentMax === null || value > currentMax ? value : currentMax), null);

      // Global integrated-max invariant evaluated against the reachable subset only.
      // Per-rule eligibility skips the max check when a rule omits max_integrated_cm,
      // so without this guard a permissive reachable rule would mark Integrated available
      // beyond the cap (e.g. user in Vessel at 260cm vs max_integrated_cm=251).
      const exceedsKnownIntegratedMaxWidth =
        typeof integratedWidthContext.totalWidth === "number" &&
        maxCompatibleWidthCm !== null &&
        integratedWidthContext.totalWidth > maxCompatibleWidthCm + STYLE_WIDTH_EPSILON;

      if (
        !exceedsKnownIntegratedMaxWidth &&
        sinkBaseReachableIntegratedRules.some((rule) =>
          isRuleWidthEligibleForIntegratedContext(rule, integratedWidthContext),
        )
      ) {
        return { isAvailable: true, maxCompatibleWidthCm };
      }

      if (exceedsKnownIntegratedMaxWidth) {
        return {
          isAvailable: false,
          maxCompatibleWidthCm,
          ...maxCompatibleWidthReason(profile, maxCompatibleWidthCm),
        };
      }

      const minSinkBaseWidth = integratedRules
        .map((rule) => rule.minSbCm)
        .filter((value): value is number => value !== null)
        .reduce<number | null>((currentMin, value) => (currentMin === null || value < currentMin ? value : currentMin), null);

      if (
        typeof integratedWidthContext.sinkBaseWidth === "number" &&
        minSinkBaseWidth !== null &&
        integratedWidthContext.sinkBaseWidth + STYLE_WIDTH_EPSILON < minSinkBaseWidth
      ) {
        return {
          isAvailable: false,
          maxCompatibleWidthCm,
          ...sinkBaseBelowMinReason(profile, integratedWidthContext.sinkBaseWidth, minSinkBaseWidth),
        };
      }

      const allowedSinkBaseWidths = Array.from(
        new Set(integratedRules.flatMap((rule) => rule.integratedAllowedSizesOnly)),
      ).sort((left, right) => left - right);
      const currentSinkBaseWidth = integratedWidthContext.sinkBaseWidth;

      if (
        typeof currentSinkBaseWidth === "number" &&
        allowedSinkBaseWidths.length > 0 &&
        !allowedSinkBaseWidths.some((value) => Math.abs(value - currentSinkBaseWidth) < STYLE_WIDTH_EPSILON)
      ) {
        return {
          isAvailable: false,
          maxCompatibleWidthCm,
          ...sinkBaseWidthNotAllowedReason(profile, allowedSinkBaseWidths),
        };
      }

      return { isAvailable: false, maxCompatibleWidthCm, ...styleUnavailableReason(profile) };
    }

    const maxCompatibleWidthCm = styleThicknessScopedRules
      .map((rule) => (style === "vessel" ? rule.maxVesselCm : rule.maxUndermountCm))
      .filter((value): value is number => value !== null)
      .reduce<number | null>((currentMax, value) => (currentMax === null || value > currentMax ? value : currentMax), null);

    if (maxCompatibleWidthCm === null) {
      return { isAvailable: false, maxCompatibleWidthCm: null, ...styleUnavailableReason(profile) };
    }

    if (styleWidth === null || styleWidth <= maxCompatibleWidthCm + STYLE_WIDTH_EPSILON) {
      return { isAvailable: true, maxCompatibleWidthCm };
    }

    return {
      isAvailable: false,
      maxCompatibleWidthCm,
      ...maxCompatibleWidthReason(profile, maxCompatibleWidthCm),
    };
  };

  styleAvailability.integrated = buildStyleAvailabilityState("integrated");
  styleAvailability.vessel = buildStyleAvailabilityState("vessel");
  styleAvailability.undermount = buildStyleAvailabilityState("undermount");

  const vesselSinkRules = getThicknessScopedRulesForStyle("vessel").filter((rule) =>
    matchesDepthForStyle(rule, depth, "vessel"),
  );
  const vesselSinkMinWidth = vesselSinkRules
    .map((rule) => rule.minVesselCm)
    .filter((value): value is number => value !== null)
    .reduce<number | null>((currentMin, value) => (currentMin === null || value < currentMin ? value : currentMin), null);
  const currentSinkBaseWidth = integratedWidthContext.sinkBaseWidth;

  if (
    typeof currentSinkBaseWidth === "number" &&
    vesselSinkMinWidth !== null &&
    !vesselSinkRules.some((rule) => isRuleWidthEligibleForVesselSinkContext(rule, currentSinkBaseWidth))
  ) {
    vesselSinkAvailability = {
      isAvailable: false,
      minSinkBaseWidthCm: vesselSinkMinWidth,
      ...vesselSinkBaseMinReason(profile, vesselSinkMinWidth),
    };
  } else {
    vesselSinkAvailability = {
      isAvailable: true,
      minSinkBaseWidthCm: vesselSinkMinWidth,
    };
  }

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
    styleAvailability,
    vesselSinkAvailability,
  };
};
