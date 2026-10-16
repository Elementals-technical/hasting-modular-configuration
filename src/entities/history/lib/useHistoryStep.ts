import { useMemo } from "react";
import { useStore } from "react-redux";
import type { Store } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";

import { getIsHistoryRestoring } from "../model/store/selectors";
import { useDeferredHistorySnapshot } from "./useDeferredHistorySnapshot";

/**
 * One user action as one undo step.
 *
 * The state is read before the action, but written to the history only once the action has changed
 * what an undo restores. An action the rules or the scene refuse, or one that picks the value already
 * chosen, leaves the history — and redo — as they were. An action started while an undo, a redo or a
 * saved configuration is being restored waits until the restore is over.
 */
export type HistoryStep = {
  /**
   * Runs `change` as one step, written when the configuration in the store changed. `applied` names a
   * result that counts as a change on its own, for an action whose effect reaches the store only
   * later: a cabinet's width, which the scene reader records once the scene has resized it.
   */
  run<T>(change: () => Promise<T>, applied?: (result: T) => boolean): Promise<T>;
};

/** A command result that reached the scene, wholly or in part. */
export const isApplied = (result: { status: string }): boolean =>
  result.status === "applied" || result.status === "partial";

/** What an undo puts back from the store: the step is written when any of it changed. */
const configurationFingerprint = (state: RootState): string => {
  const { product, configuration } = state.rootStateUI;

  return JSON.stringify([
    product.productIds,
    product.productsPresets,
    product.productOptions,
    product.activeCabinetType,
    product.selectedDimensions,
    product.placedDividers,
    product.selectedProductConfig,
    product.placedCabinetStyles,
    configuration.cabinets,
    configuration.valuesByAttributeId,
  ]);
};

/**
 * Resolves once no snapshot is being restored (`history.isRestoring` is false): at once when none is,
 * otherwise when the running undo, redo or saved-configuration restore ends.
 */
const whenRestoreEnds = (store: Store<RootState>): Promise<void> => {
  // Nothing is being restored: the action goes on at once.
  if (!getIsHistoryRestoring(store.getState())) return Promise.resolve();

  return new Promise((resolve) => {
    const unsubscribe = store.subscribe(() => {
      if (getIsHistoryRestoring(store.getState())) return;
      unsubscribe();
      resolve();
    });
  });
};

// A step started while another runs — a handler that calls another, or two actions at once — is part
// of the one already open, so an action stays one entry with the state it started from.
let openSteps = 0;
let lastStepId = 0;

export function useHistoryStep(): HistoryStep {
  const store = useStore<RootState>();
  const deferred = useDeferredHistorySnapshot();

  return useMemo(
    () => ({
      async run(change, applied) {
        // An undo or redo rebuilds the scene and then shows its snapshot's values on it. An action
        // run meanwhile would stay in the state but be overwritten in the scene, and leave no history
        // entry, so the redo of the undone step would still be offered. It waits for the restore instead.
        await whenRestoreEnds(store);

        if (openSteps > 0) return change();

        openSteps += 1;
        lastStepId += 1;
        const owner = `history-step-${lastStepId}`;
        const before = configurationFingerprint(store.getState());
        const changed = () => configurationFingerprint(store.getState()) !== before;

        try {
          await deferred.capture(owner);
          const result = await change();
          if (changed() || applied?.(result)) deferred.commit(owner);
          else deferred.discard(owner);
          return result;
        } catch (error) {
          // What the action changed before it failed can still be undone.
          if (changed()) deferred.commit(owner);
          else deferred.discard(owner);
          throw error;
        } finally {
          openSteps -= 1;
        }
      },
    }),
    [deferred, store],
  );
}
