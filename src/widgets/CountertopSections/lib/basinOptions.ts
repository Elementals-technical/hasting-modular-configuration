import {
  extractCountertopBasinMaterialScopeTokens,
  getMaterialAliases,
  isColorCodeUnavailableForVesselStyle,
  isRuleWidthEligibleForIntegratedContext,
  isVisibleVesselSinkStyle,
  normalizeBasinKey,
  parseThicknessValue,
  REASON_COUNTERTOP_VESSEL_SINK_BASE_MIN,
  REASON_VESSEL_COUNTERTOP_COLOR_UNAVAILABLE,
  resolveIntegratedBasinUnavailableReason,
} from "@/features/configurator-rule-core/countertop";
import { extractColorCode } from "@/shared/lib/sku";

import { VESSEL_SINK_NONE_OPTION } from "./countertopColorOptions";

import type { CountertopContext } from "./useCountertopContext";
import type { ProductProfile } from "@/entities/collection";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

type MatrixRule = CountertopContext["countertopRules"][number];

export type IntegratedWidthContext = { sinkBaseWidth: number | null; totalWidth: number | null };

export const matchesThickness = (thicknesses: string[], activeThickness: number | null) =>
  activeThickness === null ||
  thicknesses
    .map((value) => parseThicknessValue(value))
    .filter((value): value is number => value !== null)
    .some((value) => Math.abs(value - activeThickness) < 0.001);

/**
 * The vessels the profile shows, all disabled with one reason while the rules refuse a vessel. None is shown
 * while the vessel style is refused for anything but the Sink Base minimum, which only disables them. While
 * the Sink Base takes a vessel, one that cannot stand on the countertop's colour (its
 * `unavailableColorCodesByStyle`) is disabled for that colour; None stays enabled.
 */
export const resolveVesselBasinOptions = (
  catalog: ProductOptionData[],
  context: Pick<
    CountertopContext,
    "activeCountertopColor" | "activeMaterialTokens" | "activeProfile" | "messages" | "ruleState"
  >,
): ProductOptionData[] => {
  const { styleAvailability, vesselSinkAvailability } = context.ruleState;
  const vesselStyle = styleAvailability.vessel;
  if (!vesselStyle.isAvailable && vesselStyle.reasonCode !== REASON_COUNTERTOP_VESSEL_SINK_BASE_MIN) return [];

  const countertopColorCode = extractColorCode(context.activeCountertopColor);
  const isRefusedByCountertopColor = (option: ProductOptionData) =>
    isColorCodeUnavailableForVesselStyle({
      vesselStyle: option.name,
      materialTokens: context.activeMaterialTokens,
      colorCode: countertopColorCode,
      profile: context.activeProfile,
    });

  const vessels = catalog
    .filter((option) => isVisibleVesselSinkStyle(option.name ?? "", context.activeProfile))
    .map((option) => {
      if (!vesselSinkAvailability.isAvailable) {
        return {
          ...option,
          isAvailable: false,
          disabledReason: vesselSinkAvailability.disabledReason,
          disabledReasonCode: vesselSinkAvailability.reasonCode,
          disabledReasonParams: vesselSinkAvailability.reasonParams,
        };
      }
      // The code names the reason the grid shows; the profile's text is its fallback.
      return isRefusedByCountertopColor(option)
        ? {
            ...option,
            isAvailable: false,
            disabledReason: context.messages.vesselCountertopColorUnavailable,
            disabledReasonCode: REASON_VESSEL_COUNTERTOP_COLOR_UNAVAILABLE,
          }
        : option;
    });
  return [VESSEL_SINK_NONE_OPTION, ...vessels];
};

type IntegratedBasinArgs = {
  catalog: ProductOptionData[];
  integratedNames: ReadonlySet<string>;
  matchingRules: MatrixRule[];
  allowedMaterials: ReadonlySet<string>;
  activeMaterials: string[];
  activeThickness: number | null;
  widthContext: IntegratedWidthContext;
  profile: ProductProfile | null;
};

/**
 * Integrated basins of the chosen material, each judged by the sink base and total widths. A refused one carries the
 * rule core's reason code for the width it fails, or the selection's when no single width explains it.
 */
export const resolveIntegratedBasinOptions = ({
  catalog,
  integratedNames,
  matchingRules,
  allowedMaterials,
  activeMaterials,
  activeThickness,
  widthContext,
  profile,
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
    const reason = isAvailable
      ? null
      : resolveIntegratedBasinUnavailableReason({ basinRules, ...widthContext, profile });
    return [
      {
        ...option,
        isAvailable,
        disabledReason: reason?.disabledReason,
        disabledReasonCode: reason?.reasonCode,
        disabledReasonParams: reason?.reasonParams,
      },
    ];
  });
};
