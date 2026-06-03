import { useCallback, useEffect } from "react";

import { getDividerConfiguratorWindow, recordDividerUiDebug, warnDividerUiDebug } from "./dividerUiDebug";
import {
  DIVIDER_RESIZE_RESTORE_EVENT,
  type DividerResizeRestoreEventDetail,
} from "./prepareDividersForResize";
import { setVisibleDividerSlotButtons } from "./setVisibleDividerSlotButtons";
import { setVisibleDrawerButtons } from "../setVisibleDrawerButtons";
import type { DividerType, DrawerType } from "./showIconDividerSlots";

type DividerResizeOverlayRestoreOptions = {
  stagePrefix: "Custom" | "Prebuilt";
  isPlayCanvasReady: boolean;
  dividerSelection: string;
  activeCabinetId: string | null | undefined;
  selectedDividerType: DividerType | null;
  shouldRestoreDrawerButtons?: boolean;
  setActiveDrawerType: (drawerType: DrawerType) => void;
  refreshDividerOverlay: (cabinetId: string, drawerType: DrawerType, dividerType?: DividerType | null) => unknown;
  refreshDividerOptionsAvailability: (cabinetId: string, drawerType: DrawerType) => unknown;
};

type ConfiguratorApiWithTopView = {
  showTopView?: (cabinetId: string, drawerType: DrawerType) => unknown;
  __activeDrawerCabinetId?: string;
  __activeDrawerType?: DrawerType;
};

export function useDividerResizeOverlayRestore({
  stagePrefix,
  isPlayCanvasReady,
  dividerSelection,
  activeCabinetId,
  selectedDividerType,
  shouldRestoreDrawerButtons = false,
  setActiveDrawerType,
  refreshDividerOverlay,
  refreshDividerOptionsAvailability,
}: DividerResizeOverlayRestoreOptions) {
  const restoreDrawerButtonsAfterResize = useCallback(
    (dimension: DividerResizeRestoreEventDetail["dimension"]) => {
      if (!isPlayCanvasReady || dividerSelection !== "Customize" || !shouldRestoreDrawerButtons) return;

      recordDividerUiDebug(`${stagePrefix}.DividerResizeRestore`, "Restore drawer CTA after resize", {
        dimension,
      });

      setVisibleDrawerButtons(true);
    },
    [dividerSelection, isPlayCanvasReady, shouldRestoreDrawerButtons, stagePrefix],
  );

  const restoreDividerOverlayAfterResize = useCallback(
    (cabinetId: string, drawerType: DrawerType, dimension: DividerResizeRestoreEventDetail["dimension"]) => {
      if (!isPlayCanvasReady || dividerSelection !== "Customize") return;

      const api = getDividerConfiguratorWindow()?.ConfiguratorAPI as ConfiguratorApiWithTopView | undefined;

      if (api) {
        api.__activeDrawerCabinetId = cabinetId;
        api.__activeDrawerType = drawerType;
      }
      setActiveDrawerType(drawerType);

      recordDividerUiDebug(`${stagePrefix}.DividerResizeRestore`, "Restore drawer overlay after resize", {
        cabinetId,
        drawerType,
        dimension,
        selectedDividerType,
        hasShowTopView: Boolean(api?.showTopView),
      });

      const refresh = () => {
        setVisibleDividerSlotButtons(true);
        refreshDividerOverlay(cabinetId, drawerType);
        void refreshDividerOptionsAvailability(cabinetId, drawerType);
      };

      try {
        const openResult = api?.showTopView?.(cabinetId, drawerType);
        Promise.resolve(openResult)
          .catch((error) => {
            warnDividerUiDebug(`${stagePrefix}.DividerResizeRestore`, "Failed to reopen drawer after resize", {
              cabinetId,
              drawerType,
              dimension,
              error,
            });
          })
          .finally(() => {
            window.setTimeout(refresh, 250);
          });
      } catch (error) {
        warnDividerUiDebug(`${stagePrefix}.DividerResizeRestore`, "Failed to trigger drawer restore after resize", {
          cabinetId,
          drawerType,
          dimension,
          error,
        });
        window.setTimeout(refresh, 250);
      }
    },
    [
      dividerSelection,
      isPlayCanvasReady,
      refreshDividerOptionsAvailability,
      refreshDividerOverlay,
      selectedDividerType,
      setActiveDrawerType,
      stagePrefix,
    ],
  );

  useEffect(() => {
    const handleDividerResizeRestore = (event: Event) => {
      const detail = (event as CustomEvent<DividerResizeRestoreEventDetail>).detail;
      if (!detail) return;

      const target = activeCabinetId ? detail.targets.find((item) => item.cabinetId === activeCabinetId) : undefined;
      if (!target) {
        restoreDrawerButtonsAfterResize(detail.dimension);
        return;
      }

      restoreDividerOverlayAfterResize(target.cabinetId, target.drawerType, detail.dimension);
    };

    window.addEventListener(DIVIDER_RESIZE_RESTORE_EVENT, handleDividerResizeRestore);

    return () => {
      window.removeEventListener(DIVIDER_RESIZE_RESTORE_EVENT, handleDividerResizeRestore);
    };
  }, [activeCabinetId, restoreDividerOverlayAfterResize, restoreDrawerButtonsAfterResize]);
}
