import { useState } from "react";
import { useLocation } from "react-router-dom";

import { BaseButton } from "@/shared";
import { DimentionsIcon } from "@/shared/assets/images/svg/DimentionsIcon";
import { ZoomInIcon } from "@/shared/assets/images/svg/ZoomInIcon";
import { ZoomOutIcon } from "@/shared/assets/images/svg/ZoomOutIcon";
import { ArIcon } from "@/shared/assets/images/svg/ArIcon";
import { ShareIcon } from "@/shared/assets/images/svg/ShareIcon";
import { UndoIcon } from "@/shared/assets/images/svg/UndoIcon";
import { RedoIcon } from "@/shared/assets/images/svg/RedoIcon";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";

import { getDimensionTool } from "@/utils/functions/playcanvas/getDimensionTool";

import { useCreateArConfigurationMutation, useSaveConfigurationMutation } from "@/entities";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { ArPopup } from "@/shared/ui/Popups/ui/ArPopup/ArPopup";
import { SharePopup } from "@/shared/ui/Popups/ui/sharePopup/SharePopup";

import { exportToAR } from "@/utils/functions/playcanvas/exportToAR";
import { downloadSceneImage } from "@/utils/functions/playcanvas/captureScreenshot";
import { zoomIn, zoomOut } from "@/utils/functions/playcanvas/camera";
import { hideDimensions, showDimensions } from "@/utils/functions/playcanvas/showDimensions";
import {
  getCanUndo,
  getCanRedo,
  getLastPastSnapshot,
  getLastFutureSnapshot,
} from "@/entities/history/model/store/selectors";
import { undo, redo, setHistoryRestoring } from "@/entities/history/model/store/slice";
import { captureSnapshot } from "@/entities/history/lib/captureSnapshot";
import { restoreSnapshot } from "@/entities/history/lib/restoreSnapshot";
import { store, type RootState } from "@/app/store";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";
import { setIsDrawerOpen, setSelectedSceneProduct } from "@/entities/product/model/store/slice";
import { captureOrbitCameraState, restoreOrbitCameraState } from "@/utils/functions/playcanvas/orbitCamera";
import {
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getCabinetColor,
  getCountertopStyle,
  getDividersOption,
  getDividersStyle,
  getDrawerPanelFluting,
  getFaucetHolesAmount,
  getFaucetHolesSpacing,
  getGrainDirection,
  getHandleGrooveColor,
  getLedOption,
  getSidePanelsOption,
  getSinkType,
  getTowelBarColor,
  getTowelBarOption,
} from "@/entities/product/model/store/selectors";

import s from "./BottomCanvasButtons.module.scss";
import { DownloadImageIcon } from "@/shared/assets/images/svg/DownloadImageIcon";
import { FullDimentionsIcon } from "@/shared/assets/images/svg/FullDimentionsIcon";

