import { useCallback, useEffect, useMemo, useState } from "react";

import { getActiveProductProfile } from "@/entities/configuration/model/store/selectors";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import { selectSidePanelAvailability } from "@/entities/product/model/store/derivedSelectors";
import {
  getCompositionVersion,
  getPlacedCabinetStyles,
  getProductsPresets,
  getSelectedDimensions,
  getSelectedProductConfig,
  getSelectedProducts,
  getSelectedSceneProduct,
  getSidePanelsOption,
} from "@/entities/product/model/store/selectors";
import { useCountertopLengthGuard } from "@/features/configurator-rule-core/countertop";
import {
  applyGroove,
  autoRemoveBoth,
  buildSidePanelEdgeState,
  getSidePanelLeftStatus,
  getSidePanelRightStatus,
  isGrooveType,
  isSidePanelGrooveAvailableForSide,
  isSidePanelLengthBlocked,
  resolveSidePanelBlock,
  resolveSidePanelGridActiveValue,
  resolveSidePanelNotice,
  resolveSidePanelSyncPrompt,
  resolveSidePanelTargetSide,
  type GrooveType,
  type SidePanelApplySide,
  type SidePanelReasonCtx,
  type SidePanelSyncPrompt,
} from "@/features/sidePanel";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { getEdgeCabinets, type EdgeCabinets } from "@/utils/functions/playcanvas/getEdgeCabinets";

import {
  buildSidePanelOptions,
  projectedTotalAfterGrooveChange,
  resolveSidePanelFieldAvailability,
} from "./sidePanelOptions";

import type { FieldRuntimeState } from "@/entities/collection";

const EMPTY_EDGE_CABINETS: EdgeCabinets = { leftCabinetId: null, rightCabinetId: null };

