import type { ProductProfile } from "@/entities/collection";
import { selectMessageOr, selectOptionValues } from "@/entities/collection";
import type { PresetProduct } from "@/entities/product/types";

import { resolveCountertopCabinetCompositionConstraint } from "./compositionConstraints";
import { evaluateCountertopMaterial } from "./materialAvailability";
import { materialMatchesRule, selectMaterialAliasTable, normalizeMaterialToken } from "./parse";
import { buildCountertopRuleState, resolveCountertopStyleKey } from "./rules";
import type { CountertopRuleResult, CountertopStyleKey } from "./rules";
import type { CountertopMatrixRule } from "./types";

type PrebuiltPresetDimensions = {
  sinkBaseWidth: number | null;
  sinkBaseDepth: number | null;
  totalWidth: number | null;
  cabinetCount: number;
};

export const REASON_MATERIAL_NOT_AVAILABLE_FOR_MODEL = "countertop.materialNotAvailableForModel";

export type PrebuiltModelCountertopCompatibilityInput = {
  rules: CountertopMatrixRule[];
  presetProducts: PresetProduct[];
  activeMaterialTokens: string[];
  activeCountertopStyle?: string | null;
  activeBasinStyle?: string | null;
  activeThickness?: string | null;
  profile: ProductProfile | null;
};

/**
 * What the new model refuses: the countertop material itself, or only the active countertop style (and the
 * basin that depends on it), while the material stays acceptable under another style.
 */
export type PrebuiltModelCountertopRefusal = "material" | "style";

type PrebuiltModelCountertopRefusalReason = {
  reason?: string;
  /** Stable code of `reason`; the text comes from the collection's `messages`. */
  reasonCode?: string;
};

export type PrebuiltModelCountertopCompatibilityResult =
  | { isCompatible: true }
  | ({ isCompatible: false; refusal: "material" } & PrebuiltModelCountertopRefusalReason)
  | ({
      isCompatible: false;
      refusal: "style";
      /** The active countertop style the model refused. */
      refusedStyle: CountertopStyleKey;
    } & PrebuiltModelCountertopRefusalReason);

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

/**
 * Whether the new model takes the countertop material under some style the collection offers. The active style's
 * own limits (a vessel's Sink Base minimum) refuse that style, not the material; the active thickness still
 * counts, as `styleAvailability` is scoped by it.
 */
const isMaterialAcceptedByModel = ({
  rules,
  activeMaterialTokens,
  dimensions,
  styleAvailability,
  profile,
}: {
  rules: CountertopMatrixRule[];
  activeMaterialTokens: string[];
  dimensions: PrebuiltPresetDimensions;
  styleAvailability: CountertopRuleResult["styleAvailability"];
  profile: ProductProfile | null;
}): boolean => {
  if (!activeMaterialTokens.length) return true;

  const offeredStyles = selectOptionValues(profile, "CountertopStyle")
    .map((value) => resolveCountertopStyleKey(value))
    .filter((style): style is CountertopStyleKey => style !== null);
  // A collection that offers no countertop style judges the material by the table alone, under no style.
  if (!offeredStyles.length) {
    return evaluateCountertopMaterial(activeMaterialTokens, {
      activeBasinStyle: null,
      activeCountertopStyle: null,
      activeProfile: profile,
      cabinetCompositionCount: dimensions.cabinetCount,
      countertopRules: rules,
      depth: dimensions.sinkBaseDepth,
      sinkBaseWidth: dimensions.sinkBaseWidth,
      totalWidth: dimensions.totalWidth,
    }).isCompatible;
  }

  const compositionConstraint = resolveCountertopCabinetCompositionConstraint({
    materialTokens: activeMaterialTokens,
    cabinetCount: dimensions.cabinetCount,
    profile,
  });
  if (!compositionConstraint.isWithinCabinetLimit) return false;

  const aliasTable = selectMaterialAliasTable(profile);
  const hasMaterialRules = rules.some((rule) =>
    activeMaterialTokens.some((material) => materialMatchesRule(material, rule.material, aliasTable)),
  );
  // A material the table has no row for is refused, except ceramic, which is accepted without one.
  if (!hasMaterialRules) return activeMaterialTokens.some((token) => normalizeMaterialToken(token) === "ceramic");

  return offeredStyles.some((style) => styleAvailability[style].isAvailable);
};

export const resolvePrebuiltModelCountertopCompatibility = ({
  rules,
  presetProducts,
  activeMaterialTokens,
  activeCountertopStyle,
  activeBasinStyle,
  activeThickness,
  profile,
}: PrebuiltModelCountertopCompatibilityInput): PrebuiltModelCountertopCompatibilityResult => {
  if (!rules.length || !presetProducts.length) return { isCompatible: true };
  if (!activeMaterialTokens.length && !activeCountertopStyle) return { isCompatible: true };

  const dimensions = resolvePresetDimensions(presetProducts);
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
    profile,
  });

  const isMaterialAccepted = isMaterialAcceptedByModel({
    rules,
    activeMaterialTokens,
    dimensions,
    styleAvailability: ruleState.styleAvailability,
    profile,
  });
  if (!isMaterialAccepted) {
    return {
      isCompatible: false,
      refusal: "material",
      reasonCode: REASON_MATERIAL_NOT_AVAILABLE_FOR_MODEL,
      reason: selectMessageOr(
        profile,
        REASON_MATERIAL_NOT_AVAILABLE_FOR_MODEL,
        "The selected countertop material/finish is not available for this model.",
      ),
    };
  }

  // The material stays; only the active style is refused, with the reason its tile gives.
  const styleKey = resolveCountertopStyleKey(activeCountertopStyle);
  if (styleKey && !ruleState.styleAvailability[styleKey].isAvailable) {
    return {
      isCompatible: false,
      refusal: "style",
      refusedStyle: styleKey,
      reasonCode: ruleState.styleAvailability[styleKey].reasonCode,
      reason: ruleState.styleAvailability[styleKey].disabledReason,
    };
  }

  return { isCompatible: true };
};