export const BottomCanvasButtons = () => {
  const [isDimensionsEnabled, setIsDimensionsEnabled] = useState(false);
  const [isFullDimensionsEnabled, setIsFullDimensionsEnabled] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [QRValue, setQRValue] = useState("");
  const [isArGenerating, setIsArGenerating] = useState(false);

  const { pathname } = useLocation();

  const [isShareOpening, setIsShareOpening] = useState(false);
  const [shareValue, setShareValue] = useState("");

  const dispatch = useAppDispatch();

  const cabinetColor = useAppSelector(getCabinetColor);
  // const cabinetCatalog = useAppSelector(getCabinetCatalog);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const sinkType = useAppSelector(getSinkType);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const countertopThickness = useAppSelector(getActiveCountertopThickness);
  const drawerPanelFluting = useAppSelector(getDrawerPanelFluting);
  const grainDirection = useAppSelector(getGrainDirection);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const sidePanelsOption = useAppSelector(getSidePanelsOption);
  const ledOption = useAppSelector(getLedOption);
  const dividersOption = useAppSelector(getDividersOption);
  const dividersStyle = useAppSelector(getDividersStyle);
  const towelBarOption = useAppSelector(getTowelBarOption);
  const towelBarColor = useAppSelector(getTowelBarColor);
  const faucetHolesAmount = useAppSelector(getFaucetHolesAmount);
  const faucetHolesSpacing = useAppSelector(getFaucetHolesSpacing);

  const canUndo = useAppSelector(getCanUndo);
  const canRedo = useAppSelector(getCanRedo);
  const lastPastSnapshot = useAppSelector(getLastPastSnapshot);
  const lastFutureSnapshot = useAppSelector(getLastFutureSnapshot);

  // const saveSnapshot = useHistorySnapshot();
  const [isRestoring, setIsRestoring] = useState(false);

  const readNumericConfigValue = (config: unknown, key: "Width" | "Height" | "Depth") => {
    if (!config || typeof config !== "object") return undefined;

    const rawValue = (config as Record<string, unknown>)[key];

    if (typeof rawValue !== "number" || Number.isNaN(rawValue)) return undefined;

    return rawValue;
  };

  const formatInchesLabel = (value?: number) => {
    if (typeof value !== "number") return "";

    const normalized = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");

    return `${normalized} "`;
  };

  const handleToggleFullDimensions = async () => {
    const next = !isFullDimensionsEnabled;

    if (!next) {
      hideDimensions();

      setIsFullDimensionsEnabled(false);
      return;
    }

    const ids = getOrderedProductIds();
    if (!ids.length) return;

    const configs = await Promise.all(ids.map((id) => getConfig(id)));

    const widthByNode = ids.map((id, index) => ({
      node: id,
      width: readNumericConfigValue(configs[index], "Width"),
    }));

    const totalWidth = widthByNode.reduce((sum, item) => sum + (item.width ?? 0), 0);

    const maxHeight = configs.reduce((max, config) => {
      const value = readNumericConfigValue(config, "Height");
      return Math.max(max, value ?? 0);
    }, 0);

    const maxDepth = configs.reduce((max, config) => {
      const value = readNumericConfigValue(config, "Depth");

      return Math.max(max, value ?? 0);
    }, 0);

    const didShow = showDimensions({
      box: {
        nodes: ids,
        width: { label: formatInchesLabel(totalWidth), offset: 0.05 },
        height: { label: formatInchesLabel(maxHeight) },
        depth: { label: formatInchesLabel(maxDepth) },
      },
      lines: widthByNode.map(({ node, width }) => ({
        node,
        axis: "x",
        label: formatInchesLabel(width),
      })),
      labelSettings: {
        offset: 0.05,
        labelGap: "auto",
        labelPosition: "center",
        units: "in",
        decimals: 2,
      },
    });

    if (!didShow) return;

    const tool = getDimensionTool();
    tool?.setEnabled(false);
    setIsDimensionsEnabled(false);
    setIsFullDimensionsEnabled(true);
  };

  const handleUndo = async () => {
    if (!canUndo || !lastPastSnapshot || isRestoring) return;
    setIsRestoring(true);
    dispatch(setHistoryRestoring(true));
    const cameraState = captureOrbitCameraState();
    try {
      const currentSnapshot = await captureSnapshot(() => store.getState() as RootState);
      dispatch(undo(currentSnapshot));
      dispatch(setOpenStyleSidebar(false));
      dispatch(setIsDrawerOpen(false));
      dispatch(setSelectedSceneProduct(""));
      await restoreSnapshot(lastPastSnapshot, dispatch);
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
      dispatch(redo(currentSnapshot));
      dispatch(setOpenStyleSidebar(false));
      dispatch(setIsDrawerOpen(false));
      dispatch(setSelectedSceneProduct(""));
      await restoreSnapshot(lastFutureSnapshot, dispatch);
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

  const [saveConfiguration] = useSaveConfigurationMutation();
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
    const ids = getOrderedProductIds();

    if (!ids.length) {
      console.warn("[Configurations] No products to save");

      setShareValue("No products to save");
      setIsShareOpening(true);
      return;
    }

    const configs = await Promise.all(ids.map((id) => getConfig(id)));
    const configuration = ids.reduce<Record<string, unknown>>((acc, id, index) => {
      acc[id] = configs[index];
      return acc;
    }, {});

    const metadata = {
      path: pathname,
      savedAt: new Date().toISOString(),
      orderedProductIds: ids,
      uiState: {
        CabinetColor: cabinetColor,
        HandleGrooveColor: handleGrooveColor,
        sinkType,
        CountertopColor: countertopColor,
        Thickness: countertopThickness,
        DrawerPanelFluting: drawerPanelFluting,
        GrainDirection: grainDirection,
        CountertopStyle: countertopStyle,
        SidePanels: sidePanelsOption,
        LedOption: ledOption,
        DividersOption: dividersOption,
        DividersStyle: dividersStyle,
        TowelBarOption: towelBarOption,
        TowelBarColor: towelBarColor,
        FaucetHolesAmount: faucetHolesAmount,
        FaucetHolesSpacing: faucetHolesSpacing,
      },
    };

    try {
      const result = await saveConfiguration({ configuration, metadata }).unwrap();

      const configId = result?.id;

      if (configId !== undefined && configId !== null) {
        const url = `${window.location.origin}/custom/cabinet-builder?configId=${encodeURIComponent(String(configId))}`;

        setShareValue(url);
        setIsShareOpening(true);
      }
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
        <BaseButton
          variant="ghost"
          className={isDimensionsEnabled ? s.activeButton : undefined}
          onClick={() => {
            const next = !isDimensionsEnabled;
            if (next && isFullDimensionsEnabled) {
              hideDimensions();
              setIsFullDimensionsEnabled(false);
            }

            const tool = getDimensionTool();
            tool?.setEnabled(next);
            setIsDimensionsEnabled(next);
          }}
        >
          <DimentionsIcon />
        </BaseButton>

        <BaseButton
          variant="ghost"
          className={isFullDimensionsEnabled ? s.activeButton : undefined}
          onClick={handleToggleFullDimensions}
        >
          <FullDimentionsIcon />
        </BaseButton>

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
          onClick={() => {
            setIsOpening(true);
            handleCreateArConfiguration();
          }}
        >
          <ArIcon />
        </BaseButton>

        {!isSummaryPage && (
          <>
            <BaseButton variant="ghost" onClick={handleSaveConfiguration}>
              <ShareIcon />
            </BaseButton>

            <BaseButton variant="ghost" onClick={() => downloadSceneImage()}>
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
