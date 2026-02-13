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
} from "@/entities/product/model/store/slice";
import { getBookMatching, getDrawerPanelFluting, getGrainDirection } from "@/entities/product/model/store/selectors";
import {
  selectBookMatchingState,
  selectFlutingState,
  selectGrainDirectionState,
} from "@/entities/product/model/store/derivedSelectors";

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

