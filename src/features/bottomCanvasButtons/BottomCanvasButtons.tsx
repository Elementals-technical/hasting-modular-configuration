import { useState } from "react";
import { useLocation } from "react-router-dom";

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

import { RESTORE_INCOMPLETE_SAVE_MESSAGE, useSaveCurrentConfiguration } from "@/features/saveConfiguration";

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

  const { pathname } = useLocation();

  const [isShareOpening, setIsShareOpening] = useState(false);
  const [shareValue, setShareValue] = useState("");

  const dispatch = useAppDispatch();

  const countertopThickness = useAppSelector(getActiveCountertopThickness);
  const saveCurrentConfiguration = useSaveCurrentConfiguration();
  // const cabinetCatalog = useAppSelector(getCabinetCatalog);

  const canUndo = useAppSelector(getCanUndo);
  const canRedo = useAppSelector(getCanRedo);
  const lastPastSnapshot = useAppSelector(getLastPastSnapshot);
  const lastFutureSnapshot = useAppSelector(getLastFutureSnapshot);

  // const saveSnapshot = useHistorySnapshot();
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

  // const isCustomRoute = pathname.includes("/custom");
  const isSummaryPage = pathname.includes("/summary");

  const [createArConfiguration, { isLoading: isFetchingArConfig }] = useCreateArConfigurationMutation();

  // const resetCustomBuilderScene = async () => {
  //   await saveSnapshot();
  //   removeAllProducts();
  //   dispatch(resetProducts());

  //   const defaultRule =
  //     cabinetCatalog.typeCabinetRules.find((rule) => rule.code === "Sink-Base") ?? cabinetCatalog.typeCabinetRules[0];
  //   if (!defaultRule) return;

  //   const defaultProductName = defaultRule?.code ?? "Sink-Base";
  //   const defaultProductConfig: addProductConfigI = {
  //     Height: defaultRule?.heights[defaultRule.heights.length - 1] ?? 56,
  //     Depth: defaultRule?.depths[0] ?? 46,
  //     CabinetColor: "Ardesia DD GL",
  //     Width: defaultRule?.widths[0] ?? 60,
  //     sinkType: defaultRule?.hasSink ? "Top_HPLPrisma" : undefined,
  //     CountertopColor: "Cacao Orinoco FF MT",
  //     HandleGrooveColor: "Blu Pavone A6 MT",
  //   };

  //   dispatch(setActiveCabinetType(defaultRule.code));

  //   const productId = await addProduct(defaultProductName, defaultProductConfig);

  //   dispatch(setDrawerProduct(defaultProductName));
  //   dispatch(setSelectedProductConfig(defaultProductConfig));
  //   dispatch(
  //     setSelectedDimensions({
  //       width: defaultProductConfig.Width,
  //       height: defaultProductConfig.Height,
  //       depth: defaultProductConfig.Depth,
  //     }),
  //   );

  //   if (defaultProductConfig.sinkType) {
  //     dispatch(setActiveBasinStyle(defaultProductConfig.sinkType));
  //   }

  //   if (productId) {
  //     dispatch(addProductId(productId));
  //   }
  // };

  // const resetPrebuiltScene = async () => {
  //   await saveSnapshot();
  //   removeAllProducts();
  //   dispatch(resetPrebuiltProducts());

  //   try {
  //     await addPreset(productMockData[0].presetProducts);

  //     dispatch(addProductPreset(productMockData[0].presetProducts));
  //   } catch (error) {
  //     console.log(error);
  //   }
  // };

  const handleSaveConfiguration = async () => {
    try {
      const result = await saveCurrentConfiguration();

      if (!result.ok) {
        const message = result.reason === "restore-incomplete" ? RESTORE_INCOMPLETE_SAVE_MESSAGE : "No products to save";
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

  // const handleRestoreConfiguration = async () => {
  //   try {
  //     const result = await restore(5).unwrap();

  //     // Set default path in which the configuration will be restored.
  //     const path = result?.metadata?.path;
  //     if (typeof path === "string" && path.startsWith("/")) {
  //       navigate(path);
  //     }

  //     const configuration = result?.configuration || {};
  //     const presetProducts = buildPresetFromConfiguration(configuration);

  //     console.log(":presetProducts", presetProducts);

  //     dispatch(resetProducts());
  //     removeAllProducts();

  //     const createdIds = await addPreset(presetProducts);
  //     dispatch(addProductPreset(presetProducts));

  //     // @ts-ignore
  //     const orderedIds = createdIds?.length ? createdIds : getOrderedProductIds();
  //     orderedIds.forEach((id) => dispatch(addProductId(id)));

  //     const groupByName = presetProducts.reduce<Record<string, PresetProduct[]>>((acc, item) => {
  //       const key = item.name;
  //       if (!acc[key]) acc[key] = [];
  //       acc[key].push(item);
  //       return acc;
  //     }, {});

  //     Object.entries(groupByName).forEach(([name, items]) => {
  //       const [first] = items;
  //       if (!first) return;

  //       if (name.startsWith("Top_")) {
  //         if (first.CountertopColor) {
  //           setConfigBatch({ productType: name }, { CountertopColor: first.CountertopColor });
  //         }
  //         return;
  //       }

  //       const config: Record<string, unknown> = {};
  //       if (first.CabinetColor) config.CabinetColor = first.CabinetColor;
  //       if (first.HandleGrooveColor) config.HandleGrooveColor = first.HandleGrooveColor;
  //       if (first.sinkType) config.sinkType = first.sinkType;
  //       if (first.Drawers) config.Drawers = first.Drawers;

  //       if (Object.keys(config).length) {
  //         setConfigBatch({ productType: name }, config);
  //       }
  //     });

  //     const [firstPreset] = presetProducts;
  //     if (firstPreset?.name) {
  //       dispatch(setDrawerProduct(firstPreset.name));
  //     }

  //     dispatch(setSelectedProductConfig(firstPreset ?? null));

  //     const nextDimensions: Partial<{
  //       width: number;
  //       height: number;
  //       depth: number;
  //     }> = {};
  //     if (typeof firstPreset?.Width === "number") nextDimensions.width = firstPreset.Width;
  //     if (typeof firstPreset?.Height === "number") nextDimensions.height = firstPreset.Height;
  //     if (typeof firstPreset?.Depth === "number") nextDimensions.depth = firstPreset.Depth;

  //     if (Object.keys(nextDimensions).length) {
  //       dispatch(setSelectedDimensions(nextDimensions));
  //     }
  //   } catch (err) {
  //     console.error(err);
  //   }
  // };

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

            {/* <BaseButton
              variant="ghost"
              onClick={() => {
                if (isCustomRoute) {
                  resetCustomBuilderScene();
                } else {
                  resetPrebuiltScene();
                }
              }}
            >
              <RotateIcon />
            </BaseButton> */}

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
