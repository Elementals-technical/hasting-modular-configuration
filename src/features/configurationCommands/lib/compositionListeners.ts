import type { UnknownAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import { getCabinetEntries } from "@/entities/configuration/model/store/selectors";
import { clearRestore, dropValuesForCabinet, syncCabinets } from "@/entities/configuration/model/store/slice";
import { commitRuleSelection, restoreProductState } from "@/entities/product/model/store/slice";

/**
 * Decisions of the listeners that keep C's state in step with the composition. Pure, so
 * they are tested without a scene; optionsListener.ts registers and runs them.
 */

/**
 * Keeps the stable cabinet keys (C01) in step with the products placed in the scene.
 * Every page already records its composition in `product.productIds`, so following that
 * one list covers adding, removing, inserting, swapping and restoring products.
 */
export const resolveCabinetSyncActions = (previous: RootState, current: RootState): UnknownAction[] => {
  const productIds = current.rootStateUI.product.productIds;

  if (productIds === previous.rootStateUI.product.productIds) return [];

  // Values addressed to a product that left the composition must not outlive it.
  const dropRemoved = getCabinetEntries(current)
    .filter(({ runtimeId }) => !productIds.includes(runtimeId))
    .map(({ stableKey }) => dropValuesForCabinet(stableKey));

  return [syncCabinets([...productIds]), ...dropRemoved];
};

/**
 * An incomplete restore blocks Save (C09). Once the composition changes it is the user's own
 * configuration again, so the status is cleared.
 */
export const resolveRestoreStatusReset = (previous: RootState, current: RootState): UnknownAction | null => {
  const { status } = current.rootStateUI.configuration.restore;

  if (status !== "partial" && status !== "failed") return null;
  if (current.rootStateUI.product.productIds === previous.rootStateUI.product.productIds) return null;

  return clearRestore();
};

/**
 * The handle to send to the scene after the state changed it, or null.
 *
 * Replaces the "sync handle to PlayCanvas" effects that the style sidebar and the player
 * each ran, so a rule-driven handle change reaches the scene once. A handle recorded by
 * the command service is skipped: its runtime port has already sent it. So is an undo: it
 * rebuilt every product from a config that already carries the handle.
 */
export const resolveHandleSceneSync = (
  action: UnknownAction,
  previous: RootState,
  current: RootState,
): string | null => {
  if (commitRuleSelection.match(action) || restoreProductState.match(action)) return null;

  const handle = current.rootStateUI.product.selectedProductConfig?.Handle;

  if (typeof handle !== "string" || !handle) return null;
  if (handle === previous.rootStateUI.product.selectedProductConfig?.Handle) return null;
  if (current.rootStateUI.product.productIds.length === 0) return null;

  return handle;
};
