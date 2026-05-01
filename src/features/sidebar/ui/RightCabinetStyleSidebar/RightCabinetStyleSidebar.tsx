import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";

import { FilterSelection } from "@/shared/ui/Filter/FilterSelection";
import { BaseButton } from "@/shared/ui/Buttons/BaseButton";
import { PopupCenterContent } from "@/shared/ui/Popups/PopupCenterContent/PopupCenterContent";
import image from "../../../../shared/assets/images/png/img_png.png";
import upperHandleImage from "@/shared/assets/images/jpeg/UpperGHandle.jpg";
import centralHandleImage from "@/shared/assets/images/jpeg/CentralGHandle.jpg";
import ptoHandleImage from "@/shared/assets/images/jpeg/PTOHandle.jpg";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { cmToInches, getCountertopMaterialTokensBySku } from "@/shared/lib/sku";
import { getIsActiveStyleSidebar } from "../../model/store/selectors";
import { setOpenStyleSidebar } from "../../model/store/slice";
import {
  getDimensionOptions,
  getDrawerProduct,
  getCabinetColor,
  getCountertopColorSku,
  getCountertopStyle,
  getHandleGrooveColor,
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getActiveCabinetRule,
  getDrawerPanelFluting,
  getGrainDirection,
  getSelectedDimensions,
  getSelectedProducts,
  getSelectedProductConfig,
  getHeightLocked,
  getSinkType,
  getVesselColor,
} from "@/entities/product/model/store/selectors";
import {
  addProductId,
  removeProductId,
  setHasBootstrappedCabinetBuilder,
  setPlacedCabinetStyle,
  setSelectedDimensions,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";

import s from "./RightCabinetStyleSidebar.module.scss";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { setProductByParams } from "@/utils/functions/playcanvas/setProductByParams";
import { setVisibleButtons } from "@/utils/functions/playcanvas/setVisibleButtons";
import { setHandleButtonClick } from "@/utils/functions/playcanvas/setHandleButtonClick";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { setConfig } from "@/utils/functions/playcanvas/setConfig";
import { updateDimensionDataForProduct } from "@/utils/functions/playcanvas/updateDimensionData";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import { removeProduct } from "@/utils/functions/playcanvas/removeProduct";
import { autoRemoveSide as spAutoRemoveSide } from "@/features/sidePanel";
import { useGetConfiguratorQuery } from "@/entities";
import { buildHandleStyleConfigPatch } from "@/features/configurator-rule-core/cabinetBuilder";
import {
  filterDepthValuesByCountertopRules,
  filterWidthValuesByCountertopRules,
  useCountertopLengthGuard,
  useCountertopRules,
} from "@/features/configurator-rule-core/countertop";
import { cmToInchLabel } from "@/shared/lib/cmToInchLabel";

interface RightCabinetStyleSidebarProps {
  onProductAdded?: () => void;
}

interface PendingHandleChange {
  next: string;
  previous: string | undefined;
  previousDimensions: {
    width: number | null;
    height: number | null;
    depth: number | null;
  };
}

interface PendingOssHandleChange {
  next: string;
  previous: string | undefined;
  previousDimensions: {
    width: number | null;
    height: number | null;
    depth: number | null;
  };
  ossIds: string[];
}

interface PendingDepthChange {
  next: number;
  previous: number | null;
}

export const RightCabinetStyleSidebar = ({ onProductAdded }: RightCabinetStyleSidebarProps) => {
  const dispatch = useAppDispatch();
  const isOpenedStyleSidebar = useAppSelector(getIsActiveStyleSidebar);
  const isPlayCanvasReady = usePlayCanvasReady();
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const placementButtonsVisibleRef = useRef(false);

  const dimensionOptions = useAppSelector(getDimensionOptions);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const activeDrawerProduct = useAppSelector(getDrawerProduct);
  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const activeCabinetRule = useAppSelector(getActiveCabinetRule);
  const heightLocked = useAppSelector(getHeightLocked);
  const cabinetColor = useAppSelector(getCabinetColor);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const countertopColorSku = useAppSelector(getCountertopColorSku);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const countertopThickness = useAppSelector(getActiveCountertopThickness);
  const drawerPanelFluting = useAppSelector(getDrawerPanelFluting);
  const grainDirection = useAppSelector(getGrainDirection);
  const sinkType = useAppSelector(getSinkType);
  const vesselColor = useAppSelector(getVesselColor);
  const lengthGuard = useCountertopLengthGuard(selectedProducts, selectedDimensions.width ?? null);
  const sceneTotalWidth = lengthGuard.currentWithSp;
  const maxCountertopLength = lengthGuard.max;

  const saveSnapshot = useHistorySnapshot();
  const { data: counterTopMaterials } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });
  const handlesDisabled = Boolean(activeCabinetRule?.isOpen) || dimensionOptions.handles.length === 0;
  const [pendingHandleChange, setPendingHandleChange] = useState<PendingHandleChange | null>(null);
  const [pendingOssHandleChange, setPendingOssHandleChange] = useState<PendingOssHandleChange | null>(null);
  const [pendingDepthChange, setPendingDepthChange] = useState<PendingDepthChange | null>(null);
  const [handleLockNotice, setHandleLockNotice] = useState<string | null>(null);
  const hasModalOpen =
    pendingHandleChange !== null ||
    pendingOssHandleChange !== null ||
    pendingDepthChange !== null ||
    handleLockNotice !== null;

  const handleOptions = useMemo(
    () =>
      dimensionOptions.handles?.length
        ? dimensionOptions.handles
        : handlesDisabled
          ? []
          : [
              { label: "Push to open", value: "handle_pto" },
              { label: "Upper Groove", value: "handle_urban_topcut" },
              { label: "Central Groove", value: "handle_urban_botcut" },
            ],
    [dimensionOptions.handles, handlesDisabled],
  );

  const handleImage = useMemo(() => {
    const value = selectedProductConfig?.Handle;
    if (value === "handle_urban_topcut") return upperHandleImage;
    if (value === "handle_urban_botcut") return centralHandleImage;
    if (value === "handle_pto") return ptoHandleImage;
    return image;
  }, [selectedProductConfig?.Handle]);

  const normalizeMaterialLabel = (value: string) => {
    const parts = value
      .split(":")
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : value;
  };

  const toOptionalString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

  const toStringArrayFromCsv = (value: unknown): string[] => {
    if (typeof value !== "string") return [];
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  };

  const countertopOptionsFromApi = useMemo(() => {
    const availableOptions = ((counterTopMaterials as { availableOptions?: Array<Record<string, unknown>> } | undefined)
      ?.availableOptions ?? []) as Array<Record<string, unknown>>;
    const groups = availableOptions.filter((group) => group.proxyName === "Countertop Color");
    if (!groups.length) return [];

    const buildMaterialTokens = (name: string, metaMaterial?: string, extraTokens: string[] = []) => {
      const tokens = new Set<string>();
      if (metaMaterial) {
        toStringArrayFromCsv(metaMaterial).forEach((token) => tokens.add(token));
      }
      if (name) tokens.add(name);
      extraTokens.forEach((token) => {
        if (token) tokens.add(token);
      });

      const parts = name
        .split(":")
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length > 1) tokens.add(parts[parts.length - 1]);
      return Array.from(tokens);
    };

    return groups.flatMap((group) => {
      const options = (group.options as Array<Record<string, unknown>> | undefined) ?? [];
      return options.flatMap((option) => {
        const variants = (option.variants as Array<Record<string, unknown>> | undefined) ?? [];
        return variants
          .filter((variant) => variant.enabled)
          .map((variant) => {
            const variantMeta =
              typeof variant.metadata === "object" && variant.metadata
                ? (variant.metadata as Record<string, unknown>)
                : ({} as Record<string, unknown>);
            const nestedMeta =
              typeof variantMeta.metadata === "object" && variantMeta.metadata
                ? (variantMeta.metadata as Record<string, unknown>)
                : ({} as Record<string, unknown>);

            const pick = (...values: unknown[]): string | undefined => {
              for (const value of values) {
                const str = toOptionalString(value);
                if (str) return str;
              }
              return undefined;
            };

            const metaMaterial = pick(nestedMeta.Material, variantMeta.Material);
            const descSource = String(option.name ?? group.proxyName ?? variant.name ?? "");

            return {
              name: String(variant.name ?? ""),
              title: pick(variantMeta.label, variantMeta.Label, nestedMeta.label, nestedMeta.Label, variant.name) ?? "",
              desc: normalizeMaterialLabel(descSource),
              metadata: {
                sku: pick(variantMeta.sku),
                value: pick(variantMeta.value, nestedMeta.value, variant.name) ?? String(variant.name ?? ""),
                materials: buildMaterialTokens(
                  String(option.name ?? variant.name ?? ""),
                  metaMaterial,
                  typeof group.proxyName === "string" ? [group.proxyName] : [],
                ),
              },
            };
          });
      });
    });
  }, [counterTopMaterials]);

  const activeMaterialTokens = useMemo(() => {
    if (!countertopColor) return [];
    const match = countertopOptionsFromApi.find((option) => {
      const candidate = option.metadata?.value ?? option.name ?? option.title ?? option.desc;
      if (candidate !== countertopColor) return false;

      const optionSku = option.metadata?.sku?.trim();
      return !countertopColorSku || !optionSku || optionSku === countertopColorSku;
    });
    return match?.metadata?.materials ?? getCountertopMaterialTokensBySku(countertopColorSku);
  }, [countertopColor, countertopColorSku, countertopOptionsFromApi]);

  const countertopRules = useCountertopRules();
  const widthOptions = useMemo(() => {
    const values = dimensionOptions.width.filter((option) => !option.disabled).map((option) => option.value);
    const filteredValues = filterWidthValuesByCountertopRules({
      values,
      activeCabinetCode: activeCabinetRule?.code,
      isSinkBaseCabinet: activeDrawerProduct?.toLowerCase().includes("sink-base"),
      activeCabinetIsOpen: Boolean(activeCabinetRule?.isOpen),
      activeMaterialTokens,
      rules: countertopRules,
      selectedDepth: selectedDimensions.depth ?? null,
      activeCountertopStyle: countertopStyle ?? null,
      activeBasinStyle: sinkType ?? null,
      activeThickness: countertopThickness ?? null,
    });
    const remainingForAdd =
      maxCountertopLength !== null && sceneTotalWidth !== null ? maxCountertopLength - sceneTotalWidth : null;

    return dimensionOptions.width.filter((option) => {
      if (option.disabled) return false;
      if (!filteredValues.includes(option.value)) return false;
      if (remainingForAdd === null) return true;
      const numericWidth = Number(option.value);
      if (!Number.isFinite(numericWidth)) return false;
      return numericWidth <= remainingForAdd + 0.01;
    });
  }, [
    activeCabinetRule?.code,
    activeDrawerProduct,
    activeMaterialTokens,
    countertopRules,
    dimensionOptions.width,
    maxCountertopLength,
    sceneTotalWidth,
    selectedDimensions.depth,
    activeCabinetRule?.isOpen,
    countertopStyle,
    sinkType,
    countertopThickness,
  ]);

  const depthOptions = useMemo(() => {
    const values = dimensionOptions.depth.filter((option) => !option.disabled).map((option) => option.value);
    const filteredValues = filterDepthValuesByCountertopRules({
      values,
      activeMaterialTokens,
      rules: countertopRules,
      activeCountertopStyle: countertopStyle ?? null,
      activeBasinStyle: sinkType ?? null,
    });
    const allowedValues = new Set(filteredValues.map((value) => String(value)));
    return dimensionOptions.depth.filter((option) => !option.disabled && allowedValues.has(String(option.value)));
  }, [activeMaterialTokens, countertopRules, countertopStyle, sinkType, dimensionOptions.depth]);

  const widthDisplayOptions = useMemo(
    () =>
      widthOptions.map((option) => ({
        ...option,
        label: cmToInchLabel(Number(option.value)),
      })),
    [widthOptions],
  );

  const depthDisplayOptions = useMemo(
    () =>
      depthOptions.map((option) => ({
        ...option,
        label: cmToInchLabel(Number(option.value)),
      })),
    [depthOptions],
  );

  const productConfig = useMemo(() => {
    if (selectedDimensions.width === null || selectedDimensions.height === null || selectedDimensions.depth === null) {
      return null;
    }

    return {
      ...selectedProductConfig,
      Width: selectedDimensions.width,
      Height: selectedDimensions.height,
      Depth: selectedDimensions.depth,
      CabinetColor: cabinetColor,
      CountertopColor: countertopColor,
      HandleGrooveColor: handleGrooveColor,
      DrawerPanelFluting: drawerPanelFluting,
      GrainDirection: grainDirection,
    };
  }, [
    cabinetColor,
    countertopColor,
    handleGrooveColor,
    drawerPanelFluting,
    grainDirection,
    selectedDimensions.depth,
    selectedDimensions.height,
    selectedDimensions.width,
    selectedProductConfig,
  ]);

  const handleCloseSidebar = () => {
    dispatch(setOpenStyleSidebar(false));
  };

  const handleChangeWidth = (value?: string | number) => {
    if (value === undefined) return;
    dispatch(setSelectedDimensions({ width: Number(value) }));
  };

  const closePendingDepthChange = (isConfirmed = false) => {
    if (!pendingDepthChange) return;

    const { previous, next } = pendingDepthChange;
    setPendingDepthChange(null);

    if (isConfirmed || previous === next) return;

    dispatch(setSelectedDimensions({ depth: previous }));
  };

  const handleChangeDepth = (value?: string | number) => {
    if (value === undefined) return;
    const nextDepth = Number(value);
    const isAllowedDepth = depthOptions.some((option) => {
      const optionValue = Number(option.value);
      return Number.isFinite(optionValue) && Math.abs(optionValue - nextDepth) < 0.01;
    });
    if (!isAllowedDepth) return;

    const previousDepth = selectedDimensions.depth;
    if (previousDepth === nextDepth) return;

    dispatch(setSelectedDimensions({ depth: nextDepth }));

    if (selectedProducts.length > 0) {
      setPendingDepthChange({
        next: nextDepth,
        previous: previousDepth,
      });
    }
  };

  // const handleChangeHeight = (value: string | number) => {
  //   dispatch(setSelectedDimensions({ height: Number(value) }));
  // };

  const applyHandleType = async (handleType: string) => {
    await saveSnapshot();
    dispatch(
      setSelectedProductConfig({
        ...(selectedProductConfig ?? {}),
        Handle: handleType,
      }),
    );

    if (selectedProducts.length) {
      await setConfigBatch(selectedProducts, buildHandleStyleConfigPatch(handleType, handleGrooveColor));
    }
  };

  const restoreHandleType = async (
    handleType: string | undefined,
    previousDimensions: { width: number | null; height: number | null; depth: number | null },
  ) => {
    if (!handleType) return;

    dispatch(
      setSelectedProductConfig({
        ...(selectedProductConfig ?? {}),
        Handle: handleType,
      }),
    );

    if (selectedProducts.length) {
      await setConfigBatch(selectedProducts, buildHandleStyleConfigPatch(handleType, handleGrooveColor));
    }

    dispatch(setSelectedDimensions(previousDimensions));

    const dimConfig: { Height?: number; Depth?: number } = {};
    if (typeof previousDimensions.height === "number") {
      dimConfig.Height = previousDimensions.height;
    }
    if (typeof previousDimensions.depth === "number") {
      dimConfig.Depth = previousDimensions.depth;
    }

    if (selectedProducts.length && Object.keys(dimConfig).length > 0) {
      await setConfigBatch({}, dimConfig);
      selectedProducts.forEach((id) => updateDimensionDataForProduct(id, dimConfig));
    }
  };

  const closePendingHandleChange = async (isConfirmed = false) => {
    if (!pendingHandleChange) return;

    const { previous, next, previousDimensions } = pendingHandleChange;
    setPendingHandleChange(null);

    if (isConfirmed || previous === next) return;

    await restoreHandleType(previous, previousDimensions);
  };

  const handleSetHandleType = async (handleType: string) => {
    const previousHandle = selectedProductConfig?.Handle as string | undefined;

    if (typeof heightLocked === "number") {
      const option = dimensionOptions.handles.find((item) => String(item.value) === handleType);
      if (option?.disabled && option.reason?.startsWith("Not available for current configuration height")) {
        const ossIdsForLock = selectedProducts.filter((id) => id.toLowerCase().includes("side-shelf"));
        if (ossIdsForLock.length > 0 && handleType !== "handle_pto" && previousHandle === "handle_pto") {
          setPendingOssHandleChange({
            next: handleType,
            previous: previousHandle,
            previousDimensions: {
              width: selectedDimensions.width,
              height: selectedDimensions.height,
              depth: selectedDimensions.depth,
            },
            ossIds: ossIdsForLock,
          });
          return;
        }

        setHandleLockNotice(
          `A module with only ${heightLocked} cm (${cmToInches(heightLocked)}") height is present (e.g. Side Shelf). While it is on the scene, only handles for ${heightLocked} cm (${cmToInches(heightLocked)}") are available.`,
        );
        return;
      }
    }

    if (previousHandle === handleType) return;

    const isSwitchingAwayFromPto = previousHandle === "handle_pto" && handleType !== "handle_pto";
    const ossIds = selectedProducts.filter((id) => id.toLowerCase().includes("side-shelf"));
    if (isSwitchingAwayFromPto && ossIds.length > 0) {
      setPendingOssHandleChange({
        next: handleType,
        previous: previousHandle,
        previousDimensions: {
          width: selectedDimensions.width,
          height: selectedDimensions.height,
          depth: selectedDimensions.depth,
        },
        ossIds,
      });
      return;
    }

    await applyHandleType(handleType);

    if (selectedProducts.length > 0) {
      setPendingHandleChange({
        next: handleType,
        previous: previousHandle,
        previousDimensions: {
          width: selectedDimensions.width,
          height: selectedDimensions.height,
          depth: selectedDimensions.depth,
        },
      });
    }
  };

  const closePendingOssHandleChange = () => {
    setPendingOssHandleChange(null);
  };

  const confirmPendingOssHandleChange = async () => {
    if (!pendingOssHandleChange) return;
    const { next, previous, previousDimensions, ossIds } = pendingOssHandleChange;
    setPendingOssHandleChange(null);

    for (const ossId of ossIds) {
      await removeProduct(ossId);
      dispatch(removeProductId(ossId));
    }

    await applyHandleType(next);

    if (selectedProducts.length - ossIds.length > 0) {
      setPendingHandleChange({
        next,
        previous,
        previousDimensions,
      });
    }
  };

  useEffect(() => {
    if (!isOpenedStyleSidebar) return;
    if (!selectedProducts.length) return;
    if (selectedDimensions.height === null || selectedDimensions.depth === null || selectedDimensions.width === null) {
      return;
    }

    const dimConfig = { Height: selectedDimensions.height, Depth: selectedDimensions.depth };
    setConfigBatch({}, dimConfig);

    selectedProducts.forEach((id) => updateDimensionDataForProduct(id, dimConfig));
  }, [selectedDimensions, selectedProducts, isOpenedStyleSidebar]);

  const prevHandleRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Only set default Handle if it's completely missing (first time, no previous selection)
    if (!handlesDisabled && !selectedProductConfig?.Handle && selectedProductConfig !== null) {
      dispatch(
        setSelectedProductConfig({
          ...selectedProductConfig,
          Handle: "handle_urban_topcut",
        }),
      );
    }
  }, [dispatch, selectedProductConfig, handlesDisabled]);

  // Sync handle to PlayCanvas when it changes (e.g. auto-reset due to rule change)
  useEffect(() => {
    const currentHandle = typeof selectedProductConfig?.Handle === "string" ? selectedProductConfig.Handle : undefined;
    const prevHandle = prevHandleRef.current;
    prevHandleRef.current = currentHandle;

    if (!currentHandle || currentHandle === prevHandle) return;
    if (!selectedProducts.length) return;

    setConfigBatch(selectedProducts, buildHandleStyleConfigPatch(currentHandle, handleGrooveColor));
  }, [handleGrooveColor, selectedProductConfig?.Handle, selectedProducts]);

  // Show plus buttons when the sidebar is opened.
  useEffect(() => {
    const hasAddableWidth = widthOptions.length > 0;
    const options =
      isOpenedStyleSidebar && activeDrawerProduct === "Side-Shelf" ? { productType: "Side-Shelf" } : undefined;
    const shouldShowPlacementButtons = isOpenedStyleSidebar && hasAddableWidth;

    setVisibleButtons(shouldShowPlacementButtons, options);
    placementButtonsVisibleRef.current = shouldShowPlacementButtons;
  }, [activeDrawerProduct, isOpenedStyleSidebar, widthOptions.length]);

  useEffect(
    () => () => {
      if (!placementButtonsVisibleRef.current) return;
      setVisibleButtons(false);
    },
    [],
  );

  // Close sidebar when clicking outside of it.
  useEffect(() => {
    if (!isOpenedStyleSidebar) return;
    if (hasModalOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!sidebarRef.current) return;

      const target = event.target as Element | null;
      if (target?.closest?.('[data-filter-menu="true"]')) return;

      if (sidebarRef.current.contains(event.target as Node)) return;

      dispatch(setOpenStyleSidebar(false));
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [dispatch, hasModalOpen, isOpenedStyleSidebar]);

  // Set the product to the desired side (left/right).
  useEffect(() => {
    if (!isPlayCanvasReady) return;

    const onPlusClick = async (entityId: string, side: "left" | "right") => {
      console.log("Clicked Plus Button", entityId, side);

      if (!activeDrawerProduct) return;
      const availableAddWidths = filterWidthValuesByCountertopRules({
        values: dimensionOptions.width.filter((option) => !option.disabled).map((option) => option.value),
        activeCabinetCode: activeCabinetRule?.code,
        activeCabinetIsOpen: Boolean(activeCabinetRule?.isOpen),
        activeMaterialTokens,
        rules: countertopRules,
        selectedDepth: selectedDimensions.depth ?? null,
      })
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);

      const remainingForAdd =
        maxCountertopLength !== null && sceneTotalWidth !== null ? maxCountertopLength - sceneTotalWidth : null;
      const fittingAddWidths =
        remainingForAdd === null
          ? availableAddWidths
          : availableAddWidths.filter((width) => width <= remainingForAdd + 0.01);

      if (
        maxCountertopLength !== null &&
        sceneTotalWidth !== null &&
        selectedProducts.length > 0 &&
        !fittingAddWidths.length
      ) {
        console.warn("[RightCabinetStyleSidebar] Add blocked by countertop max length", {
          maxCountertopLength,
          sceneTotalWidth,
          requestedWidth: selectedDimensions.width,
          availableAddWidths,
          fittingAddWidths,
        });
        return;
      }

      const selectedWidthIsFitting =
        typeof selectedDimensions.width === "number" &&
        Number.isFinite(selectedDimensions.width) &&
        (remainingForAdd === null || selectedDimensions.width <= remainingForAdd + 0.01);
      const fallbackWidth =
        fittingAddWidths.length > 0
          ? fittingAddWidths.reduce((max, width) => (width > max ? width : max), fittingAddWidths[0])
          : null;
      const widthForAddedCabinet = selectedWidthIsFitting ? selectedDimensions.width : fallbackWidth;

      if (activeDrawerProduct === "Side-Shelf") {
        await spAutoRemoveSide(dispatch, side);
      }

      await saveSnapshot();
      const productId = await setProductByParams(activeDrawerProduct, entityId, side);

      if (!productId) return;

      if (productConfig || widthForAddedCabinet !== null) {
        const isSinkBase = activeDrawerProduct.toLowerCase().includes("sink-base");
        const isVesselStyle = countertopStyle?.toLowerCase() === "vessel";
        const resolvedSinkType = sinkType || (isVesselStyle ? "Vessel" : "");
        const nextConfig: Record<string, unknown> =
          isSinkBase && (resolvedSinkType || countertopStyle)
            ? {
                ...productConfig,
                ...(resolvedSinkType ? { sinkType: resolvedSinkType } : {}),
                ...(countertopStyle ? { CountertopStyle: countertopStyle } : {}),
              }
            : { ...(productConfig ?? {}) };

        if (widthForAddedCabinet !== null) {
          nextConfig.Width = widthForAddedCabinet;
        }

        await setConfig(productId, nextConfig);

        if (
          vesselColor &&
          typeof nextConfig.sinkType === "string" &&
          String(nextConfig.sinkType).startsWith("Vessel")
        ) {
          await setConfigBatch({ productType: "Sink-Base" }, { VesselColor: vesselColor });
        }
      }

      dispatch(addProductId(productId));
      dispatch(setHasBootstrappedCabinetBuilder(true));

      const drawers = (productConfig as Record<string, unknown>)?.Drawers as string | undefined;
      const drawerRawValue = drawers === "1D" ? "1" : drawers === "2D" ? "2" : drawers === "1DWID" ? "1+inner" : null;
      if (drawerRawValue) dispatch(setPlacedCabinetStyle({ id: productId, value: drawerRawValue }));

      // Close sidebar and reset accordion to default state
      dispatch(setOpenStyleSidebar(false));
      if (onProductAdded) {
        onProductAdded();
      }
      // Keep last active cabinet type for downstream UI rules (e.g., side panels).
    };

    setHandleButtonClick(onPlusClick);
  }, [
    isPlayCanvasReady,
    activeDrawerProduct,
    maxCountertopLength,
    onProductAdded,
    productConfig,
    saveSnapshot,
    sceneTotalWidth,
    selectedDimensions.width,
    selectedProducts.length,
    activeCabinetRule?.code,
    activeCabinetRule?.isOpen,
    activeMaterialTokens,
    countertopRules,
    dimensionOptions.width,
    selectedDimensions.depth,
    sinkType,
    dispatch,
    vesselColor,
    countertopStyle,
  ]);

  return (
    <>
      <PopupCenterContent isOpening={handleLockNotice !== null} onClose={() => setHandleLockNotice(null)}>
        <div className={s.confirmPopup}>
          <div className={s.confirmHeader}>
            <div className={s.confirmTitle}>Handle Change Blocked</div>
            <div className={s.confirmClose} onClick={() => setHandleLockNotice(null)}>
              <CloseBtnIcon />
            </div>
          </div>
          <div className={s.confirmContent}>
            <p>{handleLockNotice}</p>
          </div>
          <div className={s.confirmFooter}>
            <div>
              <BaseButton onClick={() => setHandleLockNotice(null)} fullWidth={true}>
                Ok
              </BaseButton>
            </div>
          </div>
        </div>
      </PopupCenterContent>

      <PopupCenterContent isOpening={pendingHandleChange !== null} onClose={() => void closePendingHandleChange()}>
        <div className={s.confirmPopup}>
          <div className={s.confirmHeader}>
            <div className={s.confirmTitle}>Handle Style Updated</div>
            <div className={s.confirmClose} onClick={() => void closePendingHandleChange()}>
              <CloseBtnIcon />
            </div>
          </div>
          <div className={s.confirmContent}>
            <p>The handle style has been updated for all drawer cabinets.</p>
          </div>
          <div className={s.confirmFooter}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <BaseButton variant="ghost" onClick={() => void closePendingHandleChange()} fullWidth={true}>
                Cancel
              </BaseButton>
              <BaseButton onClick={() => void closePendingHandleChange(true)} fullWidth={true}>
                Confirm
              </BaseButton>
            </div>
          </div>
        </div>
      </PopupCenterContent>

      <PopupCenterContent isOpening={pendingOssHandleChange !== null} onClose={closePendingOssHandleChange}>
        <div className={s.confirmPopup}>
          <div className={s.confirmHeader}>
            <div className={s.confirmTitle}>Remove Side Shelf?</div>
            <div className={s.confirmClose} onClick={closePendingOssHandleChange}>
              <CloseBtnIcon />
            </div>
          </div>
          <div className={s.confirmContent}>
            <p>Side Shelf cabinets are only compatible with a PTO handle.</p>
            <p>Switching to another handle will remove all Side Shelf cabinets. Continue?</p>
          </div>
          <div className={s.confirmFooter}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <BaseButton variant="ghost" onClick={closePendingOssHandleChange} fullWidth={true}>
                Cancel
              </BaseButton>
              <BaseButton onClick={() => void confirmPendingOssHandleChange()} fullWidth={true}>
                Approve
              </BaseButton>
            </div>
          </div>
        </div>
      </PopupCenterContent>

      <PopupCenterContent isOpening={pendingDepthChange !== null} onClose={() => closePendingDepthChange()}>
        <div className={s.confirmPopup}>
          <div className={s.confirmHeader}>
            <div className={s.confirmTitle}>Depth Updated</div>
            <div className={s.confirmClose} onClick={() => closePendingDepthChange()}>
              <CloseBtnIcon />
            </div>
          </div>
          <div className={s.confirmContent}>
            <p>The cabinet depth has been updated for all cabinets in your design.</p>
          </div>
          <div className={s.confirmFooter}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <BaseButton variant="ghost" onClick={() => closePendingDepthChange()} fullWidth={true}>
                Cancel
              </BaseButton>
              <BaseButton onClick={() => closePendingDepthChange(true)} fullWidth={true}>
                Confirm
              </BaseButton>
            </div>
          </div>
        </div>
      </PopupCenterContent>

      <div ref={sidebarRef} className={`${s.cabinetStyleSidebar} ${isOpenedStyleSidebar ? s.active : ""}`}>
        <div className={s.arrow} onClick={handleCloseSidebar}>
          <ArrowRight width="16" />
        </div>
        <div className={s.content}>
          <div className={s.contentItem}>
            <div>Width</div>
            <FilterSelection
              label={"Width"}
              options={widthDisplayOptions}
              value={selectedDimensions.width ?? ""}
              hintPlacement="left"
              showHints={false}
              onSelect={(value) => handleChangeWidth(value)}
            />
          </div>

          <div className={s.contentItem}>
            <div>Depth</div>
            <FilterSelection
              label={"Depth"}
              options={depthDisplayOptions}
              value={selectedDimensions.depth ?? ""}
              hintPlacement="left"
              showHints={false}
              onSelect={(value) => handleChangeDepth(value)}
            />
          </div>

          {/* <div className={s.contentItem}>
          <div>Height</div>
          <FilterSelection
            label={"Height"}
            options={dimensionOptions.height}
            value={selectedDimensions.height}
            onSelect={(value) => handleChangeHeight(value)}
          />
        </div> */}

          {!handlesDisabled && (
            <div className={s.contentItem}>
              <div>Handle</div>
              <FilterSelection
                label={"Handle"}
                options={handleOptions}
                value={selectedProductConfig?.Handle as string | undefined}
                hintPlacement="left"
                showHints={false}
                onSelect={(value) => {
                  if (value === undefined) return;
                  handleSetHandleType(String(value));
                }}
                onDisabledSelect={(value) => {
                  handleSetHandleType(String(value));
                }}
              />
            </div>
          )}

          {!handlesDisabled && (
            <div className={s.image}>
              <img src={handleImage} alt="handle preview" />
            </div>
          )}
        </div>

        <div className={s.bottomText}>
          Click <span className={s.plusButtonIcon}> + </span> button to place your cabinet
        </div>
      </div>
    </>
  );
};
