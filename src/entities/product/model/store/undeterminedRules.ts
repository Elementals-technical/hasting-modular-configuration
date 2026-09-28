import type { RootState } from "@/app/store";
import {
  normalizeOptionValue,
  selectAttribute,
  selectRuleData,
  type ProductProfile,
  type UndeterminedRule,
} from "@/entities/collection";
import { getAttributeValue, getCabinetEntries, type ValueTarget } from "@/entities/configuration";

/**
 * CONTRACTS §8: values the product has not decided yet, neither allowed nor forbidden. The cases
 * come from `ruleData.undeterminedRules`, not from code, and are read at the cabinet a value is
 * addressed to. The command blocks such a value; a field with nothing decided is not shown.
 */

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

const appliesAt = (rule: UndeterminedRule, target: ValueTarget, state: RootState, profile: ProductProfile): boolean => {
  if (!rule.whenCabinet) return true;
  if (target.scope !== "cabinet" && target.scope !== "drawer") return false;

  return Object.entries(rule.whenCabinet).every(([attributeId, values]) => {
    const current = readCabinetValue(state, profile, attributeId, target.cabinetId);
    return current !== null && values.includes(current);
  });
};

const rulesOf = (profile: ProductProfile, attributeId: string): UndeterminedRule[] =>
  (selectRuleData(profile, "undeterminedRules") ?? []).filter((rule) => rule.attributeId === attributeId);

/** The rule that leaves this value of the attribute undetermined at `target`, or null. */
export const findUndeterminedRule = (
  state: RootState,
  profile: ProductProfile,
  attributeId: string,
  value: string,
  target: ValueTarget,
): UndeterminedRule | null => {
  const normalized = normalizeOptionValue(profile, attributeId, value) ?? value;

  return (
    rulesOf(profile, attributeId).find(
      (rule) =>
        (rule.values ? rule.values.includes(normalized) : !isClearing(profile, attributeId, value)) &&
        appliesAt(rule, target, state, profile),
    ) ?? null
  );
};

/**
 * Whether the product has decided no value of the attribute at `target` but the ones that clear
 * it — Mako's leg colour on a one-drawer cabinet (MAKO-LEG-002): a field has nothing to offer there.
 */
export const isUndeterminedAt = (
  state: RootState,
  profile: ProductProfile,
  attributeId: string,
  target: ValueTarget,
): boolean => rulesOf(profile, attributeId).some((rule) => !rule.values && appliesAt(rule, target, state, profile));
