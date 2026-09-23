import type { RootState } from "@/app/store";
import {
  normalizeOptionValue,
  selectAttribute,
  selectMessage,
  selectRuleData,
  type ProductProfile,
  type UndeterminedRule,
} from "@/entities/collection";
import { getAttributeValue, getCabinetEntries, type ValueTarget } from "@/entities/configuration";

import type { AttributeChange, ChangeBlockedReason } from "../model/types";

/**
 * CONTRACTS §8: a change the product has no rule for yet is neither allowed nor forbidden. It is
 * blocked with `product.missingData` before anything is planned, so state and scene stay as
 * they were. The cases come from `ruleData.undeterminedRules`, not from code.
 */

export const REASON_MISSING_PRODUCT_DATA = "product.missingData";

const asText = (value: AttributeChange["value"]): string => (value === null || value === undefined ? "" : String(value));

/** The cabinet's own value: what the command recorded, else the drawer style the scene placed. */
const readCabinetValue = (
  state: RootState,
  profile: ProductProfile,
  attributeId: string,
  cabinetId: string,
): string | null => {
  const recorded = getAttributeValue(state, attributeId, { scope: "cabinet", cabinetId });
  if (recorded !== undefined && recorded !== null) {
    return normalizeOptionValue(profile, attributeId, String(recorded)) ?? String(recorded);
  }

  if (attributeId !== "Drawers") return null;

  const runtimeId = getCabinetEntries(state).find(({ stableKey }) => stableKey === cabinetId)?.runtimeId;
  const placed = runtimeId ? state.rootStateUI.product.placedCabinetStyles[runtimeId] : undefined;
  return placed ? (normalizeOptionValue(profile, "Drawers", placed) ?? placed) : null;
};

/** Clearing a value never needs product data: the clearing values of the attribute always pass. */
const isClearing = (profile: ProductProfile, attributeId: string, value: string): boolean => {
  const attribute = selectAttribute(profile, attributeId);
  return [attribute?.initialValue, attribute?.noneValue, attribute?.resetValue, ""].includes(value);
};

const matchesRule = (
  rule: UndeterminedRule,
  change: AttributeChange,
  target: ValueTarget,
  state: RootState,
  profile: ProductProfile,
): boolean => {
  if (rule.attributeId !== change.attributeId) return false;

  const value = asText(change.value);
  const normalized = normalizeOptionValue(profile, change.attributeId, value) ?? value;
  if (rule.values ? !rule.values.includes(normalized) : isClearing(profile, change.attributeId, value)) return false;

  if (!rule.whenCabinet) return true;
  if (target.scope !== "cabinet" && target.scope !== "drawer") return false;

  return Object.entries(rule.whenCabinet).every(([attributeId, values]) => {
    const current = readCabinetValue(state, profile, attributeId, target.cabinetId);
    return current !== null && values.includes(current);
  });
};

export const checkUndetermined = (
  change: AttributeChange,
  target: ValueTarget,
  state: RootState,
  profile: ProductProfile,
): ChangeBlockedReason | null => {
  const rule = (selectRuleData(profile, "undeterminedRules") ?? []).find((candidate) =>
    matchesRule(candidate, change, target, state, profile),
  );
  if (!rule) return null;

  return {
    attributeId: change.attributeId,
    reasonCode: REASON_MISSING_PRODUCT_DATA,
    reason: selectMessage(profile, REASON_MISSING_PRODUCT_DATA, { ruleId: rule.ruleId }),
    compatibility: "undetermined",
  };
};
