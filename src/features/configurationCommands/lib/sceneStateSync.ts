import { isAnyOf } from "@reduxjs/toolkit";
import type { ListenerMiddlewareInstance } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import { getCabinetEntries } from "@/entities/configuration/model/store/selectors";
import { recordSceneState, requestSceneStateSync, restoreCabinets } from "@/entities/configuration/model/store/slice";
import type { ConfigurationSceneReader } from "@/entities/configuration";
import {
  addProductId,
  commitRuleSelection,
  insertProductIdRelative,
  recordComposition,
  removeProductId,
  resetProducts,
  restoreProductState,
  setSelectedDimensions,
  swapProductIds,
  syncSelectedDimensionsFromScene,
} from "@/entities/product/model/store/slice";

/**
 * Keeps the recorded order and per-cabinet sizes in step with the scene (I04).
 *
 * The scene fires no events of its own for sizes or order. These existing actions are
 * dispatched once the composition or a size has changed, so they are the events: after
 * them C reads the scene through I and records what it actually holds.
 */

/** Composition changes (every one bumps `compositionVersion`), size changes and restore. */
export const isSceneStateTrigger = isAnyOf(
  addProductId,
  insertProductIdRelative,
  removeProductId,
  swapProductIds,
  resetProducts,
  recordComposition,
  restoreProductState,
  setSelectedDimensions,
  syncSelectedDimensionsFromScene,
  commitRuleSelection,
  restoreCabinets,
  requestSceneStateSync,
);

/**
 * Pages often send the scene command right after the action, from an effect. Waiting lets
 * that command land, and a burst of actions ends in one read.
 */
export const SCENE_STATE_SETTLE_MS = 200;

export type SceneStateListenerDeps = {
  reader: ConfigurationSceneReader;
  settleMs?: number;
};

export const setupSceneStateListener = (
  startListening: ListenerMiddlewareInstance["startListening"],
  { reader, settleMs = SCENE_STATE_SETTLE_MS }: SceneStateListenerDeps,
) =>
  startListening({
    matcher: isSceneStateTrigger,
    effect: async (_, listenerApi) => {
      // Only the latest event reads; an earlier read still in flight is dropped.
      listenerApi.cancelActiveListeners();
      await listenerApi.delay(settleMs);

      const runtimeIds = getCabinetEntries(listenerApi.getState() as RootState).map(({ runtimeId }) => runtimeId);
      if (runtimeIds.length === 0) return;

      const result = await reader.read(runtimeIds);
      listenerApi.throwIfCancelled();

      // A scene that could not be read leaves the last recorded values in place.
      if (result.status !== "ready") return;

      listenerApi.dispatch(recordSceneState({ order: result.order, cabinets: result.cabinets }));
    },
  });
