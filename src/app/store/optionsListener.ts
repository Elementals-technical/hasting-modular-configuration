import { createListenerMiddleware } from "@reduxjs/toolkit";

import type { RootState } from "./index";
import { setupSidePanelListener } from "@/features/sidePanel";
import {
  resolveCabinetSyncActions,
  resolveRestoreStatusReset,
} from "@/features/configurationCommands/lib/compositionListeners";
import { setupSceneStateListener } from "@/features/configurationCommands/lib/sceneStateSync";
import { createSceneReader } from "@/features/playCanvasAdapter/lib/createSceneReader";

export const optionsListenerMiddleware = createListenerMiddleware();

// Stable cabinet keys follow the placed products.
optionsListenerMiddleware.startListening({
  predicate: (_, current, previous) =>
    (current as RootState).rootStateUI.product.productIds !== (previous as RootState).rootStateUI.product.productIds,
  effect: (_, listenerApi) => {
    const previous = listenerApi.getOriginalState() as RootState;
    const current = listenerApi.getState() as RootState;
    const actions = resolveCabinetSyncActions(previous, current);

    actions.forEach((action) => listenerApi.dispatch(action));

    const restoreReset = resolveRestoreStatusReset(previous, current);
    if (restoreReset) listenerApi.dispatch(restoreReset);
  },
});

// The actual order and per-cabinet sizes are read back from the scene after they change.
setupSceneStateListener(optionsListenerMiddleware.startListening, { reader: createSceneReader() });

// Side panel availability listener — delegated to SP module.
setupSidePanelListener(optionsListenerMiddleware.startListening);
