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
import { applyGrooveToActiveSides } from "./sidePanelService";

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
      console.warn("[SP] listener triggered by", act.type, "| current:", currentSidePanels);

      // "None" = SP never selected or explicitly removed — don't auto-set
      if (!currentSidePanels || currentSidePanels === "None") {
        console.warn("[SP] listener → skip (None)");
        return;
      }

      // Skip when selected entity is not a SP-eligible cabinet (OS, OSS, countertop, towel bar).
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
      await applyGrooveToActiveSides(listenerApi.dispatch as Parameters<typeof applyGrooveToActiveSides>[0], newValue, leftSt, rightSt);
    },
  });
}
