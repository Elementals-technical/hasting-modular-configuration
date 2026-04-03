import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";

import type { RootState } from "./index";
import {
  addProductId,
  insertProductIdRelative,
  removeProductId,
  resetProducts,
  restoreProductState,
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
  getSelectedProductConfig,
  getSelectedProducts,
  getSidePanelsOption,
} from "@/entities/product/model/store/selectors";
import {
  selectBookMatchingState,
  selectFlutingState,
  selectGrainDirectionState,
  selectSidePanelAvailability,
} from "@/entities/product/model/store/derivedSelectors";
import { setSidePanel } from "@/utils/functions/playcanvas/sidePanels";
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
  matcher: isAnyOf(addProductId, insertProductIdRelative, removeProductId, resetProducts, restoreProductState),
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

    // "None" = SP never selected or explicitly removed — don't auto-set
    if (!currentSidePanels || currentSidePanels === "None") return;

    const availability = selectSidePanelAvailability(state);

    // Determine preferred groove based on current handle style
    const productConfig = getSelectedProductConfig(state);
    const handle = productConfig && typeof productConfig.Handle === "string" ? productConfig.Handle : null;

    // Preferred grooves per handle style, ordered by priority
    const HANDLE_GROOVE_PRIORITY: Record<string, readonly string[]> = {
      handle_urban_topcut: ["UpperG", "DoubleG"],
      handle_urban_botcut: ["CenterG"],
      handle_pto: ["NoG"],
    };

    const priorities = handle ? HANDLE_GROOVE_PRIORITY[handle] ?? [] : [];
    const pickPreferred = () =>
      priorities.find((g) => availability.allowed.has(g as "NoG" | "UpperG" | "CenterG" | "DoubleG")) ?? null;

    // SP is "NoG" (from PTO) and handle changed to groove type — upgrade to matching groove
    const upgradeTarget = pickPreferred();
    if (currentSidePanels === "NoG" && upgradeTarget && upgradeTarget !== "NoG") {
      listenerApi.dispatch(setSidePanelsOption(upgradeTarget));
      await setSidePanel(upgradeTarget, "both");
      return;
    }

    // Current groove SP still allowed — keep it
    if (availability.allowed.has(currentSidePanels as "NoG" | "UpperG" | "CenterG" | "DoubleG")) return;

    // Current groove SP no longer allowed — pick preferred or fallback
    const newValue = pickPreferred()
      ?? (["UpperG", "CenterG", "DoubleG", "NoG"] as const).find((g) => availability.allowed.has(g))
      ?? "None";

    listenerApi.dispatch(setSidePanelsOption(newValue));
    await setSidePanel(newValue, "both");
  },
});
