import { useState } from "react";
import { useCollectionNavigation } from "@/features/collectionCustomization";

import { BaseButton } from "@/shared";
import { ZoomInIcon } from "@/shared/assets/images/svg/ZoomInIcon";
import { ZoomOutIcon } from "@/shared/assets/images/svg/ZoomOutIcon";
import { ArIcon } from "@/shared/assets/images/svg/ArIcon";
import { ShareIcon } from "@/shared/assets/images/svg/ShareIcon";
import { UndoIcon } from "@/shared/assets/images/svg/UndoIcon";
import { RedoIcon } from "@/shared/assets/images/svg/RedoIcon";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";

import { useCreateArConfigurationMutation } from "@/entities";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import {
  computeAndShowFullDimensions,
  type FullDimensionsUnit,
} from "@/utils/functions/playcanvas/refreshFullDimensions";
import { useFullDimensionsRefresh } from "@/features/fullDimensions";
import { ArPopup } from "@/shared/ui/Popups/ui/ArPopup/ArPopup";
import { SharePopup } from "@/shared/ui/Popups/ui/sharePopup/SharePopup";

import { getSaveFailureMessage, useSaveCurrentConfiguration } from "@/features/saveConfiguration";

import { exportToAR } from "@/utils/functions/playcanvas/exportToAR";
import { downloadSceneImage } from "@/utils/functions/playcanvas/captureScreenshot";
import { zoomIn, zoomOut } from "@/utils/functions/playcanvas/camera";
import { hideDimensions } from "@/utils/functions/playcanvas/showDimensions";
import { getDimensionTool } from "@/utils/functions/playcanvas/getDimensionTool";
import {
  getCanUndo,
  getCanRedo,
  getLastPastSnapshot,
  getLastFutureSnapshot,
} from "@/entities/history/model/store/selectors";
import { undo, redo, setHistoryRestoring } from "@/entities/history/model/store/slice";
import { captureSnapshot } from "@/entities/history/lib/captureSnapshot";
import { restoreSnapshot } from "@/entities/history/lib/restoreSnapshot";
import { useActiveCollection } from "@/entities/collection";
import type { SceneRestoreResult } from "@/entities/configuration";
import { store, type RootState } from "@/app/store";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";
import { setIsDrawerOpen, setSelectedSceneProduct } from "@/entities/product/model/store/slice";
import { captureOrbitCameraState, restoreOrbitCameraState } from "@/utils/functions/playcanvas/orbitCamera";
import {
  getActiveCountertopThickness,
} from "@/entities/product/model/store/selectors";

import s from "./BottomCanvasButtons.module.scss";
import { DownloadImageIcon } from "@/shared/assets/images/svg/DownloadImageIcon";
import { FullDimentionsIcon } from "@/shared/assets/images/svg/FullDimentionsIcon";

const FULL_DIMENSION_UNIT_OPTIONS: ReadonlyArray<{ unit: FullDimensionsUnit; label: string }> = [
  { unit: "in", label: "Inches" },
  { unit: "cm", label: "Metric" },
];

/** Whether the scene took the snapshot. History moves only when it did; a partial rebuild is reported. */
const isSceneRebuilt = (label: string, result: SceneRestoreResult): boolean => {
  if (result.status === "restored") return true;

  if (result.status === "partial") {
    console.error(`${label}: the scene was only partly rebuilt`, result.failed);
    return true;
  }

  console.error(`${label}: the scene was not rebuilt`, result);
  return false;
};

