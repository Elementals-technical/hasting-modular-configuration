import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";

import type { RootState } from "./index";
import {
  setBookMatching,
  setCabinetColorFinish,
  setCabinetColorMaterial,
  setDrawerPanelFluting,
  setGrainDirection,
  setActiveCabinetType,
  setSelectedProductConfig,
  setSelectedDimensions,
  setSidePanelsOption,
  switchAllCabinetsDrawerStyle,
} from "@/entities/product/model/store/slice";
import {
  getBookMatching,
  getDrawerPanelFluting,
  getGrainDirection,
  getSelectedProducts,
  getSidePanelsOption,
} from "@/entities/product/model/store/selectors";
import {
  selectBookMatchingState,
  selectFlutingState,
  selectGrainDirectionState,
  selectSidePanelAvailability,
} from "@/entities/product/model/store/derivedSelectors";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";

export const optionsListenerMiddleware = createListenerMiddleware();

optionsListenerMiddleware.startListening({
  matcher: isAnyOf(setCabinetColorMaterial, setCabinetColorFinish),
  effect: async (_, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    const grainState = selectGrainDirectionState(state);
    const currentGrain = getGrainDirection(state);
    const selectedProducts = getSelectedProducts(state);

    if (!grainState.available && currentGrain) {
      listenerApi.dispatch(setGrainDirection(""));
      listenerApi.dispatch(setBookMatching(""));
      const ids = selectedProducts.length ? selectedProducts : {};
      await setConfigBatch(ids, { GrainDirection: "" });
    }
  },
});

optionsListenerMiddleware.startListening({
  actionCreator: setGrainDirection,
  effect: async (_, listenerApi) => {
    const state = listenerApi.getState() as RootState;
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
    const flutingState = selectFlutingState(state);
    const currentFluting = getDrawerPanelFluting(state);

    if (!flutingState.available && currentFluting) {
      listenerApi.dispatch(setDrawerPanelFluting(""));
    }
  },
});

optionsListenerMiddleware.startListening({
  matcher: isAnyOf(setCabinetColorMaterial, setSelectedProductConfig),
  effect: async (_, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    const flutingState = selectFlutingState(state);
    const currentFluting = getDrawerPanelFluting(state);

    if (!flutingState.available && currentFluting) {
      listenerApi.dispatch(setDrawerPanelFluting(""));
    }
  },
});

// When handle (Drawers) or dimensions change — re-check side panel availability.
// If the currently selected side panel is no longer allowed, pick a valid fallback and
// sync PlayCanvas via SidePanelSide="both".
optionsListenerMiddleware.startListening({
  matcher: isAnyOf(setSelectedProductConfig, setSelectedDimensions, setActiveCabinetType, switchAllCabinetsDrawerStyle),
  effect: async (_, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    const currentSidePanels = getSidePanelsOption(state);
    const selectedProducts = getSelectedProducts(state);

    if (!currentSidePanels || currentSidePanels === "None") return;
    // SidePanels option is global in Redux state. Auto-reset is safe only for single-cabinet scenes.
    // In multi-cabinet scenes (e.g. Sink Base + Open Shelf), selected-cabinet availability can
    // incorrectly clear a side panel applied on the opposite edge.
    if (selectedProducts.length !== 1) return;

    const availability = selectSidePanelAvailability(state);
    if (availability.allowed.has(currentSidePanels as "NoG" | "UpperG" | "CenterG" | "DoubleG")) return;

    const GROOVE_ORDER = ["NoG", "UpperG", "CenterG", "DoubleG"] as const;
    const newValue =
      GROOVE_ORDER.find((g) => availability.allowed.has(g)) ?? "None";

    listenerApi.dispatch(setSidePanelsOption(newValue));
    await setConfigBatch({}, { SidePanel: newValue, SidePanelSide: "both" });
  },
});
