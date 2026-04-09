import { isAnyOf } from "@reduxjs/toolkit";
import type { RootState } from "@/app/store";
import {
  setSelectedDimensions,
  switchAllCabinetsDrawerStyle,
} from "@/entities/product/model/store/slice";
import { getSelectedProductConfig } from "@/entities/product/model/store/selectors";
import {
  getSidePanelsOption,
  getSidePanelLeftStatus,
  getSidePanelRightStatus,
  selectSidePanelAvailability,
} from "../model/selectors";
import { applyGrooveToActiveSides, resolveGroove } from "./sidePanelService";

type StartListeningFn = (options: {
  matcher: ReturnType<typeof isAnyOf>;
  effect: (action: unknown, listenerApi: { getState: () => unknown; dispatch: unknown }) => Promise<void>;
}) => void;

/**
 * Registers the SP availability listener on the provided middleware.
 * When handle (Drawers) or dimensions change — re-checks side panel availability.
 * If the currently selected side panel is no longer allowed, picks a valid fallback.
 */
export function setupSidePanelListener(startListening: StartListeningFn) {
  startListening({
    matcher: isAnyOf(setSelectedDimensions, switchAllCabinetsDrawerStyle),
    effect: async (action, listenerApi) => {
      // Only react to height changes from setSelectedDimensions (handle change forces new height).
      // Skip width/depth changes from the 350ms polling sync — they don't affect SP groove.
      const act = action as { type: string; payload?: { height?: number } };
      if (act.type === setSelectedDimensions.type) {
        const payload = act.payload;
        if (!payload || payload.height === undefined) {
          return;
        }
      }

      const state = listenerApi.getState() as RootState;
      const currentSidePanels = getSidePanelsOption(state);

      if (!currentSidePanels || currentSidePanels === "None") return;

      // Skip when selected entity is not a SP-eligible cabinet (OS, OSS, countertop, towel bar).
      const cabType = state.rootStateUI.product.activeCabinetType ?? "";
      const normalized = cabType.toLowerCase().replace(/[^a-z]/g, "");
      const isSbSc = normalized.includes("sinkbase") || normalized.includes("sinkcabinet") ||
        normalized.includes("sidecabinet") || normalized === "sb" || normalized === "sc";
      if (!isSbSc) return;

      const availability = selectSidePanelAvailability(state);

      const productConfig = getSelectedProductConfig(state);
      const handle = productConfig && typeof productConfig.Handle === "string" ? productConfig.Handle : null;

      const leftSt = getSidePanelLeftStatus(state);
      const rightSt = getSidePanelRightStatus(state);

      const newValue = resolveGroove(
        availability.allowed as Set<string>,
        currentSidePanels,
        handle,
      );

      if (newValue === currentSidePanels) return;

      const cabinetCount = state.rootStateUI.product.productIds.length;
      await applyGrooveToActiveSides(listenerApi.dispatch as Parameters<typeof applyGrooveToActiveSides>[0], newValue, leftSt, rightSt, cabinetCount);
    },
  });
}
