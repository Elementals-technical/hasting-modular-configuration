import type { MessageParams, ProductProfile } from "@/entities/collection";
import { selectMessage, selectOptions, selectRuleData } from "@/entities/collection";

import type { GrainDirectionRuleInput, GrainDirectionRuleResult } from "../types";

export const REASON_GRAIN_NOT_IN_COLLECTION = "grain.notInCollection";
export const REASON_GRAIN_REQUIRES_MATERIAL = "grain.requiresEligibleMaterial";
export const REASON_GRAIN_MATERIAL_NOT_ELIGIBLE = "grain.materialNotEligible";
export const REASON_GRAIN_FINISH_EXCLUDED = "grain.finishExcluded";

const unavailable = (
  profile: ProductProfile | null,
  reasonCode: string,
  params?: MessageParams,
): GrainDirectionRuleResult => ({
  available: false,
  options: [],
  reason: selectMessage(profile, reasonCode, params),
  reasonCode,
});

/** "Essenze, HPL, and 3D" — the list as the reason text has always named it. */
const formatList = (values: readonly string[]): string =>
  values.length <= 2 ? values.join(" and ") : `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;

/**
 * Whether the cabinet finish takes a grain direction.
 *
 * The eligible materials and the finishes excluded inside them come from the active
 * collection; a collection without `ruleData.grainDirection` does not offer it.
 */
export const grainDirectionRule = (
  { material, finish }: GrainDirectionRuleInput,
  profile: ProductProfile | null,
): GrainDirectionRuleResult => {
  const params = selectRuleData(profile, "grainDirection");
  if (!params) return unavailable(profile, REASON_GRAIN_NOT_IN_COLLECTION);

  const materials = formatList(params.eligibleMaterials);
  const normalizedMaterial = material?.trim();

  if (!normalizedMaterial) return unavailable(profile, REASON_GRAIN_REQUIRES_MATERIAL, { materials });

  if (!params.eligibleMaterials.includes(normalizedMaterial)) {
    return unavailable(profile, REASON_GRAIN_MATERIAL_NOT_ELIGIBLE, { materials });
  }

  const excludedFinishes = params.excludedFinishesByMaterial[normalizedMaterial] ?? [];
  const normalizedFinish = finish?.trim();

  if (normalizedFinish && excludedFinishes.includes(normalizedFinish)) {
    return unavailable(profile, REASON_GRAIN_FINISH_EXCLUDED, {
      material: normalizedMaterial,
      finishes: params.excludedFinishLabelsByMaterial?.[normalizedMaterial] ?? excludedFinishes.join(", "),
    });
  }

  return {
    available: true,
    options: selectOptions(profile, "GrainDirection").map(({ value, label }) => ({ value, label, enabled: true })),
  };
};
