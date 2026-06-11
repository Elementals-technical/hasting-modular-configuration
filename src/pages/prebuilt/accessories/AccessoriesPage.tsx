import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import {
  getCompositionVersion,
  getDividersOption,
  getDividersStyle,
  getPlacedCabinetStyles,
  getProductsPresets,
  getSelectedDimensions,
  getSelectedDividerType,
  getSelectedProductConfig,
  getSelectedProducts,
  getSelectedSceneProduct,
  getSidePanelsOption,
  getTowelBarColor,
  getTowelBarOption,
} from "@/entities/product/model/store/selectors";
import { selectSidePanelAvailability } from "@/entities/product/model/store/derivedSelectors";
import { sidePanelAvailabilityRule } from "@/features/configurator-rule-core/options";
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
import {
  applyGroove,
  autoRemoveBoth,
  buildSidePanelEdgeState,
  getSidePanelLeftStatus,
  getSidePanelRightStatus,
  isGrooveType,
  resolveSidePanelAvailabilityForEdges,
  resolveSidePanelTargetSide,
  resolveSidePanelBlock,
  resolveSidePanelNotice,
  resolveSidePanelGridActiveValue,
  resolveSidePanelSyncPrompt,
  isSidePanelGrooveAvailableForSide,
  isSidePanelLengthBlocked,
  SidePanelNoticeBox,
  SidePanelSyncConfirmModal,
  type SidePanelReasonCtx,
  type SidePanelSyncPrompt,
  type SidePanelApplySide,
  type GrooveType,
} from "@/features/sidePanel";
import { getEdgeCabinets, type EdgeCabinets } from "@/utils/functions/playcanvas/getEdgeCabinets";
import {
  getAvailableDividerTypes,
  getAvailableDividerTypesForDrawer,
  clearPlacedDividersInScene,
  getDividerTypeFromOptionTitle,
  getPlacedDividersForDrawer,
  placeDividerToSlot,
  createDividerUiTraceId,
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
import { exportCameraState, importCameraState, setAutoFraming } from "@/utils/functions/playcanvas/camera";
import { useDividerResizeOverlayRestore } from "@/utils/functions/playcanvas/dividers/useDividerResizeOverlayRestore";
import {
  buildDividerPlacementWarning,
  buildUnavailableDividerWarning,
  deriveDividerOptions,
  dividerTypeSetsEqual,
  normalizeDividerType,
  normalizeDividerTypes,
} from "@/features/dividers/model";
import { getActiveDrawerRuntimeContext } from "@/features/dividers/adapter";

import { dividersMockData, optionsSidePanelsData, optionsSwatchData2, optionsSwatchDataTowel } from "./constants";
import { useGetConfiguratorQuery } from "@/entities";
import {
  formatSidePanelsExceedMaxReason,
  useCountertopLengthGuard,
} from "@/features/configurator-rule-core/countertop";
import { setVisibleDrawerButtons } from "@/utils/functions/playcanvas/setVisibleDrawerButtons.ts";
import { onDrawerCloseWidgetRender, onDrawerWidgetRender } from "@/utils/functions/playcanvas/drawerWidgetRenderers";

const DEFAULT_ACCORDION_ID = "side-panels";
const DIVIDERS_ACCORDION_ID = "dividers";

const EMPTY_EDGE_CABINETS: EdgeCabinets = { leftCabinetId: null, rightCabinetId: null };
const SIDE_PANEL_MESSAGE_STYLE: CSSProperties = { margin: 0, padding: "12px 0", fontSize: 14, color: "#4a5568" };

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

const DIVIDER_CUSTOMIZE_SECTION_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginTop: 10,
};

const DIVIDER_TYPE_HEADER_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const DIVIDER_TYPE_LABEL_STYLE = {
  margin: 0,
  color: "#282828",
  fontFamily: "Poppins",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: "16px",
};

const DIVIDER_SELECT_TYPE_HINT_STYLE = {
  margin: 0,
  color: "#4a5568",
  fontFamily: "Poppins",
  fontSize: 12,
  fontWeight: 500,
  lineHeight: "16px",
};

const DIVIDER_OPEN_DRAWER_HINT_STYLE = {
  margin: "2px 0 0", 
  color: "#8b3f24",
  fontFamily: "Poppins",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: "16px",
};

