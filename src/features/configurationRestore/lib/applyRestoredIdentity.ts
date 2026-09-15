import type { AppDispatch } from "@/app/store";
import { parseTarget, restoreConfigurationFragment } from "@/entities/configuration";
import type { CabinetEntry, SceneRestoreMatch, ScopedValue } from "@/entities/configuration";

import type { RestorePlan } from "./buildRestorePlan";

/**
 * The stable key saved for each product, by source id. Null when the payload cannot give them
 * back: a legacy payload has none, and a count that differs from the saved cabinets cannot be
 * paired without guessing.
 */
export const matchSavedStableKeys = (plan: RestorePlan): Map<string, string> | null => {
  if (plan.isLegacy) return null;

  const keys = [...plan.fragment.cabinets].sort((a, b) => a.index - b.index).map(({ stableKey }) => stableKey);
  if (keys.length !== plan.products.length || new Set(keys).size !== keys.length) return null;

  return new Map(plan.products.map(({ sourceId }, index) => [sourceId, keys[index]]));
};

/** Values of the fragment in state shape, without values addressed to a product that did not come back. */
export const toRestoredValues = (
  plan: RestorePlan,
  restoredKeys: ReadonlySet<string>,
): Record<string, ScopedValue[]> => {
  const values: Record<string, ScopedValue[]> = {};

  for (const [targetKey, byAttribute] of Object.entries(plan.fragment.values)) {
    const target = parseTarget(targetKey);
    if (!target) continue;
    if ((target.scope === "cabinet" || target.scope === "drawer") && !restoredKeys.has(target.cabinetId)) continue;

    for (const [attributeId, value] of Object.entries(byAttribute)) {
      values[attributeId] = [...(values[attributeId] ?? []), { target, value }];
    }
  }

  return values;
};

/**
 * Gives the rebuilt products their saved stable keys and restores the values addressed to them.
 *
 * Runs after the page recorded the product ids: the cabinet sync reacts to them and would
 * otherwise hand out new keys over the restored ones. Returns whether the identity came back.
 */
export const applyRestoredIdentity = (
  plan: RestorePlan,
  matches: readonly SceneRestoreMatch[],
  dispatch: AppDispatch,
): boolean => {
  const keysBySource = matchSavedStableKeys(plan);
  if (!keysBySource) return false;

  const cabinets: CabinetEntry[] = matches.flatMap(({ sourceId, runtimeId }, index) => {
    const stableKey = keysBySource.get(sourceId);
    return stableKey ? [{ stableKey, runtimeId, index }] : [];
  });

  dispatch(
    restoreConfigurationFragment({
      cabinets,
      values: toRestoredValues(plan, new Set(cabinets.map(({ stableKey }) => stableKey))),
    }),
  );

  return true;
};