export const BottomCanvasButtons = () => {
  const [isFullDimensionsEnabled, setIsFullDimensionsEnabled] = useState(false);
  const [fullDimensionsUnit, setFullDimensionsUnit] = useState<FullDimensionsUnit>("in");
  const [activeFullDimensionsUnit, setActiveFullDimensionsUnit] = useState<FullDimensionsUnit | null>(null);
  const [isFullDimensionsMenuOpen, setIsFullDimensionsMenuOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [QRValue, setQRValue] = useState("");
  const [isArGenerating, setIsArGenerating] = useState(false);

  const [isShareOpening, setIsShareOpening] = useState(false);
  const [shareValue, setShareValue] = useState("");

  const dispatch = useAppDispatch();

  const countertopThickness = useAppSelector(getActiveCountertopThickness);
  const saveCurrentConfiguration = useSaveCurrentConfiguration();
  const runtimeBindings = useActiveCollection((collection) => collection.catalog.runtimeBindings ?? null);

  const canUndo = useAppSelector(getCanUndo);
  const canRedo = useAppSelector(getCanRedo);
  const lastPastSnapshot = useAppSelector(getLastPastSnapshot);
  const lastFutureSnapshot = useAppSelector(getLastFutureSnapshot);

  const [isRestoring, setIsRestoring] = useState(false);

  const deactivateFullDimensions = () => {
    hideDimensions();
    getDimensionTool()?.setEnabled(true);
    setIsFullDimensionsEnabled(false);
    setActiveFullDimensionsUnit(null);
    setIsFullDimensionsMenuOpen(false);
  };

  useFullDimensionsRefresh(isFullDimensionsEnabled, fullDimensionsUnit, deactivateFullDimensions);

  const handleSelectFullDimensionsUnit = async (unit: FullDimensionsUnit) => {
    if (isFullDimensionsEnabled && activeFullDimensionsUnit === unit) {
      deactivateFullDimensions();
      return;
    }

    setIsFullDimensionsMenuOpen(false);

    const didShow = await computeAndShowFullDimensions({ countertopThickness, unit });
    if (!didShow) {
      deactivateFullDimensions();
      return;
    }

    setFullDimensionsUnit(unit);
    setActiveFullDimensionsUnit(unit);
    setIsFullDimensionsEnabled(true);
  };

  const handleToggleFullDimensions = () => {
    if (isFullDimensionsEnabled) {
      deactivateFullDimensions();
      return;
    }

    setIsFullDimensionsMenuOpen((prev) => !prev);
  };

  const handleUndo = async () => {
    if (!canUndo || !lastPastSnapshot || isRestoring) return;
    setIsRestoring(true);
    dispatch(setHistoryRestoring(true));
    const cameraState = captureOrbitCameraState();
    try {
      const currentSnapshot = await captureSnapshot(() => store.getState() as RootState);
      dispatch(setOpenStyleSidebar(false));
      dispatch(setIsDrawerOpen(false));
      dispatch(setSelectedSceneProduct(""));
      const result = await restoreSnapshot(lastPastSnapshot, {
        dispatch,
        getState: () => store.getState() as RootState,
        getBindings: () => runtimeBindings,
      });
      if (!isSceneRebuilt("[History] Undo", result)) return;
      dispatch(undo(currentSnapshot));
      restoreOrbitCameraState(cameraState);
    } catch (error) {
      console.error("[History] Undo failed", error);
    } finally {
      dispatch(setHistoryRestoring(false));
      setIsRestoring(false);
    }
  };

  const handleRedo = async () => {
    if (!canRedo || !lastFutureSnapshot || isRestoring) return;
    setIsRestoring(true);
    dispatch(setHistoryRestoring(true));
    const cameraState = captureOrbitCameraState();
    try {
      const currentSnapshot = await captureSnapshot(() => store.getState() as RootState);
      dispatch(setOpenStyleSidebar(false));
      dispatch(setIsDrawerOpen(false));
      dispatch(setSelectedSceneProduct(""));
      const result = await restoreSnapshot(lastFutureSnapshot, {
        dispatch,
        getState: () => store.getState() as RootState,
        getBindings: () => runtimeBindings,
      });
      if (!isSceneRebuilt("[History] Redo", result)) return;
      dispatch(redo(currentSnapshot));
      restoreOrbitCameraState(cameraState);
    } catch (error) {
      console.error("[History] Redo failed", error);
    } finally {
      dispatch(setHistoryRestoring(false));
      setIsRestoring(false);
    }
  };

  const isSummaryPage = useCollectionNavigation()?.isSummary ?? false;

  const [createArConfiguration, { isLoading: isFetchingArConfig }] = useCreateArConfigurationMutation();

  const handleSaveConfiguration = async () => {
    try {
      const result = await saveCurrentConfiguration();

      if (!result.ok) {
        const message = getSaveFailureMessage(result.reason);
        console.warn(`[Configurations] ${message}`);

        setShareValue(message);
        setIsShareOpening(true);
        return;
      }

      setShareValue(result.url);
      setIsShareOpening(true);
    } catch (error) {
      console.error("[Configurations] Save failed", error);
    }
  };

  const handleCreateArConfiguration = async () => {
    setQRValue("");
    setIsArGenerating(true);
    const ids = getOrderedProductIds();

    if (!ids.length) {
      console.warn("[AR] No products to export");
      setIsArGenerating(false);
      return;
    }

    const configs = await Promise.all(ids.map((id) => getConfig(id)));
    const configuration = ids.reduce<Record<string, unknown>>((acc, id, index) => {
      acc[id] = configs[index];
      return acc;
    }, {});

    const arExport = await exportToAR("both");
    if (!arExport) {
      console.warn("[AR] Export failed");
      setIsArGenerating(false);
      return;
    }

    const timestamp = Date.now();
    const glbFile = arExport.glb
      ? new File([arExport.glb], `configuration_${timestamp}.glb`, { type: arExport.glb.type })
      : undefined;

    const usdzFile = arExport.usdz
      ? new File([arExport.usdz], `configuration_${timestamp}.usdz`, { type: arExport.usdz.type })
      : undefined;

    try {
      const result = await createArConfiguration({
        configuration,
        glb: glbFile,
        usdz: usdzFile,
      }).unwrap();

      const glbUrl = result?.glbUrl || "";
      const usdzUrl = result?.usdzUrl || "";
      const qrValue =
        glbUrl || usdzUrl
          ? `${window.location.origin}/ar-download?glb=${encodeURIComponent(glbUrl)}&usdz=${encodeURIComponent(
              usdzUrl,
            )}`
          : "";

      setQRValue(qrValue);
    } catch (err) {
      console.error("[AR] Failed to create AR configuration", err);
    } finally {
      setIsArGenerating(false);
    }
  };

  const handleCopyShareValue = async () => {
    if (!shareValue) return;

    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(shareValue);
        return;
      }
    } catch (err) {
      console.error("[Share] Failed to copy via clipboard API", err);
    }
  };

  return (
    <>
      <div className={s.bottomCanvasButtons}>
        <div className={s.dimensionButtonWrap}>
          <BaseButton
            variant="ghost"
            className={`${s.tooltip}${isFullDimensionsEnabled ? ` ${s.activeButton}` : ""}`}
            data-tooltip="Full Dimensions"
            aria-haspopup="menu"
            aria-expanded={isFullDimensionsMenuOpen}
            onClick={handleToggleFullDimensions}
          >
            <FullDimentionsIcon />
          </BaseButton>

          {isFullDimensionsMenuOpen && (
            <div className={s.unitMenu} role="menu" aria-label="Full dimensions units">
              {FULL_DIMENSION_UNIT_OPTIONS.map((option) => (
                <button
                  key={option.unit}
                  type="button"
                  role="menuitemradio"
                  aria-checked={activeFullDimensionsUnit === option.unit}
                  className={`${s.unitOption}${activeFullDimensionsUnit === option.unit ? ` ${s.activeUnitOption}` : ""}`}
                  onClick={() => {
                    void handleSelectFullDimensionsUnit(option.unit);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {!isSummaryPage && (
          <>
            <BaseButton variant="ghost" onClick={() => zoomOut()}>
              <ZoomOutIcon />
            </BaseButton>

            <BaseButton variant="ghost" onClick={() => zoomIn()}>
              <ZoomInIcon />
            </BaseButton>
          </>
        )}

        <BaseButton
          variant="ghost"
          className={s.tooltip}
          data-tooltip="View in Space"
          onClick={() => {
            setIsOpening(true);
            handleCreateArConfiguration();
          }}
        >
          <ArIcon />
        </BaseButton>

        {!isSummaryPage && (
          <>
            <BaseButton variant="ghost" className={s.tooltip} data-tooltip="Share" onClick={handleSaveConfiguration}>
              <ShareIcon />
            </BaseButton>

            <BaseButton variant="ghost" className={s.tooltip} data-tooltip="Image" onClick={() => downloadSceneImage()}>
              <DownloadImageIcon />
            </BaseButton>

            <BaseButton
              variant="ghost"
              className={!canUndo || isRestoring ? s.disabledButton : undefined}
              disabled={!canUndo || isRestoring}
              onClick={handleUndo}
            >
              <UndoIcon />
            </BaseButton>

            <BaseButton
              variant="ghost"
              className={!canRedo || isRestoring ? s.disabledButton : undefined}
              disabled={!canRedo || isRestoring}
              onClick={handleRedo}
            >
              <RedoIcon />
            </BaseButton>
          </>
        )}

        <ArPopup
          isLoadingAr={isFetchingArConfig || isArGenerating}
          qrValue={QRValue}
          qrSize={200}
          isOpening={isOpening}
          setIsOpening={setIsOpening}
        />

        <SharePopup
          isOpening={isShareOpening}
          setIsOpening={setIsShareOpening}
          shareValue={shareValue}
          onCopy={handleCopyShareValue}
        />
      </div>
    </>
  );
};
