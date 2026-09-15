import type { ProductProfile } from "@/entities/collection";
import { selectMessage, selectOptions, selectRuleData } from "@/entities/collection";

import type { FlutingRuleInput, FlutingRuleResult } from "../types";

export const REASON_FLUTING_NOT_IN_COLLECTION = "fluting.notInCollection";
export const REASON_FLUTING_PART_UNAVAILABLE = "fluting.sidePanelUnavailable";
export const REASON_FLUTING_MATERIAL_NOT_ELIGIBLE = "fluting.requiresLacquerMatte";

const unavailable = (profile: ProductProfile | null, reasonCode: string): FlutingRuleResult => ({
  available: false,
  options: [],
  reason: selectMessage(profile, reasonCode),
  reasonCode,
});

/**
 * Whether drawer panels take fluting.
 *
 * The eligible cabinet materials, the parts that never take fluting and the options come
 * from the active collection; a collection without `ruleData.fluting` does not offer it.
 */
export const flutingRule = (
  { targetPart, material }: FlutingRuleInput,
  profile: ProductProfile | null,
): FlutingRuleResult => {
  const params = selectRuleData(profile, "fluting");
  if (!params) return unavailable(profile, REASON_FLUTING_NOT_IN_COLLECTION);

  if (targetPart && params.forbiddenTargetParts.includes(targetPart)) {
    return unavailable(profile, REASON_FLUTING_PART_UNAVAILABLE);
  }

  const normalizedMaterial = material?.trim().toUpperCase();
  const isEligibleMaterial =
    Boolean(normalizedMaterial) &&
    params.eligibleMaterialAliases.some((alias) => alias.trim().toUpperCase() === normalizedMaterial);

  if (!isEligibleMaterial) return unavailable(profile, REASON_FLUTING_MATERIAL_NOT_ELIGIBLE);

  return {
    available: true,
    options: selectOptions(profile, "DrawerPanelFluting").map(({ value, label }) => ({ value, label, enabled: true })),
  };
};
