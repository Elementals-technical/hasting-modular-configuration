import type { RootState } from "@/app/store";
import { selectMessage, type ProductProfile } from "@/entities/collection";
import type { ValueTarget } from "@/entities/configuration";
import { findUndeterminedRule } from "@/entities/product/model/store/undeterminedRules";

import type { AttributeChange, ChangeBlockedReason } from "../model/types";

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
