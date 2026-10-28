import type { RootState } from "@/app/store";
import { selectMessage, selectResetValue, selectRuleData, type ProductProfile } from "@/entities/collection";
import { getActiveRuntimeBindings, getAttributeValue, isSameTarget, type ValueTarget } from "@/entities/configuration";
import { findUndeterminedRule } from "@/entities/product/model/store/undeterminedRules";

import { isBroadcastCabinetValue } from "./commitChange";
import type { AttributeChange, ChangeBlockedReason, PlannedChange } from "../model/types";

/**
 * CONTRACTS §8: a change the product has no rule for yet is neither allowed nor forbidden. It is
 * blocked with `product.missingData` before anything is planned, so state and scene stay as
 * they were. The cases come from `ruleData.undeterminedRules`, not from code.
 */

export const REASON_MISSING_PRODUCT_DATA = "product.missingData";

const asText = (value: AttributeChange["value"]): string => (value === null || value === undefined ? "" : String(value));

export const checkUndetermined = (
  change: AttributeChange,
  target: ValueTarget,
  state: RootState,
  profile: ProductProfile,
): ChangeBlockedReason | null => {
  const rule = findUndeterminedRule(state, profile, change.attributeId, asText(change.value), target);
  if (!rule) return null;

  return {
    attributeId: change.attributeId,
    reasonCode: REASON_MISSING_PRODUCT_DATA,
    reason: selectMessage(profile, REASON_MISSING_PRODUCT_DATA, { ruleId: rule.ruleId }),
    compatibility: "undetermined",
  };
};

/**
 * Values a planned set leaves undetermined at a cabinet, cleared in the same set: a cabinet the set
 * makes a one-drawer Mako cabinet loses its leg colour (MAKO-LEG-002), which the command would not
 * let it take, so its state, its scene and its price all stand without legs. A value the scene gives
 * every cabinet at once is cleared once, and the command records that at each.
 */
export const planUndeterminedResets = (
  plan: readonly PlannedChange[],
  state: RootState,
  profile: ProductProfile,
): PlannedChange[] => {
  const rules = selectRuleData(profile, "undeterminedRules") ?? [];
  const bindings = getActiveRuntimeBindings(state);
  const resets: PlannedChange[] = [];

  for (const { attributeId: changedId, target, value } of plan) {
    if (target.scope !== "cabinet") continue;

    const planned = { [changedId]: asText(value) };
    const dependentIds = new Set(
      rules.filter(({ whenCabinet }) => whenCabinet && Object.hasOwn(whenCabinet, changedId)).map((r) => r.attributeId),
    );

    for (const attributeId of dependentIds) {
      const held = asText(getAttributeValue(state, attributeId, target) ?? null);
      if (!held || !findUndeterminedRule(state, profile, attributeId, held, target, planned)) continue;

      const isBroadcast = isBroadcastCabinetValue(profile, bindings, attributeId);
      const isPlanned = resets.some(
        (reset) => reset.attributeId === attributeId && (isBroadcast || isSameTarget(reset.target, target)),
      );
      if (isPlanned) continue;

      resets.push({
        attributeId,
        target,
        value: selectResetValue(profile, attributeId) ?? "",
        origin: "dependency",
        reasonCode: REASON_MISSING_PRODUCT_DATA,
      });
    }
  }

  return resets;
};
