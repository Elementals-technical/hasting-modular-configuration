import { isAnyOf } from "@reduxjs/toolkit";
import type { RootState } from "@/app/store";
import {
  setCountertopColorSku,
  setSelectedDimensions,
  setSelectedProductConfig,
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
  effect: (
    action: unknown,
    listenerApi: { getState: () => unknown; getOriginalState?: () => unknown; dispatch: unknown },
  ) => Promise<void>;
}) => void;

type SelectedDimensionsPayload = {
  height?: number | null;
  depth?: number | null;
};

const getSelectedProductIdentity = (state: RootState): string | null => {
  const config = state.rootStateUI.product.selectedProductConfig;
  const candidates = [config?.entityName, config?.name, state.rootStateUI.product.selectedSceneProduct];
  const identity = candidates.find((value): value is string => typeof value === "string" && value.length > 0);

  return identity ?? null;
};

const getSelectedHandle = (state: RootState): string | null => {
  const handle = state.rootStateUI.product.selectedProductConfig?.Handle;
  return typeof handle === "string" ? handle : null;
};

const shouldHandleSelectedProductConfigChange = (previousState: RootState | null, state: RootState): boolean => {
  if (!previousState) return false;

  const previousIdentity = getSelectedProductIdentity(previousState);
  const nextIdentity = getSelectedProductIdentity(state);
  if (!previousIdentity || previousIdentity !== nextIdentity) return false;

  const previousHandle = getSelectedHandle(previousState);
  const nextHandle = getSelectedHandle(state);

  return !!nextHandle && previousHandle !== nextHandle;
};

/**
 * Registers the SP availability listener on the provided middleware.
 * When handle (Drawers) or dimensions change — re-checks side panel availability.
 * If the currently selected side panel is no longer allowed, picks a valid fallback.
 */
export function setupSidePanelListener(startListening: StartListeningFn) {
  startListening({
    matcher: isAnyOf(
      setSelectedDimensions,
      setSelectedProductConfig,
      switchAllCabinetsDrawerStyle,
      setCountertopColorSku,
    ),
    effect: async (action, listenerApi) => {
      const previousState = (listenerApi.getOriginalState?.() as RootState | undefined) ?? null;
      const state = listenerApi.getState() as RootState;
      const act = action as { type: string; payload?: SelectedDimensionsPayload };
      const isCountertopMaterialChange = act.type === setCountertopColorSku.type;
      const isSelectedProductConfigChange = act.type === setSelectedProductConfig.type;
      const isDrawerStyleChange = act.type === switchAllCabinetsDrawerStyle.type;
      let shouldRefreshActivePanels = isDrawerStyleChange;

      if (act.type === setSelectedDimensions.type) {
        const payload = act.payload;
        // Width changes do not affect side-panel groove or panel mesh dimensions.
        if (!payload || (payload.height === undefined && payload.depth === undefined)) {
          return;
        }

        shouldRefreshActivePanels = true;
      }

      if (isSelectedProductConfigChange) {
        if (!shouldHandleSelectedProductConfigChange(previousState, state)) {
          return;
        }

        shouldRefreshActivePanels = true;
      }

      const currentSidePanels = getSidePanelsOption(state);

      if (!currentSidePanels || currentSidePanels === "None") return;

      // Skip when selected entity is not a SP-eligible cabinet (OS, OSS, countertop, towel bar).
      const cabType = state.rootStateUI.product.activeCabinetType ?? "";
      const normalized = cabType.toLowerCase().replace(/[^a-z]/g, "");
      const isSbSc =
        normalized.includes("sinkbase") ||
        normalized.includes("sinkcabinet") ||
        normalized.includes("sidecabinet") ||
        normalized === "sb" ||
        normalized === "sc";
      if (!isCountertopMaterialChange && !isSbSc) return;

      const availability = selectSidePanelAvailability(state);

      const productConfig = getSelectedProductConfig(state);
      const handle = productConfig && typeof productConfig.Handle === "string" ? productConfig.Handle : null;

      const leftSt = getSidePanelLeftStatus(state);
      const rightSt = getSidePanelRightStatus(state);

      const newValue = resolveGroove(availability.allowed as Set<string>, currentSidePanels, handle);

      if (newValue === currentSidePanels && !shouldRefreshActivePanels) return;

      const cabinetCount = state.rootStateUI.product.productIds.length;
      await applyGrooveToActiveSides(
        listenerApi.dispatch as Parameters<typeof applyGrooveToActiveSides>[0],
        newValue,
        leftSt,
        rightSt,
        cabinetCount,
      );
    },
  });
}
