import { addListener } from "@reduxjs/toolkit";
import { useEffect } from "react";

import type { AppDispatch, RootState } from "@/app/store";
import { buildHandleStyleConfigPatch } from "@/features/configurator-rule-core/cabinetBuilder";
import { useAppDispatch } from "@/shared/hooks/store/redux";

import { resolveHandleSceneSync } from "../lib/compositionListeners";
import type { ReplayValues } from "../lib/replayValues";
import { useChangeAttribute, type UseChangeAttributeOptions } from "./useChangeAttribute";

const addAppListener = addListener.withTypes<RootState, AppDispatch>();

/**
 * Shows on the scene a handle the state changed on its own: a rule, a restore or a picked
 * catalog cabinet. A handle the command service applied is not sent again.
 *
 * The handle, with the groove reset a handle without a groove needs, goes through the
 * command service like any other value, so the collection's bindings decide what the scene
 * gets. The state already holds the handle, so nothing is recorded. Mounted once, for both flows.
 */
export const useRuleDrivenHandleSync = ({ runtime }: UseChangeAttributeOptions = {}) => {
  const dispatch = useAppDispatch();
  const { replay } = useChangeAttribute({ runtime });

  useEffect(
    () =>
      dispatch(
        addAppListener({
          predicate: (action, current, previous) => resolveHandleSceneSync(action, previous, current) !== null,
          effect: async (action, listenerApi) => {
            const state = listenerApi.getState();
            const handle = resolveHandleSceneSync(action, listenerApi.getOriginalState(), state);
            if (!handle) return;

            const product = state.rootStateUI.product;
            const { Handle, HandleGrooveColor } = buildHandleStyleConfigPatch(
              handle,
              product.productOptions.HandleGrooveColor,
              product.activeProfile,
            );
            const values: ReplayValues = HandleGrooveColor === undefined ? { Handle } : { Handle, HandleGrooveColor };

            const result = await replay({ send: values, record: false });
            if (result.status !== "applied" || result.skipped.length > 0) {
              console.warn("[useRuleDrivenHandleSync] The handle did not reach the scene", result);
            }
          },
        }),
      ),
    [dispatch, replay],
  );
};