/** The edge cabinets of the scene, re-read after the composition settles (the scene reorders asynchronously). */
const useEdgeCabinets = (selectedProducts: string[]) => {
  const isPlayCanvasReady = usePlayCanvasReady();
  const compositionVersion = useAppSelector(getCompositionVersion);
  const orderKey = selectedProducts.join("|");
  const [edgeCabinets, setEdgeCabinets] = useState<EdgeCabinets>(EMPTY_EDGE_CABINETS);

  useEffect(() => {
    const applyEdges = () => {
      const next = !isPlayCanvasReady || !orderKey ? EMPTY_EDGE_CABINETS : getEdgeCabinets();
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
  }, [isPlayCanvasReady, orderKey, compositionVersion]);

  return edgeCabinets;
};

/** Side panel groove options judged for the selected edge cabinet, and the groove change with its confirmation. */
export const useSidePanelState = (field: FieldRuntimeState | undefined) => {
  const dispatch = useAppDispatch();
  const saveSnapshot = useHistorySnapshot();
  const activeProfile = useAppSelector(getActiveProductProfile);
  const activeGroove = useAppSelector(getSidePanelsOption);
  const selectedSceneProduct = useAppSelector(getSelectedSceneProduct);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const placedCabinetStyles = useAppSelector(getPlacedCabinetStyles);
  const presets = useAppSelector(getProductsPresets);
  const selectorAvailability = useAppSelector(selectSidePanelAvailability);
  const leftStatus = useAppSelector(getSidePanelLeftStatus);
  const rightStatus = useAppSelector(getSidePanelRightStatus);
  const lengthGuard = useCountertopLengthGuard(selectedProducts);
  const edgeCabinets = useEdgeCabinets(selectedProducts);
  const [pendingSync, setPendingSync] = useState<SidePanelSyncPrompt | null>(null);

  const isBlockedByLength = isSidePanelLengthBlocked(lengthGuard.currentCabinetOnly, activeProfile);
  const cabinetCount = selectedProducts.length;
  const selectedDrawers = typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : null;
  const selectedHeight = typeof selectedProductConfig?.Height === "number" ? selectedProductConfig.Height : null;
  const height = selectedDimensions.height ?? selectedHeight;

  const edgeState = useMemo(
    () => buildSidePanelEdgeState(edgeCabinets, selectedSceneProduct, activeProfile),
    [edgeCabinets, selectedSceneProduct, activeProfile],
  );
  const targetSide = useMemo(
    () => resolveSidePanelTargetSide({ edgeState, selectedCabinetId: selectedSceneProduct, cabinetCount }),
    [cabinetCount, edgeState, selectedSceneProduct],
  );

  const availability = useMemo(
    () =>
      resolveSidePanelFieldAvailability({
        selectorAvailability,
        presets,
        selectedSceneProduct,
        activeProfile,
        edgeState,
        height,
        fallbackEdgeDrawers: edgeState.eligibleFallbackEdgeId
          ? placedCabinetStyles[edgeState.eligibleFallbackEdgeId]
          : null,
        selectedDrawers,
      }),
    [
      activeProfile,
      edgeState,
      height,
      placedCabinetStyles,
      presets,
      selectedDrawers,
      selectedSceneProduct,
      selectorAvailability,
    ],
  );

  const reasonContext = useMemo<SidePanelReasonCtx>(
    () => ({
      cabinetCount,
      hasSelectedCabinet: !!selectedSceneProduct,
      isEdgeCabinet: edgeState.isSelectedEdge,
      cabinetOnlyLength: lengthGuard.currentCabinetOnly,
      availability,
      profile: activeProfile,
    }),
    [
      activeProfile,
      availability,
      cabinetCount,
      edgeState.isSelectedEdge,
      lengthGuard.currentCabinetOnly,
      selectedSceneProduct,
    ],
  );
  const block = resolveSidePanelBlock(reasonContext);
  const notice = useMemo(
    () => resolveSidePanelNotice({ cabinetCount, selectedCabinetId: selectedSceneProduct, edgeState, targetSide }),
    [cabinetCount, edgeState, selectedSceneProduct, targetSide],
  );
  const activeValue = useMemo(
    () => resolveSidePanelGridActiveValue({ targetSide, groove: activeGroove, leftStatus, rightStatus }),
    [activeGroove, leftStatus, rightStatus, targetSide],
  );
  const options = useMemo(
    () =>
      buildSidePanelOptions({
        field,
        isBlockedByLength,
        availability,
        lengthGuard,
        targetSide,
        leftStatus,
        rightStatus,
        profile: activeProfile,
      }),
    [activeProfile, availability, field, isBlockedByLength, lengthGuard, leftStatus, rightStatus, targetSide],
  );

  useEffect(() => {
    if (isBlockedByLength && activeGroove && activeGroove !== "None") void autoRemoveBoth(dispatch, cabinetCount);
  }, [activeGroove, cabinetCount, dispatch, isBlockedByLength]);

  const sideAcceptsGroove = useCallback(
    (side: "left" | "right", groove: GrooveType) => {
      const edgeId = side === "left" ? edgeState.leftCabinetId : edgeState.rightCabinetId;
      return isSidePanelGrooveAvailableForSide({
        edgeState,
        side,
        groove,
        height,
        edgeDrawers: (edgeId ? placedCabinetStyles[edgeId] : null) ?? selectedDrawers,
        profile: activeProfile,
      });
    },
    [activeProfile, edgeState, height, placedCabinetStyles, selectedDrawers],
  );

  const applyGrooveChange = useCallback(
    async (groove: GrooveType, side: SidePanelApplySide) => {
      await saveSnapshot();
      await applyGroove(dispatch, groove, side, cabinetCount, {
        currentLeftStatus: leftStatus,
        currentRightStatus: rightStatus,
      });
    },
    [cabinetCount, dispatch, leftStatus, rightStatus, saveSnapshot],
  );

  const changeGroove = async (value: string) => {
    if (!isGrooveType(value) || targetSide === null) return;
    if (value !== "None") {
      if (isBlockedByLength || !availability.allowed.has(value)) return;
      const totalAfter = projectedTotalAfterGrooveChange(
        value,
        targetSide,
        lengthGuard.currentCabinetOnly,
        leftStatus,
        rightStatus,
      );
      if (totalAfter !== null && !lengthGuard.canAccommodateTotal(totalAfter)) return;
    }

    const syncPrompt = resolveSidePanelSyncPrompt({
      targetSide,
      requestedGroove: value,
      currentGroove: activeGroove,
      leftStatus,
      rightStatus,
      leftCanAcceptGroove: sideAcceptsGroove("left", value),
      rightCanAcceptGroove: sideAcceptsGroove("right", value),
    });
    if (syncPrompt) {
      setPendingSync(syncPrompt);
      return;
    }
    await applyGrooveChange(value, targetSide);
  };

  const confirmSync = async () => {
    if (!pendingSync) return;
    setPendingSync(null);
    await applyGrooveChange(pendingSync.requestedGroove, "both");
  };

  return {
    options,
    activeValue,
    blockMessage: block ? block.message(reasonContext) : null,
    notice,
    changeGroove,
    pendingSync,
    cancelSync: () => setPendingSync(null),
    confirmSync,
  };
};
