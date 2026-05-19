import type { CountertopMatrixRule } from "./types";
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

export type CountertopStyleAvailability = {
  isAvailable: boolean;
  disabledReason?: string;
  maxCompatibleWidthCm: number | null;
};

export type VesselSinkAvailability = {
  isAvailable: boolean;
  disabledReason?: string;
  minSinkBaseWidthCm: number | null;
};

type ResolveDefaultThicknessInput = {
  rules: CountertopMatrixRule[];
  activeMaterialTokens: string[];
  depth: number | null;
  activeCountertopStyle?: string | null;
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

const STYLE_WIDTH_EPSILON = 0.01;
const DEFAULT_STYLE_DISABLED_REASON = "Not available for selected cabinet width/depth/thickness on scene";

const formatWidthCompatibilityDisabledReason = (maxWidth: number) =>
  `Not available for current configuration width, maximum compatibility size ${maxWidth} cm (${cmToInches(maxWidth)}").`;

const formatMinSinkBaseDisabledReason = (currentWidth: number, minWidth: number) =>
  `Not available for current sink base width. Current ${currentWidth} cm (${cmToInches(currentWidth)}"), minimum ${minWidth} cm (${cmToInches(minWidth)}").`;

const formatAllowedSinkBaseWidthsDisabledReason = (allowedWidths: number[]) => {
  const formattedAllowedWidths = allowedWidths.map((value) => `${value} cm (${cmToInches(value)}")`).join(", ");
  return `Not available for current sink base width. Allowed widths: ${formattedAllowedWidths}.`;
};

const formatVesselSinkMinWidthDisabledReason = (minWidth: number) =>
  `Not available for selected sink base cabinet width. Minimum width required ${minWidth}cm (${cmToInches(minWidth)}")`;

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
}: ResolveDefaultThicknessInput): string | null => {
  const matchingRules = rules.filter((rule) => {
    if (!matchesDepthForStyle(rule, depth, activeCountertopStyle)) return false;
    if (!activeMaterialTokens.length) return true;
    return activeMaterialTokens.some((material) => materialMatchesRule(material, rule.material));
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
}: CountertopRuleInput): CountertopRuleResult => {
  const allowedMaterials = new Set<string>();
  const allowedThicknesses = new Set<number>();
  const allowedBasinTokens = new Set<string>();
  const allowedBasinKeys = new Set<string>();
  const allowedFaucetHoles = new Set<string>();
  const allowedStyles = new Set<string>();
  const styleAvailability: Record<CountertopStyleKey, CountertopStyleAvailability> = {
    integrated: { isAvailable: false, maxCompatibleWidthCm: null, disabledReason: DEFAULT_STYLE_DISABLED_REASON },
    vessel: { isAvailable: false, maxCompatibleWidthCm: null, disabledReason: DEFAULT_STYLE_DISABLED_REASON },
    undermount: { isAvailable: false, maxCompatibleWidthCm: null, disabledReason: DEFAULT_STYLE_DISABLED_REASON },
  };
  let vesselSinkAvailability: VesselSinkAvailability = {
    isAvailable: true,
    minSinkBaseWidthCm: null,
  };
  const activeThicknessValue = activeThickness ? parseThicknessValue(activeThickness) : null;
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
      return activeMaterialTokens.some((material) => materialMatchesRule(material, rule.material));
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
      return { isAvailable: false, maxCompatibleWidthCm: null, disabledReason: DEFAULT_STYLE_DISABLED_REASON };
    }

    if (style === "integrated") {
      const integratedRules = styleThicknessScopedRules.filter(
        (rule) => rule.maxIntegratedCm !== null || rule.minSbCm !== null || rule.integratedAllowedSizesOnly.length > 0,
      );
      if (!integratedRules.length) {
        return { isAvailable: false, maxCompatibleWidthCm: null, disabledReason: DEFAULT_STYLE_DISABLED_REASON };
      }

      const maxCompatibleWidthCm = integratedRules
        .map((rule) => rule.maxIntegratedCm)
        .filter((value): value is number => value !== null)
        .reduce<number | null>((currentMax, value) => (currentMax === null || value > currentMax ? value : currentMax), null);

      if (integratedRules.some((rule) => isRuleWidthEligibleForIntegratedContext(rule, integratedWidthContext))) {
        return { isAvailable: true, maxCompatibleWidthCm };
      }

      if (
        typeof integratedWidthContext.totalWidth === "number" &&
        maxCompatibleWidthCm !== null &&
        integratedWidthContext.totalWidth > maxCompatibleWidthCm + STYLE_WIDTH_EPSILON
      ) {
        return {
          isAvailable: false,
          maxCompatibleWidthCm,
          disabledReason: formatWidthCompatibilityDisabledReason(maxCompatibleWidthCm),
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
          disabledReason: formatMinSinkBaseDisabledReason(integratedWidthContext.sinkBaseWidth, minSinkBaseWidth),
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
          disabledReason: formatAllowedSinkBaseWidthsDisabledReason(allowedSinkBaseWidths),
        };
      }

      return { isAvailable: false, maxCompatibleWidthCm, disabledReason: DEFAULT_STYLE_DISABLED_REASON };
    }

    const maxCompatibleWidthCm = styleThicknessScopedRules
      .map((rule) => (style === "vessel" ? rule.maxVesselCm : rule.maxUndermountCm))
      .filter((value): value is number => value !== null)
      .reduce<number | null>((currentMax, value) => (currentMax === null || value > currentMax ? value : currentMax), null);

    if (maxCompatibleWidthCm === null) {
      return { isAvailable: false, maxCompatibleWidthCm: null, disabledReason: DEFAULT_STYLE_DISABLED_REASON };
    }

    if (styleWidth === null || styleWidth <= maxCompatibleWidthCm + STYLE_WIDTH_EPSILON) {
      return { isAvailable: true, maxCompatibleWidthCm };
    }

    return {
      isAvailable: false,
      maxCompatibleWidthCm,
      disabledReason: formatWidthCompatibilityDisabledReason(maxCompatibleWidthCm),
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
      disabledReason: formatVesselSinkMinWidthDisabledReason(vesselSinkMinWidth),
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
