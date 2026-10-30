import {
  extractCountertopBasinMaterialScopeTokens,
  getMaterialAliases,
  isRuleWidthEligibleForIntegratedContext,
  isVisibleVesselSinkStyle,
  normalizeBasinKey,
  parseThicknessValue,
} from "@/features/configurator-rule-core/countertop";
import { cmToInches } from "@/shared/lib/sku";

import { VESSEL_SINK_NONE_OPTION } from "./countertopColorOptions";

import type { CountertopContext } from "./useCountertopContext";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

type MatrixRule = CountertopContext["countertopRules"][number];

export type IntegratedWidthContext = { sinkBaseWidth: number | null; totalWidth: number | null };

export const matchesThickness = (thicknesses: string[], activeThickness: number | null) =>
  activeThickness === null ||
  thicknesses
    .map((value) => parseThicknessValue(value))
    .filter((value): value is number => value !== null)
    .some((value) => Math.abs(value - activeThickness) < 0.001);

/** The vessels the profile shows, all disabled with one reason while the rules refuse a vessel. */
export const resolveVesselBasinOptions = (
  catalog: ProductOptionData[],
  context: Pick<CountertopContext, "activeProfile" | "ruleState">,
): ProductOptionData[] => {
  const { allowedStyles, vesselSinkAvailability } = context.ruleState;
  if (allowedStyles.size && !allowedStyles.has("vessel")) return [];

  const vessels = catalog
    .filter((option) => isVisibleVesselSinkStyle(option.name ?? "", context.activeProfile))
    .map((option) =>
      vesselSinkAvailability.isAvailable
        ? option
        : { ...option, isAvailable: false, disabledReason: vesselSinkAvailability.disabledReason },
    );
  return [VESSEL_SINK_NONE_OPTION, ...vessels];
};

const integratedDisabledReason = (
  basinRules: MatrixRule[],
  { sinkBaseWidth, totalWidth }: IntegratedWidthContext,
  fallback: string,
): string => {
  const maxIntegrated = basinRules.map((rule) => rule.maxIntegratedCm).filter((v): v is number => v !== null);
  if (typeof totalWidth === "number" && maxIntegrated.length && totalWidth > Math.max(...maxIntegrated) + 0.01) {
    const max = Math.max(...maxIntegrated);
    return `Not available for current total cabinets width on scene. Current ${totalWidth} cm (${cmToInches(totalWidth)}"), max ${max} cm (${cmToInches(max)}").`;
  }
  const minSinkBase = basinRules.map((rule) => rule.minSbCm).filter((v): v is number => v !== null);
  if (typeof sinkBaseWidth === "number" && minSinkBase.length && sinkBaseWidth + 0.01 < Math.min(...minSinkBase)) {
    const min = Math.min(...minSinkBase);
    return `Not available for current sink base width. Current ${sinkBaseWidth} cm (${cmToInches(sinkBaseWidth)}"), minimum ${min} cm (${cmToInches(min)}").`;
  }
  const allowedWidths = [...new Set(basinRules.flatMap((rule) => rule.integratedAllowedSizesOnly))].sort(
    (a, b) => a - b,
  );
  if (
    typeof sinkBaseWidth === "number" &&
    allowedWidths.length &&
    !allowedWidths.some((value) => Math.abs(value - sinkBaseWidth) < 0.01)
  ) {
    const widths = allowedWidths.map((v) => `${v} cm (${cmToInches(v)}")`).join(", ");
    return `Not available for current sink base width. Allowed widths: ${widths}.`;
  }
  return fallback;
};

type IntegratedBasinArgs = {
  catalog: ProductOptionData[];
  integratedNames: ReadonlySet<string>;
  matchingRules: MatrixRule[];
  allowedMaterials: ReadonlySet<string>;
  activeMaterials: string[];
  activeThickness: number | null;
  widthContext: IntegratedWidthContext;
  fallbackReason: string;
};

/** Integrated basins of the chosen material, each judged by the sink base and total widths. */
export const resolveIntegratedBasinOptions = ({
  catalog,
  integratedNames,
  matchingRules,
  allowedMaterials,
  activeMaterials,
  activeThickness,
  widthContext,
  fallbackReason,
}: IntegratedBasinArgs): ProductOptionData[] => {
  const applicableRules = matchingRules.filter((rule) => matchesThickness(rule.topThicknesses, activeThickness));

  return catalog.flatMap((option) => {
    if (!integratedNames.has(option.name ?? "")) return [];
    const label = option.title ?? option.name ?? "";
    if (!label) return [];

    const [, ...restTokens] = label.trim().split(/\s+/);
    const materialTokens = extractCountertopBasinMaterialScopeTokens(label, option.name);
    const aliasesOf = (token: string) => getMaterialAliases(token);
    const isMaterialSpecific = materialTokens.some((token) =>
      aliasesOf(token).some((alias) => allowedMaterials.has(alias)),
    );
    if (
      isMaterialSpecific &&
      activeMaterials.length > 0 &&
      !materialTokens.some((token) => aliasesOf(token).some((alias) => activeMaterials.includes(alias)))
    ) {
      return [];
    }

    const labelKeys = new Set(
      (isMaterialSpecific ? [restTokens.join(" "), label] : [label]).map(normalizeBasinKey).filter(Boolean),
    );
    const basinRules = applicableRules.filter((rule) => labelKeys.has(normalizeBasinKey(rule.basinStyle)));
    if (!basinRules.length) return [];

    const isAvailable = basinRules.some((rule) => isRuleWidthEligibleForIntegratedContext(rule, widthContext));
    return [
      {
        ...option,
        isAvailable,
        disabledReason: isAvailable ? undefined : integratedDisabledReason(basinRules, widthContext, fallbackReason),
      },
    ];
  });
};