export const AccessoriesPage = () => {
  const dispatch = useAppDispatch();
  const saveSnapshot = useHistorySnapshot();
  const towelSelection = useAppSelector(getTowelBarOption);
  const dividerSelection = useAppSelector(getDividersOption);
  const dividerStyle = useAppSelector(getDividersStyle);
  const activeSidePanels = useAppSelector(getSidePanelsOption);
  const towelBarColor = useAppSelector(getTowelBarColor);
  const selectedSceneProduct = useAppSelector(getSelectedSceneProduct);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const selectedProductOrderKey = selectedProducts.join("|");
  const placedCabinetStyles = useAppSelector(getPlacedCabinetStyles);
  const productsPresets = useAppSelector(getProductsPresets);
  const lengthGuard = useCountertopLengthGuard(selectedProducts);
  const sidePanelLeft = useAppSelector(getSidePanelLeftStatus);
  const sidePanelRight = useAppSelector(getSidePanelRightStatus);
  const sidePanelsBlockedByLength340 = isSidePanelLengthBlocked(lengthGuard.currentCabinetOnly);
  const isPlayCanvasReady = usePlayCanvasReady();

  // Edge cabinets are read imperatively from PlayCanvas, whose composition order
  // settles asynchronously after add/remove/swap. Re-read AFTER the scene settles,
  // keyed on compositionVersion, to avoid stale edge state.
  const compositionVersion = useAppSelector(getCompositionVersion);
  const [edgeCabinets, setEdgeCabinets] = useState<EdgeCabinets>(EMPTY_EDGE_CABINETS);

  useEffect(() => {
    const applyEdges = () => {
      const next =
        !isPlayCanvasReady || selectedProductOrderKey.length === 0 ? EMPTY_EDGE_CABINETS : getEdgeCabinets();
      setEdgeCabinets((prev) =>
        prev.leftCabinetId === next.leftCabinetId && prev.rightCabinetId === next.rightCabinetId ? prev : next,
      );
    };

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(applyEdges);
    });
    const settleTimer = window.setTimeout(applyEdges, 250);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(settleTimer);
    };
  }, [isPlayCanvasReady, selectedProductOrderKey, compositionVersion]);

  const sidePanelEdgeState = useMemo(
    () => buildSidePanelEdgeState(edgeCabinets, selectedSceneProduct),
    [edgeCabinets, selectedSceneProduct],
  );

  const resolvedSpSide = useMemo(
    () =>
      resolveSidePanelTargetSide({
        edgeState: sidePanelEdgeState,
        selectedCabinetId: selectedSceneProduct,
        cabinetCount: selectedProducts.length,
      }),
    [selectedSceneProduct, selectedProducts.length, sidePanelEdgeState],
  );

  /** Projected total countertop width after applying the given groove value. */
  const computeTotalAfterSpChange = useCallback(
    (value: string): number | null => {
      if (lengthGuard.currentCabinetOnly === null) return null;
      if (value === "None" || resolvedSpSide === null) return lengthGuard.currentCabinetOnly;
      const leftAfter = resolvedSpSide !== "right" || sidePanelLeft === "active";
      const rightAfter = resolvedSpSide !== "left" || sidePanelRight === "active";
      const plannedSpCm = (leftAfter ? 1 : 0) + (rightAfter ? 1 : 0);
      return lengthGuard.currentCabinetOnly + plannedSpCm;
    },
    [lengthGuard.currentCabinetOnly, resolvedSpSide, sidePanelLeft, sidePanelRight],
  );
  const [activeDrawerType, setActiveDrawerType] = useState<DrawerType | null>(null);
  const [activeAccordionId, setActiveAccordionId] = useState<string | null>(DEFAULT_ACCORDION_ID);
  const [pendingSidePanelSyncChange, setPendingSidePanelSyncChange] = useState<SidePanelSyncPrompt | null>(null);
  const [dividerAvailability, setDividerAvailability] = useState<{
    cabinetId: string;
    drawerType: DrawerType;
    types: Set<DividerType> | null;
  } | null>(null);
  const [dividerPlacementWarning, setDividerPlacementWarning] = useState<string | null>(null);
  const drawerCameraStateRef = useRef<Record<string, unknown> | null>(null);
  const isDrawerCameraManagedRef = useRef(false);

  const selectedDividerType = useAppSelector(getSelectedDividerType);
  // Bridge only — kept in sync from the redux SSOT; removed by the controller migration (T5).
  const selectedDividerTypeRef = useRef<DividerType | null>(selectedDividerType);
  selectedDividerTypeRef.current = selectedDividerType;

  const resolveDividerType = useCallback(
    (available: string[], dividerType: DividerType | null = selectedDividerTypeRef.current) => {
      if (dividerType) {
        return available.includes(dividerType) ? dividerType : null;
      }

      return null;
    },
    [],
  );

  const getResolvedActiveDividerContext = useCallback(() => {
    const runtime = getActiveDrawerRuntimeContext();

    return {
      cabinetId: runtime.cabinetId || selectedSceneProduct || null,
      drawerType: runtime.drawerType || activeDrawerType || null,
      runtimeCabinetId: runtime.cabinetId,
      runtimeDrawerType: runtime.drawerType,
      stateCabinetId: selectedSceneProduct || null,
      stateDrawerType: activeDrawerType,
    };
  }, [activeDrawerType, selectedSceneProduct]);

  const getDividerAvailabilityForContext = useCallback(
    (cabinetId: string | null | undefined, drawerType: DrawerType | null | undefined) => {
      const matchesAvailability = Boolean(
        dividerAvailability &&
          cabinetId &&
          drawerType &&
          dividerAvailability.cabinetId === cabinetId &&
          dividerAvailability.drawerType === drawerType,
      );
      const types = matchesAvailability ? dividerAvailability?.types ?? null : null;

      return {
        types,
        availableTypes: types ? Array.from(types) : null,
        source: matchesAvailability ? "dividerAvailability" : "none",
        requestedCabinetId: cabinetId ?? null,
        requestedDrawerType: drawerType ?? null,
        availabilityCabinetId: dividerAvailability?.cabinetId ?? null,
        availabilityDrawerType: dividerAvailability?.drawerType ?? null,
        hasAvailabilityTypes: Boolean(types),
      };
    },
    [dividerAvailability],
  );

  const setResolvedDividerAvailability = useCallback(
    (cabinetId: string, drawerType: DrawerType, types: Set<DividerType> | null) => {
      setDividerAvailability((current) => {
        if (
          current &&
          current.cabinetId === cabinetId &&
          current.drawerType === drawerType &&
          dividerTypeSetsEqual(current.types, types)
        ) {
          return current;
        }

        return { cabinetId, drawerType, types };
      });
    },
    [],
  );

  const refreshDividerOptionsAvailability = useCallback(
    async (cabinetId = selectedSceneProduct, drawerType = activeDrawerType) => {
      if (!isPlayCanvasReady || dividerSelection !== "Customize" || !cabinetId || !drawerType) return;

      const types = await getAvailableDividerTypesForDrawer(cabinetId, drawerType);
      setResolvedDividerAvailability(cabinetId, drawerType, types);
    },
    [activeDrawerType, dividerSelection, isPlayCanvasReady, selectedSceneProduct, setResolvedDividerAvailability],
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
    (cabinetId = selectedSceneProduct, drawerType = activeDrawerType, dividerType = selectedDividerType) => {
      if (!isPlayCanvasReady || dividerSelection !== "Customize" || !cabinetId || !drawerType) return null;

      const availability = getDividerAvailabilityForContext(cabinetId, drawerType);
      if (dividerType && availability.types && !availability.types.has(dividerType)) {
        const availableTypes = availability.availableTypes ?? [];
        const userMessage = buildUnavailableDividerWarning(dividerType, availableTypes);
        setDividerPlacementWarning(userMessage);
        return null;
      }

      const options = {
        show: true,
        selectedDividerType: dividerType,
        debugRequestId: createDividerUiTraceId("prebuilt-overlay"),
      };

      recordDividerUiDebug("Prebuilt.DividerEffect", "Refresh divider overlay with selected type", {
        cabinetId,
        drawerType,
        selectedDividerType: dividerType,
        debugRequestId: options.debugRequestId,
        options,
      });

      return showIconDividerSlots(cabinetId, drawerType, options);
    },
    [
      activeDrawerType,
      dividerSelection,
      getDividerAvailabilityForContext,
      isPlayCanvasReady,
      selectedDividerType,
      selectedSceneProduct,
    ],
  );

  useDividerResizeOverlayRestore({
    stagePrefix: "Prebuilt",
    isPlayCanvasReady,
    dividerSelection,
    activeCabinetId: selectedSceneProduct,
    selectedDividerType,
    shouldRestoreDrawerButtons: activeAccordionId === DIVIDERS_ACCORDION_ID,
    setActiveDrawerType,
    refreshDividerOverlay,
    refreshDividerOptionsAvailability,
  });

  useEffect(() => {
    if (!isPlayCanvasReady || dividerSelection !== "Customize") return;

    const resolvedContext = getResolvedActiveDividerContext();
    const cabinetId = resolvedContext.cabinetId;
    const drawerType = resolvedContext.drawerType;

    recordDividerUiDebug("Prebuilt.DividerResizeRefresh", "Evaluate divider overlay refresh after dimension change", {
      selectedSceneProduct,
      activeDrawerType,
      selectedDividerType,
      selectedDimensions,
    });

    if (!cabinetId || !drawerType) {
      warnDividerUiDebug("Prebuilt.DividerResizeRefresh", "Skip refresh because active drawer is not resolved", {
        selectedSceneProduct,
        activeDrawerType,
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
    activeDrawerType,
    dividerSelection,
    getResolvedActiveDividerContext,
    isPlayCanvasReady,
    refreshDividerOptionsAvailability,
    refreshDividerOverlay,
    selectedDimensions.depth,
    selectedDimensions.width,
    selectedDividerType,
    selectedSceneProduct,
  ]);

  useEffect(() => {
    if (!isPlayCanvasReady || dividerSelection !== "Customize" || !selectedSceneProduct || !activeDrawerType) return;

    let isCurrent = true;
    const cabinetId = selectedSceneProduct;
    const drawerType = activeDrawerType;

    void getAvailableDividerTypesForDrawer(cabinetId, drawerType).then((types) => {
      if (!isCurrent) return;
      setResolvedDividerAvailability(cabinetId, drawerType, types);
    });

    return () => {
      isCurrent = false;
    };
  }, [activeDrawerType, dividerSelection, isPlayCanvasReady, selectedSceneProduct, setResolvedDividerAvailability]);

  useEffect(() => {
    if (!isPlayCanvasReady) return;

    setVisibleDrawerButtons(activeAccordionId === DIVIDERS_ACCORDION_ID && dividerSelection === "Customize");
  }, [activeAccordionId, dividerSelection, isPlayCanvasReady]);

  const availableDividerTypes = useMemo(() => {
    if (!dividerAvailability || dividerSelection !== "Customize") {
      return null;
    }

    const stateMatches =
      selectedSceneProduct &&
      activeDrawerType &&
      dividerAvailability.cabinetId === selectedSceneProduct &&
      dividerAvailability.drawerType === activeDrawerType;
    if (stateMatches) {
      return dividerAvailability.types;
    }

    const resolvedContext = getResolvedActiveDividerContext();
    const runtimeMatches =
      resolvedContext.cabinetId &&
      resolvedContext.drawerType &&
      dividerAvailability.cabinetId === resolvedContext.cabinetId &&
      dividerAvailability.drawerType === resolvedContext.drawerType;
    if (runtimeMatches) {
      return dividerAvailability.types;
    }

    return null;
  }, [
    activeDrawerType,
    dividerAvailability,
    dividerSelection,
    getResolvedActiveDividerContext,
    selectedSceneProduct,
  ]);

  const dividerOptions = useMemo(() => deriveDividerOptions(dividersMockData, availableDividerTypes), [availableDividerTypes]);

  useEffect(() => {
    if (dividerSelection !== "Customize" || !selectedDividerType) return;

    const resolvedContext = getResolvedActiveDividerContext();
    const availability = getDividerAvailabilityForContext(resolvedContext.cabinetId, resolvedContext.drawerType);
    if (!availability.types || availability.types.has(selectedDividerType)) return;

    const availableTypes = availability.availableTypes ?? [];
    const userMessage = buildUnavailableDividerWarning(selectedDividerType, availableTypes);
    setDividerPlacementWarning(userMessage);

    if (resolvedContext.cabinetId && resolvedContext.drawerType) {
      showIconDividerSlots(resolvedContext.cabinetId, resolvedContext.drawerType, {
        show: true,
        selectedDividerType: null,
      });
    }
  }, [
    dividerSelection,
    getDividerAvailabilityForContext,
    getResolvedActiveDividerContext,
    selectedDividerType,
  ]);

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

  const { data: configuratorData } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });

  const selectorAvailability = useAppSelector(selectSidePanelAvailability);
  const sidePanelFallbackEdgeDrawers = sidePanelEdgeState.eligibleFallbackEdgeId
    ? placedCabinetStyles[sidePanelEdgeState.eligibleFallbackEdgeId]
    : null;
  const selectedConfigDrawers =
    typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : null;
  const selectedConfigHeight =
    typeof selectedProductConfig?.Height === "number" ? selectedProductConfig.Height : null;

  const sidePanelAvailability = useMemo(() => {
    const selectedAvailability = (() => {
      if (selectorAvailability.allowed.size > 0) return selectorAvailability;
      if (selectorAvailability.reason) return selectorAvailability;

      // Only fall back to presets when no cabinet has been clicked yet
      if (selectedSceneProduct) return selectorAvailability;

      const firstPreset = productsPresets[0];
      if (!firstPreset) return selectorAvailability;

      const name = firstPreset.name ?? null;
      const cabinetType =
        name === "Side-Shelf" || name === "OSS"
          ? "OSS"
          : name === "Open-Shelf" || name === "OS"
            ? "OS"
            : name === "Sink-Base" || name === "Sink-Cabinet" || name === "Side-Cabinet" || name === "SB" || name === "SC"
              ? "SBSC"
              : null;

      const drawers = firstPreset.Drawers ?? null;
      const handleType =
        drawers === "1D" || drawers === "1DWID" || drawers === "1" || drawers === "1+inner"
          ? "1D"
          : drawers === "2D" || drawers === "2"
            ? "2D"
            : null;

      const height = firstPreset.Height ?? null;

      return sidePanelAvailabilityRule({ height, handleType, cabinetType });
    })();

    return resolveSidePanelAvailabilityForEdges({
      selectedAvailability,
      edgeState: sidePanelEdgeState,
      height: selectedDimensions.height ?? selectedConfigHeight,
      edgeDrawers: sidePanelFallbackEdgeDrawers ?? selectedConfigDrawers,
    });
  }, [
    selectorAvailability,
    productsPresets,
    selectedSceneProduct,
    selectedDimensions.height,
    selectedConfigHeight,
    selectedConfigDrawers,
    sidePanelEdgeState,
    sidePanelFallbackEdgeDrawers,
  ]);

  // Data-driven Side Panel messaging: panel-level block (hides grid) + non-blocking notice.
  const sidePanelReasonCtx = useMemo<SidePanelReasonCtx>(
    () => ({
      cabinetCount: selectedProducts.length,
      hasSelectedCabinet: !!selectedSceneProduct,
      isEdgeCabinet: sidePanelEdgeState.isSelectedEdge,
      cabinetOnlyLength: lengthGuard.currentCabinetOnly,
      availability: sidePanelAvailability,
    }),
    [
      selectedProducts.length,
      selectedSceneProduct,
      sidePanelEdgeState.isSelectedEdge,
      lengthGuard.currentCabinetOnly,
      sidePanelAvailability,
    ],
  );
  const sidePanelBlock = resolveSidePanelBlock(sidePanelReasonCtx);
  const sidePanelNotice = useMemo(
    () =>
      resolveSidePanelNotice({
        cabinetCount: selectedProducts.length,
        selectedCabinetId: selectedSceneProduct,
        edgeState: sidePanelEdgeState,
        targetSide: resolvedSpSide,
      }),
    [resolvedSpSide, selectedProducts.length, selectedSceneProduct, sidePanelEdgeState],
  );

  const sidePanelGridActiveValue = useMemo(
    () =>
      resolveSidePanelGridActiveValue({
        targetSide: resolvedSpSide,
        groove: activeSidePanels,
        leftStatus: sidePanelLeft,
        rightStatus: sidePanelRight,
      }),
    [activeSidePanels, resolvedSpSide, sidePanelLeft, sidePanelRight],
  );

  const getSidePanelEdgeDrawers = useCallback(
    (side: "left" | "right") => {
      const edgeId = side === "left" ? sidePanelEdgeState.leftCabinetId : sidePanelEdgeState.rightCabinetId;
      return edgeId ? (placedCabinetStyles[edgeId] ?? null) : null;
    },
    [placedCabinetStyles, sidePanelEdgeState.leftCabinetId, sidePanelEdgeState.rightCabinetId],
  );

  const canSidePanelSideAcceptGroove = useCallback(
    (side: "left" | "right", groove: GrooveType) =>
      isSidePanelGrooveAvailableForSide({
        edgeState: sidePanelEdgeState,
        side,
        groove,
        height: selectedDimensions.height ?? selectedConfigHeight,
        edgeDrawers: getSidePanelEdgeDrawers(side) ?? selectedConfigDrawers,
      }),
    [
      getSidePanelEdgeDrawers,
      selectedConfigDrawers,
      selectedConfigHeight,
      selectedDimensions.height,
      sidePanelEdgeState,
    ],
  );

  const sidePanelOptions = useMemo(() => {
    if (sidePanelsBlockedByLength340) {
      return optionsSidePanelsData.filter((option) => option.metadata?.value === "None");
    }

    const isSyntesiBlocked =
      sidePanelAvailability.allowed.size === 0 && sidePanelAvailability.reasonCode === "syntesi-countertop";

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
      const label = document.createElement("span");
      label.textContent = "Open Drawer";
      const plus = document.createElement("span");
      plus.textContent = "+";
      plus.setAttribute("aria-hidden", "true");
      plus.style.width = "14px";
      plus.style.height = "14px";
      plus.style.borderRadius = "999px";
      plus.style.background = "rgba(255,255,255,0.22)";
      plus.style.display = "inline-flex";
      plus.style.alignItems = "center";
      plus.style.justifyContent = "center";
      plus.style.fontSize = "11px";
      plus.style.fontWeight = "700";
      plus.style.lineHeight = "1";
      button.style.background = "#A05535";
      button.style.color = "#fff";
      button.style.border = "none";
      button.style.borderRadius = "999px";
      button.style.padding = "5px 8px 5px 12px";
      button.style.cursor = "pointer";
      button.style.display = "inline-flex";
      button.style.alignItems = "center";
      button.style.justifyContent = "center";
      button.style.gap = "5px";
      button.style.fontSize = "11px";
      button.style.lineHeight = "1.1";
      button.style.fontFamily = "Poppins, sans-serif";
      button.append(label, plus);
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

  useEffect(() => {
    if (!isPlayCanvasReady) return;

    const wrapped = wrapShowTopView({
      onSelect: (_, drawerType) => {
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

  useEffect(() => {
    const resolvedContext = getResolvedActiveDividerContext();
    const effectCabinetId = resolvedContext.cabinetId;
    const effectDrawerType = resolvedContext.drawerType;

    recordDividerUiDebug("Prebuilt.DividerEffect", "Evaluate divider overlay effect", {
      isPlayCanvasReady,
      dividerSelection,
      selectedSceneProduct,
      activeDrawerType,
      selectedDividerType,
    });

    if (!isPlayCanvasReady) {
      recordDividerUiDebug("Prebuilt.DividerEffect", "Skip because PlayCanvas is not ready");
      return;
    }

    if (dividerSelection !== "Customize") {
      recordDividerUiDebug("Prebuilt.DividerEffect", "Disable divider slot buttons because Customize is not selected", {
        dividerSelection,
      });
      setVisibleDividerSlotButtons(false);
      return;
    }

    setVisibleDividerSlotButtons(true);

    if (!effectCabinetId) {
      warnDividerUiDebug("Prebuilt.DividerEffect", "Skip because selectedSceneProduct is empty", {
        activeDrawerType,
      });
      return;
    }

    if (effectDrawerType) {
      if (effectDrawerType !== activeDrawerType) {
        setActiveDrawerType(effectDrawerType);
      }

      recordDividerUiDebug("Prebuilt.DividerEffect", "Show divider slots for active drawer", {
        selectedSceneProduct,
        activeDrawerType: effectDrawerType,
        selectedDividerType,
      });
      refreshDividerOverlay(effectCabinetId, effectDrawerType);
    }
    const onAddHandler = setOnAddSlotClick(async (slotInfo) => {
      const selectedDividerTypeAtClick = selectedDividerTypeRef.current;
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

      const placementWarning = buildDividerPlacementWarning(selectedDividerTypeAtClick, available);
      const selectedType = resolveDividerType(available, selectedDividerTypeAtClick);
      const drawerType = slotInfo.drawerType ?? activeDrawerType;

      recordDividerUiDebug("Prebuilt.AddSlot", "Resolved add slot decision", {
        slotInfo: summarizeDividerSlotInfo(slotInfo),
        available,
        selectedDividerType: selectedDividerTypeAtClick,
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
          "Prebuilt.AddSlot",
          selectedDividerTypeAtClick ? "Selected divider type is not available" : "Divider type is not selected",
          {
            slotInfo: summarizeDividerSlotInfo(slotInfo),
            available,
            selectedDividerType: selectedDividerTypeAtClick,
            zoneIndex: slotInfo.zoneIndex,
            placementType: slotInfo.placementType,
            canPlace: slotInfo.canPlace,
            disabledReason: slotInfo.disabledReason,
            userMessage,
          },
        );
        return;
      }

      if (slotInfo.placementType && selectedType !== slotInfo.placementType) {
        const userMessage = "Selected Divider does not match this placement slot. Choose the matching Divider option.";
        setDividerPlacementWarning(userMessage);
        return;
      }

      if (!drawerType) {
        console.warn("[Dividers] drawerType not resolved for add slot");
        warnDividerUiDebug("Prebuilt.AddSlot", "Drawer type not resolved", {
          slotInfo: summarizeDividerSlotInfo(slotInfo),
          activeDrawerType,
        });
        return;
      }

      setDividerPlacementWarning(null);
      await saveSnapshot();
      recordDividerUiDebug("Prebuilt.AddSlot", "Place divider request prepared", {
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
      refreshDividerOverlay(slotInfo.cabinetId, drawerType, selectedType);
      void refreshDividerOptionsAvailability(slotInfo.cabinetId, drawerType);
      recordDividerUiDebug("Prebuilt.AddSlot", "Add slot flow completed", {
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
      const selectedDividerTypeAtClick = selectedDividerTypeRef.current;
      const occupiedDividerType = normalizeDividerType(slotInfo.dividerType);
      const overlayRefreshDividerType = selectedDividerTypeAtClick ?? selectedDividerType ?? occupiedDividerType;
      recordDividerUiDebug("Prebuilt.OccupiedSlot", "Remove occupied divider requested", {
        slotInfo: summarizeDividerSlotInfo(slotInfo),
        drawerType,
        overlayRefreshDividerType,
      });
      await saveSnapshot();
      await removeDividerFromSlot(slotInfo);
      if (drawerType) {
        await syncPlacedDividersForDrawer(slotInfo.cabinetId, drawerType);
        refreshDividerOverlay(slotInfo.cabinetId, drawerType, overlayRefreshDividerType);
        void refreshDividerOptionsAvailability(slotInfo.cabinetId, drawerType);
        recordDividerUiDebug("Prebuilt.OccupiedSlot", "Remove occupied divider completed", {
          cabinetId: slotInfo.cabinetId,
          drawerType,
          zone: slotInfo.zone,
          key: slotInfo.key,
          zoneIndex: slotInfo.zoneIndex,
          dividerType: slotInfo.dividerType,
          stateId: slotInfo.stateId,
          overlayRefreshDividerType,
        });
      } else {
        warnDividerUiDebug("Prebuilt.OccupiedSlot", "Drawer type missing after remove request", {
          slotInfo: summarizeDividerSlotInfo(slotInfo),
          activeDrawerType,
        });
      }
    });

    if (!onAddHandler && !onOccupiedHandler) {
      warnDividerUiDebug("Prebuilt.DividerEffect", "Falling back to legacy divider slot click handler");
      setDividerSlotClickHandler(async (slotInfo) => {
        if ("isOccupied" in slotInfo && slotInfo.isOccupied) {
          const selectedDividerTypeAtClick = selectedDividerTypeRef.current;
          const occupiedDividerType = normalizeDividerType(slotInfo.dividerType);
          const overlayRefreshDividerType = selectedDividerTypeAtClick ?? selectedDividerType ?? occupiedDividerType;
          recordDividerUiDebug("Prebuilt.LegacySlot", "Legacy occupied slot remove requested", {
            slotInfo: summarizeDividerSlotInfo(slotInfo),
            overlayRefreshDividerType,
          });
          await saveSnapshot();
          await removeDividerFromSlot(slotInfo);
          await syncPlacedDividersForDrawer(slotInfo.cabinetId, slotInfo.drawerType);
          refreshDividerOverlay(slotInfo.cabinetId, slotInfo.drawerType, overlayRefreshDividerType);
          void refreshDividerOptionsAvailability(slotInfo.cabinetId, slotInfo.drawerType);
          recordDividerUiDebug("Prebuilt.LegacySlot", "Legacy occupied slot remove completed", {
            slotInfo: summarizeDividerSlotInfo(slotInfo),
            overlayRefreshDividerType,
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

        const selectedDividerTypeAtClick = selectedDividerTypeRef.current;
        const placementWarning = buildDividerPlacementWarning(selectedDividerTypeAtClick, available);
        const selectedType = resolveDividerType(available, selectedDividerTypeAtClick);
        const drawerType = normalizedAddSlotInfo.drawerType ?? activeDrawerType;

        recordDividerUiDebug("Prebuilt.LegacySlot", "Resolved legacy add slot decision", {
          slotInfo: summarizeDividerSlotInfo(normalizedAddSlotInfo),
          available,
          selectedDividerType: selectedDividerTypeAtClick,
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
            "Prebuilt.LegacySlot",
            selectedDividerTypeAtClick
              ? "Selected divider type is not available for legacy add slot"
              : "Divider type is not selected for legacy add slot",
            {
              slotInfo: summarizeDividerSlotInfo(normalizedAddSlotInfo),
              available,
              selectedDividerType: selectedDividerTypeAtClick,
              zoneIndex: normalizedAddSlotInfo.zoneIndex,
              placementType: normalizedAddSlotInfo.placementType,
              canPlace: normalizedAddSlotInfo.canPlace,
              disabledReason: normalizedAddSlotInfo.disabledReason,
              userMessage,
            },
          );
          return;
        }

        if (normalizedAddSlotInfo.placementType && selectedType !== normalizedAddSlotInfo.placementType) {
          const userMessage =
            "Selected Divider does not match this placement slot. Choose the matching Divider option.";
          setDividerPlacementWarning(userMessage);
          return;
        }

        if (!drawerType) {
          console.warn("[Dividers] drawerType not resolved for legacy add slot");
          warnDividerUiDebug("Prebuilt.LegacySlot", "Drawer type not resolved for legacy add slot", {
            slotInfo: summarizeDividerSlotInfo(normalizedAddSlotInfo),
            activeDrawerType,
          });
          return;
        }

        setDividerPlacementWarning(null);
        await saveSnapshot();
        recordDividerUiDebug("Prebuilt.LegacySlot", "Legacy place divider request prepared", {
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
        refreshDividerOverlay(normalizedAddSlotInfo.cabinetId, drawerType, selectedType);
        void refreshDividerOptionsAvailability(normalizedAddSlotInfo.cabinetId, drawerType);
        recordDividerUiDebug("Prebuilt.LegacySlot", "Legacy add slot completed", {
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
    selectedSceneProduct,
    activeDrawerType,
    dispatch,
    dividerSelection,
    getResolvedActiveDividerContext,
    selectedDividerType,
    resolveDividerType,
    saveSnapshot,
    isPlayCanvasReady,
    refreshDividerOverlay,
    refreshDividerOptionsAvailability,
    syncPlacedDividersForDrawer,
  ]);

  // Side panel invalidation is handled by global listener middleware.

  const applySidePanelGrooveChange = useCallback(
    async (value: GrooveType, side: SidePanelApplySide) => {
      await saveSnapshot();
      await applyGroove(dispatch, value, side, selectedProducts.length, {
        currentLeftStatus: sidePanelLeft,
        currentRightStatus: sidePanelRight,
      });
    },
    [dispatch, saveSnapshot, selectedProducts.length, sidePanelLeft, sidePanelRight],
  );

  const handleSidePanelSyncConfirm = useCallback(async () => {
    const pendingChange = pendingSidePanelSyncChange;
    if (!pendingChange) return;

    setPendingSidePanelSyncChange(null);
    await applySidePanelGrooveChange(pendingChange.requestedGroove, "both");
  }, [applySidePanelGrooveChange, pendingSidePanelSyncChange]);

  const handleSidePanelsChange = async (value: string) => {
    if (!value) return;
    if (!isGrooveType(value)) return;
    const targetSide = resolvedSpSide;
    if (targetSide === null) return;
    if (sidePanelsBlockedByLength340 && value !== "None") return;
    if (value !== "None" && !sidePanelAvailability.allowed.has(value)) return;
    if (value !== "None") {
      const totalAfter = computeTotalAfterSpChange(value);
      if (totalAfter !== null && !lengthGuard.canAccommodateTotal(totalAfter)) return;
    }

    const syncPrompt = resolveSidePanelSyncPrompt({
      targetSide,
      requestedGroove: value,
      currentGroove: activeSidePanels,
      leftStatus: sidePanelLeft,
      rightStatus: sidePanelRight,
      leftCanAcceptGroove: canSidePanelSideAcceptGroove("left", value),
      rightCanAcceptGroove: canSidePanelSideAcceptGroove("right", value),
    });

    if (syncPrompt) {
      setPendingSidePanelSyncChange(syncPrompt);
      return;
    }

    await applySidePanelGrooveChange(value, targetSide);
  };

  const handleDividersChange = async (value: string | null) => {
    recordDividerUiDebug("Prebuilt.DividerSelection", "Divider option change requested", {
      value,
      previous: dividerSelection,
      activeDrawerType,
      selectedSceneProduct,
    });
    if (!value) return;
    if (value === dividerSelection && value !== "None") {
      recordDividerUiDebug("Prebuilt.DividerSelection", "Skip unchanged divider option", {
        value,
      });
      return;
    }
    if (value === dividerSelection) {
      recordDividerUiDebug("Prebuilt.DividerSelection", "Re-apply None to clear scene dividers", {
        value,
      });
    }

    setDividerPlacementWarning(null);
    await saveSnapshot();

    if (value === "None") {
      const clearResult = await clearPlacedDividersInScene(selectedProducts);
      recordDividerUiDebug("Prebuilt.DividerSelection", "Scene dividers cleared for None option", {
        clearResult,
      });
      dispatch(clearPlacedDividers());

      const exitTopView = wrapExitTopView({
        onExit: () => {
          restoreDrawerCameraMode(false);

          setActiveDrawerType(null);
          dispatch(setIsDrawerOpen(false));
        },
      });

      if (exitTopView) {
        await Promise.resolve(exitTopView());
      } else {
        console.warn("[Drawer] exitTopView not ready");
        warnDividerUiDebug("Prebuilt.DividerSelection", "exitTopView not ready while switching to None");
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
    recordDividerUiDebug("Prebuilt.DividerSelection", "Divider option change applied", {
      value,
    });
  };

  const handleDividerStyleChange = async (value: string) => {
    const resolvedContext = getResolvedActiveDividerContext();
    const dividerType = getDividerTypeFromOptionTitle(value);
    const availability = getDividerAvailabilityForContext(resolvedContext.cabinetId, resolvedContext.drawerType);

    recordDividerUiDebug("Prebuilt.DividerStyle", "Divider style change requested", {
      value,
      previous: dividerStyle,
      availableDividerTypes: availableDividerTypes ? Array.from(availableDividerTypes) : null,
    });
    if (!value) return;
    if (availability.types && dividerType && !availability.types.has(dividerType)) {
      const availableTypes = availability.availableTypes ?? [];
      const userMessage = buildUnavailableDividerWarning(dividerType, availableTypes);
      setDividerPlacementWarning(userMessage);
      warnDividerUiDebug("Prebuilt.DividerStyle", "Blocked unavailable divider style", {
        value,
        dividerType,
        availableDividerTypes: availableTypes,
        userMessage,
      });
      return;
    }
    if (value === dividerStyle) {
      recordDividerUiDebug("Prebuilt.DividerStyle", "Skip unchanged divider style", {
        value,
        dividerType,
      });
      return;
    }
    if (availableDividerTypes && dividerType && !availableDividerTypes.has(dividerType)) {
      const availableTypes = Array.from(availableDividerTypes);
      const userMessage = buildUnavailableDividerWarning(dividerType, availableTypes);
      setDividerPlacementWarning(userMessage);
      warnDividerUiDebug("Prebuilt.DividerStyle", "Blocked unavailable divider style", {
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
    recordDividerUiDebug("Prebuilt.DividerStyle", "Divider style change applied", {
      value,
      dividerType,
    });

    if (dividerType && resolvedContext.cabinetId && resolvedContext.drawerType && dividerSelection === "Customize") {
      refreshDividerOverlay(resolvedContext.cabinetId, resolvedContext.drawerType, dividerType);
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
          {sidePanelBlock ? (
            <p style={SIDE_PANEL_MESSAGE_STYLE}>{sidePanelBlock.message(sidePanelReasonCtx)}</p>
          ) : (
            <>
              {sidePanelNotice && <SidePanelNoticeBox notice={sidePanelNotice} />}
              <ProductOptionsGrid
                data={sidePanelOptions}
                handleAdd={handleSidePanelsChange}
                activeValue={sidePanelGridActiveValue}
              />
            </>
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
            <div style={DIVIDER_CUSTOMIZE_SECTION_STYLE}>
              <div style={DIVIDER_TYPE_HEADER_STYLE}>
                <p style={DIVIDER_TYPE_LABEL_STYLE}>Divider type</p>
                {!selectedDividerType && (
                  <p style={DIVIDER_SELECT_TYPE_HINT_STYLE}>Select a Divider type first to show placement points.</p>
                )}
              </div>
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
              <p style={DIVIDER_OPEN_DRAWER_HINT_STYLE}>Click 'Open Drawer' in your design to add dividers.</p>
            </div>
          )}
        </>
      ),
    },
    {
      id: "towel-bar",
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
      <SidePanelSyncConfirmModal
        pendingChange={pendingSidePanelSyncChange}
        onCancel={() => setPendingSidePanelSyncChange(null)}
        onConfirm={handleSidePanelSyncConfirm}
      />
    </div>
  );
};
