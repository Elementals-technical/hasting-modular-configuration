import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { cmToInches } from "@/shared/lib/sku";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import {
  getDividersOption,
  getDividersStyle,
  getSelectedDimensions,
  getSelectedProducts,
  getSelectedSceneProduct,
  getSidePanelsOption,
  getTowelBarColor,
  getTowelBarOption,
} from "@/entities/product/model/store/selectors";
import { selectSidePanelAvailability } from "@/entities/product/model/store/derivedSelectors";
import { getSidePanelLeftStatus, getSidePanelRightStatus } from "@/features/sidePanel";
import {
  clearPlacedDividers,
  replacePlacedDividersForDrawer,
  setDividersOption,
  setDividersStyle,
  setIsDrawerOpen,
  setTowelBarColor,
  setTowelBarOption,
} from "@/entities/product/model/store/slice";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import type { AccordionConfig } from "@/shared/constants/types";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import { getEdgeCabinets } from "@/utils/functions/playcanvas/getEdgeCabinets";
import {
  getAvailableDividerTypes,
  getAvailableDividerTypesForDrawer,
  clearPlacedDividersInScene,
  getDividerTypeFromOptionTitle,
  getPlacedDividersForDrawer,
  placeDividerToSlot,
  createDividerUiTraceId,
  getDividerConfiguratorWindow,
  recordDividerUiDebug,
  removeDividerFromSlot,
  setDividerSlotClickHandler,
  setOnAddSlotClick,
  setOnOccupiedSlotClick,
  setVisibleDividerSlotButtons,
  showIconDividerSlots,
  summarizeDividerSlotInfo,
  type DividerType,
  type DrawerType,
  warnDividerUiDebug,
  wrapExitTopView,
  wrapShowTopView,
} from "@/utils/functions/playcanvas/dividers";
import {
  exportCameraState,
  importCameraState,
  setAutoFraming,
} from "@/utils/functions/playcanvas/camera";
import { useDividerResizeOverlayRestore } from "@/utils/functions/playcanvas/dividers/useDividerResizeOverlayRestore";

import { dividersMockData, optionsSidePanelsData, optionsSwatchData2, optionsSwatchDataTowel } from "./constants";
import { useGetConfiguratorQuery } from "@/entities";
import {
  formatSidePanelsExceedMaxReason,
  SYNTESI_SIDE_PANEL_UNAVAILABLE_REASON,
  useCountertopLengthGuard,
} from "@/features/configurator-rule-core/countertop";
import { setVisibleDrawerButtons } from "@/utils/functions/playcanvas/setVisibleDrawerButtons.ts";
import { onDrawerCloseWidgetRender, onDrawerWidgetRender } from "@/utils/functions/playcanvas/drawerWidgetRenderers";
import { applyGroove, autoRemoveBoth, isGrooveType } from "@/features/sidePanel";

const DEFAULT_ACCORDION_ID = "side-panels";
const DIVIDERS_ACCORDION_ID = "dividers";

const DIVIDER_PLACEMENT_WARNING_STYLE = {
  margin: "10px 0 12px",
  padding: "10px 12px",
  border: "1px solid #e2b8a6",
  borderRadius: 6,
  background: "#fff6f2",
  color: "#8b3f24",
  fontFamily: "Poppins",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: "16px",
};

const DIVIDER_SELECT_TYPE_HINT_STYLE = {
  margin: "10px 0 12px",
  color: "#4a5568",
  fontFamily: "Poppins",
  fontSize: 12,
  fontWeight: 500,
  lineHeight: "16px",
};

const getDividerOptionLabel = (type: string) => `Option ${type}`;

const formatDividerOptionsList = (available: readonly string[]) =>
  available.map(getDividerOptionLabel).join(", ");

const buildUnavailableDividerWarning = (dividerType: string, available: readonly string[]) => {
  if (available.length > 0) {
    return `${getDividerOptionLabel(dividerType)} does not fit here. Choose one of: ${formatDividerOptionsList(available)}.`;
  }

  return `${getDividerOptionLabel(dividerType)} does not fit here. No Divider option is available for this slot.`;
};

const buildDividerPlacementWarning = (selectedDividerType: DividerType | null, available: readonly string[]) => {
  if (!selectedDividerType) return "Select a Divider option before placing it.";
  if (!available.includes(selectedDividerType)) return buildUnavailableDividerWarning(selectedDividerType, available);

  return null;
};

const isDividerType = (value: unknown): value is DividerType => value === "A" || value === "B" || value === "C";

const normalizeDividerTypes = (value: unknown): DividerType[] =>
  Array.isArray(value) ? value.filter(isDividerType) : [];

