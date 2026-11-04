import {
  extractCountertopBasinMaterialScopeTokens,
  getMaterialAliases,
  isRuleWidthEligibleForIntegratedContext,
  isVisibleVesselSinkStyle,
  normalizeBasinKey,
  parseThicknessValue,
  REASON_COUNTERTOP_VESSEL_SINK_BASE_MIN,
  resolveIntegratedWidthRefusal,
} from "@/features/configurator-rule-core/countertop";

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

/**
 * The vessels the profile shows, all disabled with one reason while the rules refuse a vessel. None is shown
 * while the vessel style is refused for anything but the Sink Base minimum, which only disables them.
 */
export const resolveVesselBasinOptions = (
  catalog: ProductOptionData[],
  context: Pick<CountertopContext, "activeProfile" | "ruleState">,
): ProductOptionData[] => {
  const { styleAvailability, vesselSinkAvailability } = context.ruleState;
  const vesselStyle = styleAvailability.vessel;
  if (!vesselStyle.isAvailable && vesselStyle.reasonCode !== REASON_COUNTERTOP_VESSEL_SINK_BASE_MIN) return [];

  const vessels = catalog
    .filter((option) => isVisibleVesselSinkStyle(option.name ?? "", context.activeProfile))
    .map((option) =>
      vesselSinkAvailability.isAvailable
        ? option
        : { ...option, isAvailable: false, disabledReason: vesselSinkAvailability.disabledReason },
    );
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
  fallbackReason: string;
  profile: CountertopContext["activeProfile"];
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
    const refusal = isAvailable ? null : resolveIntegratedWidthRefusal({ basinRules, ...widthContext, profile });
    return [
      {
        ...option,
        isAvailable,
        disabledReason: isAvailable ? undefined : (refusal?.disabledReason ?? fallbackReason),
        // A tile words a reason by its code: without one it says the option is unavailable and no more.
        disabledReasonCode: refusal?.reasonCode,
        disabledReasonParams: refusal?.reasonParams,
      },
    ];
  });
};
