import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";

import type { RootState } from "./index";
import {
  addProductId,
  commitRuleSelection,
  insertProductIdRelative,
  removeProductId,
  resetProducts,
  restoreProductState,
  setPlacedCabinetStyle,
  setBookMatching,
  setCabinetColorFinish,
  setCabinetColorMaterial,
  setDrawerPanelFluting,
  setGrainDirection,
  setActiveCabinetType,
  setSelectedProductConfig,
  switchAllCabinetsDrawerStyle,
} from "@/entities/product/model/store/slice";
import { getBookMatching, getDrawerPanelFluting, getGrainDirection } from "@/entities/product/model/store/selectors";
import {
  selectBookMatchingState,
  selectFlutingState,
  selectGrainDirectionState,
} from "@/entities/product/model/store/derivedSelectors";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { setupSidePanelListener } from "@/features/sidePanel";
import { buildHandleStyleConfigPatch } from "@/features/configurator-rule-core/cabinetBuilder";
import {
  resolveCabinetSyncActions,
  resolveHandleSceneSync,
  resolveRestoreStatusReset,
} from "@/features/configurationCommands/lib/compositionListeners";
import { setupSceneStateListener } from "@/features/configurationCommands/lib/sceneStateSync";
import { createSceneReader } from "@/features/playCanvasAdapter/lib/createSceneReader";

export const optionsListenerMiddleware = createListenerMiddleware();

/**
 * The option rules read the active collection's profile. Before it loads every rule reads as
 * unavailable, so the listeners below must not clear a chosen value on that account.
 */
const hasActiveProfile = (state: RootState) => state.rootStateUI.product.activeProfile !== null;

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

// A handle the state changed on its own (rules, restore, selection) reaches the scene once.
optionsListenerMiddleware.startListening({
  predicate: (action, current, previous) =>
    resolveHandleSceneSync(action, previous as RootState, current as RootState) !== null,
  effect: async (action, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    const handle = resolveHandleSceneSync(action, listenerApi.getOriginalState() as RootState, state);
    if (!handle) return;

    const product = state.rootStateUI.product;
    await setConfigBatch(
      {},
      buildHandleStyleConfigPatch(handle, product.productOptions.HandleGrooveColor, product.activeProfile),
    );
  },
});

optionsListenerMiddleware.startListening({
  matcher: isAnyOf(setCabinetColorMaterial, setCabinetColorFinish),
  effect: async (_, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    if (!hasActiveProfile(state)) return;
    const grainState = selectGrainDirectionState(state);
    const currentGrain = getGrainDirection(state);

    // State only: the scene is cleared through the command service by useAvailabilityResets.
    if (!grainState.available && currentGrain) {
      listenerApi.dispatch(setGrainDirection(""));
      listenerApi.dispatch(setBookMatching(""));
    }
  },
});

optionsListenerMiddleware.startListening({
  actionCreator: setGrainDirection,
  effect: async (_, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    if (!hasActiveProfile(state)) return;
    const bookState = selectBookMatchingState(state);
    const currentBook = getBookMatching(state);

    if (!bookState.enabled && currentBook) {
      listenerApi.dispatch(setBookMatching(""));
    }
  },
});

optionsListenerMiddleware.startListening({
  matcher: isAnyOf(
    addProductId,
    insertProductIdRelative,
    removeProductId,
    resetProducts,
    restoreProductState,
    setPlacedCabinetStyle,
    switchAllCabinetsDrawerStyle,
  ),
  effect: async (_, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    if (!hasActiveProfile(state)) return;
    const bookState = selectBookMatchingState(state);
    const currentBook = getBookMatching(state);

    if (!bookState.enabled && currentBook) {
      listenerApi.dispatch(setBookMatching(""));
    }
  },
});

optionsListenerMiddleware.startListening({
  actionCreator: setActiveCabinetType,
  effect: async (_, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    if (!hasActiveProfile(state)) return;
    const flutingState = selectFlutingState(state);
    const currentFluting = getDrawerPanelFluting(state);

    if (!flutingState.available && currentFluting) {
      listenerApi.dispatch(setDrawerPanelFluting(""));
    }
  },
});

optionsListenerMiddleware.startListening({
  matcher: isAnyOf(setCabinetColorMaterial, setSelectedProductConfig, commitRuleSelection),
  effect: async (_, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    if (!hasActiveProfile(state)) return;
    const flutingState = selectFlutingState(state);
    const currentFluting = getDrawerPanelFluting(state);

    if (!flutingState.available && currentFluting) {
      listenerApi.dispatch(setDrawerPanelFluting(""));
    }
  },
});

// Side panel availability listener — delegated to SP module.
setupSidePanelListener(optionsListenerMiddleware.startListening);
