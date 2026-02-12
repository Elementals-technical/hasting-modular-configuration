import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";

import type { RootState } from "./index";
import {
  setBookMatching,
  setCabinetColorFinish,
  setCabinetColorMaterial,
  setDrawerPanelFluting,
  setGrainDirection,
  setActiveCabinetType,
  setSelectedDimensions,
  setSelectedProductConfig,
  setSidePanelsOption,
} from "@/entities/product/model/store/slice";
import {
  getBookMatching,
  getDrawerPanelFluting,
  getGrainDirection,
  getSidePanelsOption,
} from "@/entities/product/model/store/selectors";
import {
  selectBookMatchingState,
  selectFlutingState,
  selectGrainDirectionState,
  selectSidePanelAvailability,
} from "@/entities/product/model/store/derivedSelectors";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { getEdgeCabinets } from "@/utils/functions/playcanvas/getEdgeCabinets";

export const optionsListenerMiddleware = createListenerMiddleware();

optionsListenerMiddleware.startListening({
  matcher: isAnyOf(setCabinetColorMaterial, setCabinetColorFinish),
  effect: async (_, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    const grainState = selectGrainDirectionState(state);
    const currentGrain = getGrainDirection(state);

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

optionsListenerMiddleware.startListening({
  matcher: isAnyOf(setSelectedDimensions, setSelectedProductConfig, setActiveCabinetType),
  effect: async (_, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    const availability = selectSidePanelAvailability(state);
    const currentSidePanels = getSidePanelsOption(state);

    if (!currentSidePanels || currentSidePanels === "None") return;

    const resetSidePanels = async () => {
      const { leftCabinetId, rightCabinetId } = getEdgeCabinets();
      const promises: Promise<unknown>[] = [];
      if (leftCabinetId) promises.push(setConfigBatch({ cabinetId: leftCabinetId }, { SidePanel: "None" }));
      if (rightCabinetId) promises.push(setConfigBatch({ cabinetId: rightCabinetId }, { SidePanel: "None" }));
      await Promise.all(promises);
      listenerApi.dispatch(setSidePanelsOption("None"));
    };

    if (availability.allowed.size === 0) {
      await resetSidePanels();
      return;
    }

    if (availability.allowed.has(currentSidePanels as "NoG" | "UpperG" | "CenterG" | "DoubleG")) {
      return;
    }

    await resetSidePanels();
  },
});