export const CustomAccessoriesPage = () => {
  const dispatch = useAppDispatch();
  const saveSnapshot = useHistorySnapshot();
  const dividerSelection = useAppSelector(getDividersOption);
  const dividerStyle = useAppSelector(getDividersStyle);
  const towelSelection = useAppSelector(getTowelBarOption);
  const towelBarColor = useAppSelector(getTowelBarColor);
  const activeSidePanels = useAppSelector(getSidePanelsOption);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const selectedSceneProduct = useAppSelector(getSelectedSceneProduct);

  const isPlayCanvasReady = usePlayCanvasReady();
  const [activeDrawerType, setActiveDrawerType] = useState<DrawerType | null>(null);
  const [activeAccordionId, setActiveAccordionId] = useState<string | null>(DEFAULT_ACCORDION_ID);
  const [dividerAvailability, setDividerAvailability] = useState<{
    cabinetId: string;
    drawerType: DrawerType;
    types: Set<DividerType> | null;
  } | null>(null);
  const [dividerPlacementWarning, setDividerPlacementWarning] = useState<string | null>(null);
  const drawerCameraStateRef = useRef<Record<string, unknown> | null>(null);
  const isDrawerCameraManagedRef = useRef(false);

  const activeCabinetId = selectedSceneProduct;

  const { data: configuratorData } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });

  const sidePanelAvailability = useAppSelector(selectSidePanelAvailability);
  const sidePanelLeft = useAppSelector(getSidePanelLeftStatus);
  const sidePanelRight = useAppSelector(getSidePanelRightStatus);
  const lengthGuard = useCountertopLengthGuard(selectedProducts);
  const sidePanelsBlockedByLength340 =
    lengthGuard.currentCabinetOnly !== null && Math.abs(lengthGuard.currentCabinetOnly - 340) < 0.01;
  const sidePanelsLengthReason = `Side panels are not available when total vanity length is exactly 340 cm (${cmToInches(340)}").`;

  const isEdgeCabinet = useMemo(() => {
    if (!activeCabinetId || !isPlayCanvasReady) return false;
    const { leftCabinetId, rightCabinetId } = getEdgeCabinets();
    return activeCabinetId === leftCabinetId || activeCabinetId === rightCabinetId;
  }, [activeCabinetId, isPlayCanvasReady]);

  // Resolve the side(s) the SP toggle would affect — mirrors handleSidePanelsChange.
  const resolvedSpSide = useMemo<"left" | "right" | "both">(() => {
    const { leftCabinetId, rightCabinetId } = getEdgeCabinets();
    if (!activeCabinetId || !isEdgeCabinet) return "both";
    if (selectedProducts.length === 1 || (leftCabinetId && leftCabinetId === rightCabinetId)) return "both";
    if (activeCabinetId === leftCabinetId) return "left";
    if (activeCabinetId === rightCabinetId) return "right";
    return "both";
  }, [activeCabinetId, isEdgeCabinet, selectedProducts.length]);

  /** Projected total countertop width after applying the given groove value. */
  const computeTotalAfterSpChange = useCallback(
    (value: string): number | null => {
      if (lengthGuard.currentCabinetOnly === null) return null;
      if (value === "None") return lengthGuard.currentCabinetOnly;
      const leftAfter = resolvedSpSide !== "right" || sidePanelLeft === "active";
      const rightAfter = resolvedSpSide !== "left" || sidePanelRight === "active";
      const plannedSpCm = (leftAfter ? 1 : 0) + (rightAfter ? 1 : 0);
      return lengthGuard.currentCabinetOnly + plannedSpCm;
    },
    [lengthGuard.currentCabinetOnly, resolvedSpSide, sidePanelLeft, sidePanelRight],
  );

  const sidePanelOptions = useMemo(() => {
    if (sidePanelsBlockedByLength340) {
      return optionsSidePanelsData.filter((option) => option.metadata?.value === "None");
    }

    const isSyntesiBlocked =
      sidePanelAvailability.allowed.size === 0 &&
      sidePanelAvailability.reason === SYNTESI_SIDE_PANEL_UNAVAILABLE_REASON;

    const allowed = new Set<string>(["None"]);
    sidePanelAvailability.allowed.forEach((value) => allowed.add(value));

    return optionsSidePanelsData
      .map((option) => {
        const value = option.metadata?.value;
        if (!value || value === "None") return option;
        if (isSyntesiBlocked) {
          return {
            ...option,
            isAvailable: false,
            disabledReason: sidePanelAvailability.reason,
          };
        }
        if (!allowed.has(value)) return null;
        const totalAfter = computeTotalAfterSpChange(value);
        if (totalAfter === null || lengthGuard.max === null) return option;
        if (lengthGuard.canAccommodateTotal(totalAfter)) return option;
        return {
          ...option,
          isAvailable: false,
          disabledReason: formatSidePanelsExceedMaxReason(totalAfter, lengthGuard.max),
        };
      })
      .filter((option): option is (typeof optionsSidePanelsData)[number] => option !== null);
  }, [
    sidePanelAvailability.reason,
    sidePanelAvailability.allowed,
    sidePanelsBlockedByLength340,
    computeTotalAfterSpChange,
    lengthGuard,
  ]);

  useEffect(() => {
    if (!sidePanelsBlockedByLength340) return;
    if (!activeSidePanels || activeSidePanels === "None") return;

    autoRemoveBoth(dispatch, selectedProducts.length);
  }, [activeSidePanels, dispatch, sidePanelsBlockedByLength340, selectedProducts.length]);

  const towelBarOptionsFromApi = useMemo(() => {
    const groups = (configuratorData?.availableOptions ?? []).filter((g) => g.proxyName === "Towel Bar Color");
    if (!groups.length) return [];

    const allowedCodes = ["0B MT", "43 MT", "M6 MT", "M7 MT", "03 MT"];
    const lacqueredMtMarkers = ["lacquered mt", "lacquer mt", "lacquered matte", "lacquer matte"];

    const isAllowedTowelColor = (text: string | undefined | null) => {
      if (!text) return false;
      const normalized = text.toLowerCase();
      return allowedCodes.some((code) => normalized.includes(code.toLowerCase()));
    };

    const isLacqueredMt = (text: string | undefined | null) => {
      if (!text) return false;
      const normalized = text.toLowerCase();
      return lacqueredMtMarkers.some((marker) => normalized.includes(marker));
    };

    return groups.flatMap((group) =>
      group.options.flatMap((option) =>
        option.variants
          .filter((variant) => variant.enabled)
          .map((variant) => {
            const meta = (variant.metadata ?? {}) as Record<string, unknown>;
            const label = (meta.label as string) || (meta.Label as string) || variant.name;
            const value = (meta.value as string) || variant.name;
            const image = (meta.image as string) || variant.image || undefined;
            const hex = (meta.hex as string) || undefined;

            return {
              id: variant.id,
              title: label,
              name: variant.name,
              desc: option.name ?? group.proxyName,
              isShortDesc: false,
              metadata: {
                image,
                value,
                hex,
              },
            };
          })
          .filter((item) => {
            const haystack = `${item.title ?? ""} ${item.name ?? ""} ${item.metadata?.value ?? ""} ${item.desc ?? ""}`;
            return isAllowedTowelColor(haystack) && isLacqueredMt(haystack);
          }),
      ),
    );
  }, [configuratorData]);

  const selectedDividerType: DividerType | null =
    dividerStyle?.trim() === "Option B"
      ? "B"
      : dividerStyle?.trim() === "Option C"
        ? "C"
        : dividerStyle?.trim() === "Option A"
          ? "A"
          : null;

  const resolveDividerType = useCallback(
    (available: string[]) => {
      if (selectedDividerType) {
        return available.includes(selectedDividerType) ? selectedDividerType : null;
      }

      return null;
    },
    [selectedDividerType],
  );

  const refreshDividerOptionsAvailability = useCallback(
    async (cabinetId = activeCabinetId, drawerType = activeDrawerType) => {
      if (!isPlayCanvasReady || dividerSelection !== "Customize" || !cabinetId || !drawerType) return;

      const types = await getAvailableDividerTypesForDrawer(cabinetId, drawerType);
      setDividerAvailability({ cabinetId, drawerType, types });
    },
    [activeCabinetId, activeDrawerType, dividerSelection, isPlayCanvasReady],
  );

  const syncPlacedDividersForDrawer = useCallback(
    async (cabinetId: string, drawerType: DrawerType) => {
      const dividers = await getPlacedDividersForDrawer(cabinetId, drawerType);
      if (!dividers) return;

      dispatch(replacePlacedDividersForDrawer({ cabinetId, drawerType, dividers }));
    },
    [dispatch],
  );

  const refreshDividerOverlay = useCallback(
    (cabinetId = activeCabinetId, drawerType = activeDrawerType, dividerType = selectedDividerType) => {
      if (!isPlayCanvasReady || dividerSelection !== "Customize" || !cabinetId || !drawerType) return null;

      const options = {
        show: true,
        selectedDividerType: dividerType,
        debugRequestId: createDividerUiTraceId("custom-overlay"),
      };

      recordDividerUiDebug("Custom.DividerEffect", "Refresh divider overlay with selected type", {
        cabinetId,
        drawerType,
        selectedDividerType: dividerType,
        debugRequestId: options.debugRequestId,
        options,
      });

      return showIconDividerSlots(cabinetId, drawerType, options);
    },
    [activeCabinetId, activeDrawerType, dividerSelection, isPlayCanvasReady, selectedDividerType],
  );

  useDividerResizeOverlayRestore({
    stagePrefix: "Custom",
    isPlayCanvasReady,
    dividerSelection,
    activeCabinetId,
    selectedDividerType,
    setActiveDrawerType,
    refreshDividerOverlay,
    refreshDividerOptionsAvailability,
  });

  useEffect(() => {
    if (!isPlayCanvasReady || dividerSelection !== "Customize") return;

    const api = getDividerConfiguratorWindow()?.ConfiguratorAPI as
      | {
          __activeDrawerCabinetId?: string;
          __activeDrawerType?: DrawerType;
        }
      | undefined;
    const cabinetId = api?.__activeDrawerCabinetId ?? activeCabinetId;
    const drawerType = api?.__activeDrawerType ?? activeDrawerType;

    recordDividerUiDebug("Custom.DividerResizeRefresh", "Evaluate divider overlay refresh after dimension change", {
      activeCabinetId,
      activeDrawerType,
      runtimeCabinetId: api?.__activeDrawerCabinetId,
      runtimeDrawerType: api?.__activeDrawerType,
      selectedDividerType,
      selectedDimensions,
    });

    if (!cabinetId || !drawerType) {
      warnDividerUiDebug("Custom.DividerResizeRefresh", "Skip refresh because active drawer is not resolved", {
        activeCabinetId,
        activeDrawerType,
        runtimeCabinetId: api?.__activeDrawerCabinetId,
        runtimeDrawerType: api?.__activeDrawerType,
      });
      return;
    }

    if (drawerType !== activeDrawerType) {
      setActiveDrawerType(drawerType);
    }

    const refresh = () => {
      setVisibleDividerSlotButtons(true);
      refreshDividerOverlay(cabinetId, drawerType);
      void refreshDividerOptionsAvailability(cabinetId, drawerType);
    };

    const timeoutId = window.setTimeout(refresh, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeCabinetId,
    activeDrawerType,
    dividerSelection,
    isPlayCanvasReady,
    refreshDividerOptionsAvailability,
    refreshDividerOverlay,
    selectedDimensions.depth,
    selectedDimensions.width,
    selectedDividerType,
  ]);

  useEffect(() => {
    if (!isPlayCanvasReady || dividerSelection !== "Customize" || !activeCabinetId || !activeDrawerType) return;

    let isCurrent = true;
    const cabinetId = activeCabinetId;
    const drawerType = activeDrawerType;

    void getAvailableDividerTypesForDrawer(cabinetId, drawerType).then((types) => {
      if (!isCurrent) return;
      setDividerAvailability({ cabinetId, drawerType, types });
    });

    return () => {
      isCurrent = false;
    };
  }, [activeCabinetId, activeDrawerType, dividerSelection, isPlayCanvasReady]);

  useEffect(() => {
    if (!isPlayCanvasReady) return;

    setVisibleDrawerButtons(activeAccordionId === DIVIDERS_ACCORDION_ID && dividerSelection === "Customize");
  }, [activeAccordionId, dividerSelection, isPlayCanvasReady]);

  const availableDividerTypes = useMemo(() => {
    if (!dividerAvailability || dividerSelection !== "Customize" || !activeCabinetId || !activeDrawerType) return null;
    if (dividerAvailability.cabinetId !== activeCabinetId || dividerAvailability.drawerType !== activeDrawerType) {
      return null;
    }

    return dividerAvailability.types;
  }, [activeCabinetId, activeDrawerType, dividerAvailability, dividerSelection]);

  const dividerOptions = useMemo(() => {
    if (!availableDividerTypes) return dividersMockData;

    const availableTypes = Array.from(availableDividerTypes);

    return dividersMockData.map((option) => {
      const dividerType = getDividerTypeFromOptionTitle(option.title);
      const isAvailable = dividerType ? availableDividerTypes.has(dividerType) : true;
      const disabledReason = dividerType
        ? buildUnavailableDividerWarning(dividerType, availableTypes)
        : "This divider option does not fit in the selected drawer space.";

      return {
        ...option,
        isAvailable,
        disabledReason: isAvailable ? undefined : disabledReason,
      };
    });
  }, [availableDividerTypes]);

  const cloneCameraState = useCallback((state: Record<string, unknown> | null) => {
    if (!state) return null;
    try {
      return JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    } catch {
      return state;
    }
  }, []);

  const applyOpenDrawerCameraMode = useCallback(() => {
    if (!isDrawerCameraManagedRef.current) {
      drawerCameraStateRef.current = cloneCameraState(exportCameraState() as Record<string, unknown> | null);
      setAutoFraming(false);
      isDrawerCameraManagedRef.current = true;
    }

  }, [cloneCameraState]);

  const restoreDrawerCameraMode = useCallback((applyCameraRestore = true) => {
    if (isDrawerCameraManagedRef.current) {
      if (applyCameraRestore) {
        if (drawerCameraStateRef.current) {
          importCameraState(drawerCameraStateRef.current);
        }
        setAutoFraming(true);
      }
    }

    drawerCameraStateRef.current = null;
    isDrawerCameraManagedRef.current = false;
  }, []);

  useEffect(() => {
    onDrawerWidgetRender((drawerInfo, parentEl) => {
      parentEl.innerHTML = "";
      parentEl.style.display = "flex";
      parentEl.style.flexDirection = "column";
      parentEl.style.alignItems = "center";
      parentEl.style.gap = "6px";
      parentEl.style.pointerEvents = "auto";

      if (drawerInfo.hasOccupiedDividers) {
        const indicator = document.createElement("div");
        indicator.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M16.6667 5L7.50001 14.1667L3.33334 10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        indicator.style.background = "#262b31";
        indicator.style.color = "#fff";
        indicator.style.borderRadius = "999px";
        indicator.style.width = "42px";
        indicator.style.height = "42px";
        indicator.style.display = "flex";
        indicator.style.alignItems = "center";
        indicator.style.justifyContent = "center";
        indicator.style.boxShadow = "0 1px 2px rgba(0,0,0,0.25)";
        parentEl.appendChild(indicator);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Open Drawer";
      button.style.background = "#A05535";
      button.style.color = "#fff";
      button.style.border = "none";
      button.style.borderRadius = "999px";
      button.style.padding = "5px 12px";
      button.style.cursor = "pointer";
      button.style.fontSize = "11px";
      button.style.lineHeight = "1.1";
      button.style.fontFamily = "Poppins, sans-serif";
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const containerRef = window.containerRef;
        const api = containerRef?.current?.contentWindow?.ConfiguratorAPI;
        api?.showTopView?.(drawerInfo.cabinetId, drawerInfo.drawerType);
      });
      parentEl.appendChild(button);
    });

    onDrawerCloseWidgetRender((_, parentEl) => {
      parentEl.innerHTML = "";
      parentEl.style.pointerEvents = "auto";

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Close";
      button.style.background = "#282828";
      button.style.color = "#fff";
      button.style.border = "none";
      button.style.borderRadius = "12px";
      button.style.padding = "4px 10px";
      button.style.cursor = "pointer";
      button.style.fontSize = "11px";
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const containerRef = window.containerRef;
        const api = containerRef?.current?.contentWindow?.ConfiguratorAPI;
        api?.exitTopView?.();
      });
      parentEl.appendChild(button);
    });

    return () => {
      onDrawerWidgetRender(null);
      onDrawerCloseWidgetRender(null);
    };
  }, []);

  // Get the drawerType.
  useEffect(() => {
    if (!isPlayCanvasReady) return;

    const wrapped = wrapShowTopView({
      onSelect: (cabinetId, drawerType) => {
        console.log("[Drawer] selected", { cabinetId, drawerType });

        applyOpenDrawerCameraMode();
        setActiveDrawerType(drawerType);
        dispatch(setIsDrawerOpen(true));
      },

      onAfterSelect: (cabinetId, drawerType) => {
        if (dividerSelection === "Customize") {
          setVisibleDividerSlotButtons(true);
          refreshDividerOverlay(cabinetId, drawerType);
        }
      },
    });

    if (!wrapped) {
      console.log("[Drawer] showTopView not ready or already wrapped");
    }
  }, [dispatch, isPlayCanvasReady, dividerSelection, applyOpenDrawerCameraMode, refreshDividerOverlay]);

  useEffect(() => {
    const exitTopView = wrapExitTopView({
      onExit: () => {
        restoreDrawerCameraMode(false);

        console.log("[Drawer] exitTopView triggered by Close");

        setActiveDrawerType(null);
        dispatch(setIsDrawerOpen(false));
      },
    });

    if (!exitTopView) {
      console.warn("[Drawer] exitTopView not ready");
    }
  }, [dispatch, restoreDrawerCameraMode]);

  useEffect(() => {
    return () => {
      restoreDrawerCameraMode();
    };
  }, [restoreDrawerCameraMode]);

  // Side panel invalidation is handled by global listener middleware.

  useEffect(() => {
    recordDividerUiDebug("Custom.DividerEffect", "Evaluate divider overlay effect", {
      isPlayCanvasReady,
      dividerSelection,
      activeCabinetId,
      activeDrawerType,
      selectedDividerType,
    });

    if (!isPlayCanvasReady) {
      recordDividerUiDebug("Custom.DividerEffect", "Skip because PlayCanvas is not ready");
      return;
    }

    if (dividerSelection !== "Customize") {
      recordDividerUiDebug("Custom.DividerEffect", "Disable divider slot buttons because Customize is not selected", {
        dividerSelection,
      });
      setVisibleDividerSlotButtons(false);
      return;
    }

    setVisibleDividerSlotButtons(true);

    if (!activeCabinetId) {
      warnDividerUiDebug("Custom.DividerEffect", "Skip because activeCabinetId is empty", {
        activeDrawerType,
      });
      return;
    }

    recordDividerUiDebug("Custom.DividerEffect", "Initialize divider overlay effect", {
      activeCabinetId,
      activeDrawerType,
      dividerSelection,
      selectedDividerType,
      isPlayCanvasReady,
    });

    if (activeDrawerType) {
      recordDividerUiDebug("Custom.DividerEffect", "Show divider slots for active drawer", {
        activeCabinetId,
        activeDrawerType,
        selectedDividerType,
      });
      refreshDividerOverlay(activeCabinetId, activeDrawerType);
    } else {
      warnDividerUiDebug("Custom.DividerEffect", "Skip showIconDividerSlots because activeDrawerType is null", {
        activeCabinetId,
      });
    }

    const onAddHandler = setOnAddSlotClick(async (slotInfo) => {
      recordDividerUiDebug("Custom.AddSlot", "Add slot callback received", {
        slotInfo: summarizeDividerSlotInfo(slotInfo),
        selectedDividerType,
      });

      const available = normalizeDividerTypes(
        slotInfo.availableTypes?.length > 0
          ? slotInfo.availableTypes
          : getAvailableDividerTypes({
              cabinetId: slotInfo.cabinetId,
              drawerType: slotInfo.drawerType,
              zone: slotInfo.zone,
              key: slotInfo.key,
            }),
      );
      const placementWarning = buildDividerPlacementWarning(selectedDividerType, available);
      const selectedType = resolveDividerType(available);
      const drawerType = slotInfo.drawerType ?? activeDrawerType;
      recordDividerUiDebug("Custom.AddSlot", "Resolved add slot decision", {
        slotInfo: summarizeDividerSlotInfo(slotInfo),
        available,
        selectedDividerType,
        selectedType,
        drawerType,
        zoneIndex: slotInfo.zoneIndex,
        placementType: slotInfo.placementType,
        canPlace: slotInfo.canPlace,
        disabledReason: slotInfo.disabledReason,
      });

      if (slotInfo.canPlace === false || placementWarning || !selectedType) {
        const userMessage =
          placementWarning ?? "Selected Divider does not fit here. Choose another available option.";
        setDividerPlacementWarning(userMessage);
        console.warn("[Dividers] selected divider type is not available for add slot");
        warnDividerUiDebug(
          "Custom.AddSlot",
          selectedDividerType ? "Selected divider type is not available" : "Divider type is not selected",
          {
            slotInfo: summarizeDividerSlotInfo(slotInfo),
            available,
            selectedDividerType,
            zoneIndex: slotInfo.zoneIndex,
            placementType: slotInfo.placementType,
            canPlace: slotInfo.canPlace,
            disabledReason: slotInfo.disabledReason,
            userMessage,
          },
        );
        return;
      }

      if (!drawerType) {
        console.warn("[Dividers] drawerType not resolved for add slot");
        warnDividerUiDebug("Custom.AddSlot", "Drawer type not resolved", {
          slotInfo: summarizeDividerSlotInfo(slotInfo),
          activeDrawerType,
        });
        return;
      }

      setDividerPlacementWarning(null);
      await saveSnapshot();
      recordDividerUiDebug("Custom.AddSlot", "Place divider request prepared", {
        cabinetId: slotInfo.cabinetId,
        drawerType,
        zone: slotInfo.zone,
        key: slotInfo.key,
        zoneIndex: slotInfo.zoneIndex,
        placementType: slotInfo.placementType,
        selectedType,
      });
      await placeDividerToSlot({ ...slotInfo, drawerType }, selectedType);
      await syncPlacedDividersForDrawer(slotInfo.cabinetId, drawerType);
      refreshDividerOverlay(slotInfo.cabinetId, drawerType);
      void refreshDividerOptionsAvailability(slotInfo.cabinetId, drawerType);
      recordDividerUiDebug("Custom.AddSlot", "Add slot flow completed", {
        cabinetId: slotInfo.cabinetId,
        drawerType,
        zone: slotInfo.zone,
        key: slotInfo.key,
        zoneIndex: slotInfo.zoneIndex,
        placementType: slotInfo.placementType,
        selectedType,
      });
    });

    const onOccupiedHandler = setOnOccupiedSlotClick(async (slotInfo) => {
      const drawerType = slotInfo.drawerType ?? activeDrawerType;
      recordDividerUiDebug("Custom.OccupiedSlot", "Remove occupied divider requested", {
        slotInfo: summarizeDividerSlotInfo(slotInfo),
        drawerType,
      });
      await saveSnapshot();
      await removeDividerFromSlot(slotInfo);
      if (drawerType) {
        await syncPlacedDividersForDrawer(slotInfo.cabinetId, drawerType);
        refreshDividerOverlay(slotInfo.cabinetId, drawerType);
        void refreshDividerOptionsAvailability(slotInfo.cabinetId, drawerType);
        recordDividerUiDebug("Custom.OccupiedSlot", "Remove occupied divider completed", {
          cabinetId: slotInfo.cabinetId,
          drawerType,
          zone: slotInfo.zone,
          key: slotInfo.key,
          zoneIndex: slotInfo.zoneIndex,
          dividerType: slotInfo.dividerType,
          stateId: slotInfo.stateId,
        });
      } else {
        warnDividerUiDebug("Custom.OccupiedSlot", "Drawer type missing after remove request", {
          slotInfo: summarizeDividerSlotInfo(slotInfo),
          activeDrawerType,
        });
      }
    });

    if (!onAddHandler && !onOccupiedHandler) {
      warnDividerUiDebug("Custom.DividerEffect", "Falling back to legacy divider slot click handler");
      setDividerSlotClickHandler(async (slotInfo) => {
        if ("isOccupied" in slotInfo && slotInfo.isOccupied) {
          recordDividerUiDebug("Custom.LegacySlot", "Legacy occupied slot remove requested", {
            slotInfo: summarizeDividerSlotInfo(slotInfo),
          });
          await saveSnapshot();
          await removeDividerFromSlot(slotInfo);
          await syncPlacedDividersForDrawer(slotInfo.cabinetId, slotInfo.drawerType);
          refreshDividerOverlay(slotInfo.cabinetId, slotInfo.drawerType);
          void refreshDividerOptionsAvailability(slotInfo.cabinetId, slotInfo.drawerType);
          recordDividerUiDebug("Custom.LegacySlot", "Legacy occupied slot remove completed", {
            slotInfo: summarizeDividerSlotInfo(slotInfo),
          });
          return;
        }

        const addSlotInfo = slotInfo as {
          cabinetId: string;
          drawerType: "Top" | "TopFull" | "Bot";
          zone: string;
          key: string;
          availableTypes?: string[];
          zoneIndex?: number;
          placementType?: DividerType | null;
          canPlace?: boolean;
          disabledReason?: "select-divider" | "does-not-fit" | "no-space" | null;
        };

        const available = normalizeDividerTypes(
          addSlotInfo.availableTypes?.length ? addSlotInfo.availableTypes : getAvailableDividerTypes(addSlotInfo),
        );

        const normalizedAddSlotInfo = {
          ...addSlotInfo,
          availableTypes: available,
        };

        const placementWarning = buildDividerPlacementWarning(selectedDividerType, available);
        const selectedType = resolveDividerType(available);

        const drawerType = normalizedAddSlotInfo.drawerType ?? activeDrawerType;
        recordDividerUiDebug("Custom.LegacySlot", "Resolved legacy add slot decision", {
          slotInfo: summarizeDividerSlotInfo(normalizedAddSlotInfo),
          available,
          selectedDividerType,
          selectedType,
          drawerType,
          zoneIndex: normalizedAddSlotInfo.zoneIndex,
          placementType: normalizedAddSlotInfo.placementType,
          canPlace: normalizedAddSlotInfo.canPlace,
          disabledReason: normalizedAddSlotInfo.disabledReason,
        });

        if (normalizedAddSlotInfo.canPlace === false || placementWarning || !selectedType) {
          const userMessage =
            placementWarning ?? "Selected Divider does not fit here. Choose another available option.";
          setDividerPlacementWarning(userMessage);
          console.warn("[Dividers] selected divider type is not available for legacy add slot");
          warnDividerUiDebug(
            "Custom.LegacySlot",
            selectedDividerType
              ? "Selected divider type is not available for legacy add slot"
              : "Divider type is not selected for legacy add slot",
            {
              slotInfo: summarizeDividerSlotInfo(normalizedAddSlotInfo),
              available,
              selectedDividerType,
              zoneIndex: normalizedAddSlotInfo.zoneIndex,
              placementType: normalizedAddSlotInfo.placementType,
              canPlace: normalizedAddSlotInfo.canPlace,
              disabledReason: normalizedAddSlotInfo.disabledReason,
              userMessage,
            },
          );
          return;
        }

        if (!drawerType) {
          console.warn("[Dividers] drawerType not resolved for legacy add slot");
          warnDividerUiDebug("Custom.LegacySlot", "Drawer type not resolved for legacy add slot", {
            slotInfo: summarizeDividerSlotInfo(normalizedAddSlotInfo),
            activeDrawerType,
          });
          return;
        }

        setDividerPlacementWarning(null);
        await saveSnapshot();
        recordDividerUiDebug("Custom.LegacySlot", "Legacy place divider request prepared", {
          cabinetId: normalizedAddSlotInfo.cabinetId,
          drawerType,
          zone: normalizedAddSlotInfo.zone,
          key: normalizedAddSlotInfo.key,
          zoneIndex: normalizedAddSlotInfo.zoneIndex,
          placementType: normalizedAddSlotInfo.placementType,
          selectedType,
        });
        await placeDividerToSlot({ ...normalizedAddSlotInfo, drawerType }, selectedType);
        await syncPlacedDividersForDrawer(normalizedAddSlotInfo.cabinetId, drawerType);
        refreshDividerOverlay(normalizedAddSlotInfo.cabinetId, drawerType);
        void refreshDividerOptionsAvailability(normalizedAddSlotInfo.cabinetId, drawerType);
        recordDividerUiDebug("Custom.LegacySlot", "Legacy add slot completed", {
          cabinetId: normalizedAddSlotInfo.cabinetId,
          drawerType,
          zone: normalizedAddSlotInfo.zone,
          key: normalizedAddSlotInfo.key,
          zoneIndex: normalizedAddSlotInfo.zoneIndex,
          placementType: normalizedAddSlotInfo.placementType,
          selectedType,
        });
      });
    }
  }, [
    activeCabinetId,
    activeDrawerType,
    dispatch,
    dividerSelection,
    selectedDividerType,
    resolveDividerType,
    saveSnapshot,
    isPlayCanvasReady,
    refreshDividerOverlay,
    refreshDividerOptionsAvailability,
    syncPlacedDividersForDrawer,
  ]);

  useEffect(() => {
    if (towelSelection !== "None") return;

    setConfigBatch(
      {},
      {
        TowelBar: "None",
        TowelBarSide: "both",
      },
    );
  }, [towelSelection]);

  const handleSidePanelsChange = async (value: string) => {
    if (!value) return;
    if (!isGrooveType(value)) return;
    if (sidePanelsBlockedByLength340 && value !== "None") return;
    if (value !== "None" && !sidePanelAvailability.allowed.has(value)) return;
    if (value !== "None") {
      const totalAfter = computeTotalAfterSpChange(value);
      if (totalAfter !== null && !lengthGuard.canAccommodateTotal(totalAfter)) return;
    }

    await saveSnapshot();

    await applyGroove(dispatch, value, resolvedSpSide, selectedProducts.length);
  };

  const handleDividersChange = async (value: string | null) => {
    recordDividerUiDebug("Custom.DividerSelection", "Divider option change requested", {
      value,
      previous: dividerSelection,
      activeDrawerType,
      activeCabinetId,
    });
    if (!value) return;
    if (value === dividerSelection && value !== "None") {
      recordDividerUiDebug("Custom.DividerSelection", "Skip unchanged divider option", { value });
      return;
    }
    if (value === dividerSelection) {
      recordDividerUiDebug("Custom.DividerSelection", "Re-apply None to clear scene dividers", { value });
    }

    setDividerPlacementWarning(null);
    await saveSnapshot();

    if (value === "None") {
      const clearResult = await clearPlacedDividersInScene(selectedProducts);
      recordDividerUiDebug("Custom.DividerSelection", "Scene dividers cleared for None option", clearResult);
      dispatch(clearPlacedDividers());

      const exitTopView = wrapExitTopView({
        onExit: () => {
          restoreDrawerCameraMode(false);

          console.log("[Drawer] exitTopView triggered by Dividers None");
          setActiveDrawerType(null);
          dispatch(setIsDrawerOpen(false));
        },
      });

      if (exitTopView) {
        await Promise.resolve(exitTopView());
      } else {
        console.warn("[Drawer] exitTopView not ready");
        warnDividerUiDebug("Custom.DividerSelection", "exitTopView not ready while switching to None");
      }

      setDividerAvailability(null);
    }

    if (value === "Customize") {
      setVisibleDrawerButtons(true);
    } else {
      setVisibleDrawerButtons(false);
      setVisibleDividerSlotButtons(false);

      dispatch(setIsDrawerOpen(false));
    }

    dispatch(setDividersOption(value));

    if (value !== "Customize") {
      dispatch(setDividersStyle(""));
    }
    recordDividerUiDebug("Custom.DividerSelection", "Divider option change applied", {
      value,
    });
  };

  const handleDividerStyleChange = async (value: string) => {
    recordDividerUiDebug("Custom.DividerStyle", "Divider style change requested", {
      value,
      previous: dividerStyle,
      availableDividerTypes: availableDividerTypes ? Array.from(availableDividerTypes) : null,
    });
    if (!value) return;
    if (value === dividerStyle) {
      recordDividerUiDebug("Custom.DividerStyle", "Skip unchanged divider style", { value });
      return;
    }
    const dividerType = getDividerTypeFromOptionTitle(value);
    if (availableDividerTypes && dividerType && !availableDividerTypes.has(dividerType)) {
      const availableTypes = Array.from(availableDividerTypes);
      const userMessage = buildUnavailableDividerWarning(dividerType, availableTypes);
      setDividerPlacementWarning(userMessage);
      warnDividerUiDebug("Custom.DividerStyle", "Blocked unavailable divider style", {
        value,
        dividerType,
        availableDividerTypes: availableTypes,
        userMessage,
      });
      return;
    }
    setDividerPlacementWarning(null);
    await saveSnapshot();
    dispatch(setDividersStyle(value));
    recordDividerUiDebug("Custom.DividerStyle", "Divider style change applied", {
      value,
      dividerType,
    });

    if (dividerType && activeCabinetId && activeDrawerType && dividerSelection === "Customize") {
      refreshDividerOverlay(activeCabinetId, activeDrawerType, dividerType);
    }
  };

  const handleTowelBarChange = async (value: string | null) => {
    if (!value) return;

    await saveSnapshot();
    const isNone = value === "None";
    const side = value.toLowerCase() as "left" | "right" | "both";

    // Force-remove existing towel bars first so side switches (e.g. Left -> Right)
    // do not keep stale meshes enabled in the scene.
    await setConfigBatch(
      {},
      {
        TowelBar: "None",
        TowelBarSide: "both",
      },
    );

    if (!isNone) {
      await setConfigBatch(
        {},
        {
          TowelBar: "TowelBar40_R",
          TowelBarSide: side,
        },
      );
    }

    if (isNone) {
      dispatch(setTowelBarColor(""));
    }

    dispatch(setTowelBarOption(value));
  };

  const handleTowelBarColorChange = async (value?: string) => {
    if (!value) return;
    await saveSnapshot();

    setConfigBatch(
      {},
      {
        TowelBarColor: value,
      },
    );

    dispatch(setTowelBarColor(value));
  };

  const handleAccordionChange = (value: string) => {
    setActiveAccordionId(value || null);

    if (value === DIVIDERS_ACCORDION_ID) {
      setVisibleDrawerButtons(dividerSelection === "Customize");
      return;
    }

    setVisibleDrawerButtons(false);

    const exitTopView = wrapExitTopView({});
    if (exitTopView) exitTopView();
  };

  const ACCORDIONS: AccordionConfig[] = [
    {
      id: DEFAULT_ACCORDION_ID,
      title: "Side Panels",
      defaultOpen: true,
      content: (
        <>
          {sidePanelsBlockedByLength340 ? (
            <p style={{ margin: 0, padding: "12px 0", fontSize: 14, color: "#4a5568" }}>{sidePanelsLengthReason}</p>
          ) : sidePanelAvailability.reason ? (
            <p style={{ margin: 0, padding: "12px 0", fontSize: 14, color: "#4a5568" }}>
              {sidePanelAvailability.reason}
            </p>
          ) : activeCabinetId && !isEdgeCabinet ? (
            <p style={{ margin: 0, padding: "12px 0", fontSize: 14, color: "#4a5568" }}>
              Side panels can only be installed on edge cabinets.
            </p>
          ) : (
            <ProductOptionsGrid
              data={sidePanelOptions}
              handleAdd={handleSidePanelsChange}
              activeValue={activeSidePanels}
            />
          )}
        </>
      ),
    },
    {
      id: DIVIDERS_ACCORDION_ID,
      title: "Dividers",
      content: (
        <>
          <ProductSwatchesGrid
            data={optionsSwatchData2}
            onSelectChange={handleDividersChange}
            selectedValue={dividerSelection}
          />
          {dividerSelection === "Customize" && (
            <>
              {!selectedDividerType && (
                <p style={DIVIDER_SELECT_TYPE_HINT_STYLE}>Select a Divider type first to show placement points.</p>
              )}
              {dividerPlacementWarning && (
                <p role="alert" style={DIVIDER_PLACEMENT_WARNING_STYLE}>
                  {dividerPlacementWarning}
                </p>
              )}
              <ProductOptionsGrid
                data={dividerOptions}
                handleAdd={handleDividerStyleChange}
                activeValue={dividerStyle}
              />
            </>
          )}
        </>
      ),
    },
    {
      id: "tovel-bar",
      title: "Towel Bar",
      content: (
        <>
          <ProductSwatchesGrid
            data={optionsSwatchDataTowel}
            onSelectChange={handleTowelBarChange}
            selectedValue={towelSelection}
          />
          {towelSelection && towelSelection !== "None" && (
            <ProductOptionsGrid
              data={towelBarOptionsFromApi}
              handleAdd={handleTowelBarColorChange}
              activeValue={towelBarColor}
              groupByDesc
            />
          )}
        </>
      ),
    },
  ];

  return (
    <div className="accessoriesPage">
      <ConfiguratorAccordionGroup
        defaultValue={ACCORDIONS.find((accordion) => accordion.defaultOpen)?.id.toString()}
        onValueChange={handleAccordionChange}
      >
        {ACCORDIONS.map(({ id, title, content }) => (
          <ConfiguratorAccordionItem key={id} value={id.toString()} title={title}>
            {content}
          </ConfiguratorAccordionItem>
        ))}
      </ConfiguratorAccordionGroup>
    </div>
  );
};
