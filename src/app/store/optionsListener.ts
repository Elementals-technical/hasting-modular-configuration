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
  switchAllCabinetsDrawerStyle,
} from "@/entities/product/model/store/slice";
import {
  getBookMatching,
  getDrawerPanelFluting,
  getGrainDirection,
  getSelectedProductConfig,
  getSelectedProducts,
  getSidePanelsOption,
  getSidePanelLeftStatus,
  getSidePanelRightStatus,
} from "@/entities/product/model/store/selectors";
import {
  selectBookMatchingState,
  selectFlutingState,
  selectGrainDirectionState,
  selectSidePanelAvailability,
} from "@/entities/product/model/store/derivedSelectors";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { applyGrooveToActiveSides } from "@/features/sidePanel";

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
  matcher: isAnyOf(setSelectedDimensions, switchAllCabinetsDrawerStyle),
  effect: async (action, listenerApi) => {
    // Only react to height changes from setSelectedDimensions (handle change forces new height).
    // Skip width/depth changes from the 350ms polling sync — they don't affect SP groove.
    if (action.type === setSelectedDimensions.type) {
      const payload = (action as { payload?: { height?: number } }).payload;
      if (!payload || payload.height === undefined) {
        return;
      }
    }

    const state = listenerApi.getState() as RootState;
    const currentSidePanels = getSidePanelsOption(state);
    console.warn("[SP] listener triggered by", action.type, "| current:", currentSidePanels);

    // "None" = SP never selected or explicitly removed — don't auto-set
    if (!currentSidePanels || currentSidePanels === "None") {
      console.warn("[SP] listener → skip (None)");
      return;
    }

    // Skip when selected entity is not a SP-eligible cabinet (OS, OSS, countertop, towel bar).
    // SP availability depends on SB/SC edge cabinets, not on whatever is currently selected.
    const cabType = state.rootStateUI.product.activeCabinetType ?? "";
    const normalized = cabType.toLowerCase().replace(/[^a-z]/g, "");
    const isSbSc = normalized.includes("sinkbase") || normalized.includes("sinkcabinet") ||
      normalized.includes("sidecabinet") || normalized === "sb" || normalized === "sc";
    if (!isSbSc) {
      console.warn("[SP] listener → skip (not SBSC, cabinet:", cabType, ")");
      return;
    }

    const availability = selectSidePanelAvailability(state);

    // Determine preferred groove based on current handle style
    const productConfig = getSelectedProductConfig(state);
    const handle = productConfig && typeof productConfig.Handle === "string" ? productConfig.Handle : null;
    console.warn("[SP] listener handle:", handle, "| allowed:", Array.from(availability.allowed), "| current in allowed?", availability.allowed.has(currentSidePanels as "NoG" | "UpperG" | "CenterG" | "DoubleG"));

    // Preferred grooves per handle style, ordered by priority
    const HANDLE_GROOVE_PRIORITY: Record<string, readonly string[]> = {
      handle_urban_topcut: ["UpperG", "DoubleG"],
      handle_urban_botcut: ["CenterG"],
      handle_pto: ["NoG"],
    };

    const priorities = handle ? HANDLE_GROOVE_PRIORITY[handle] ?? [] : [];
    const pickPreferred = () =>
      priorities.find((g) => availability.allowed.has(g as "NoG" | "UpperG" | "CenterG" | "DoubleG")) ?? null;

    const leftSt = getSidePanelLeftStatus(state);
    const rightSt = getSidePanelRightStatus(state);

    // Current groove SP still allowed — keep it (including user-selected NoG)
    if (availability.allowed.has(currentSidePanels as "NoG" | "UpperG" | "CenterG" | "DoubleG")) {
      console.warn("[SP] listener → keep (still allowed)");
      return;
    }

    // Current groove SP no longer allowed — pick preferred or fallback
    const newValue = pickPreferred()
      ?? (["UpperG", "CenterG", "DoubleG", "NoG"] as const).find((g) => availability.allowed.has(g))
      ?? "None";

    console.warn("[SP] listener → SET", newValue, "(preferred:", pickPreferred(), ")");
    await applyGrooveToActiveSides(listenerApi.dispatch, newValue, leftSt, rightSt);
  },
});
