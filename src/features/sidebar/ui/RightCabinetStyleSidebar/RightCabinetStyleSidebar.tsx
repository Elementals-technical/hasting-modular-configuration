import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import {
  INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS,
  INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS,
  subscribeToInteractiveConfiguratorTutorialActiveStepChange,
} from "@/features/interactiveConfiguratorTutorial";

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
  getSelectedSceneProduct,
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
import { hasCapability, selectEffectiveFallback, selectOptions, useActiveCollection } from "@/entities/collection";
import {
  getActiveProductProfile,
  getCabinetDimensionsByRuntimeId,
  getCabinetEntries,
} from "@/entities/configuration/model/store/selectors";
import { useChangeAttribute } from "@/features/configurationCommands";
import type { ChangePreview, ChangeResult } from "@/features/configurationCommands";
import { withRuntimeProductType } from "@/entities/product/lib/resolveRuntimeProductType";
import {
  filterDepthValuesByCountertopRules,
  filterWidthValuesByCountertopRules,
  resolveMaxAddableCabinetWidthCm,
  useCountertopLengthGuard,
  useCountertopRules,
} from "@/features/configurator-rule-core/countertop";
import { cmToInchLabel } from "@/shared/lib/cmToInchLabel";

interface RightCabinetStyleSidebarProps {
  onProductAdded?: () => void;
}

const JOYRIDE_FLOATER_SELECTOR = ".react-joyride__floater";
const STYLE_SIDEBAR_LOCKED_TUTORIAL_STEP_IDS: ReadonlySet<string> = new Set([
  INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customSizingHandle,
  INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customPlaceCabinet,
]);

interface PendingOssHandleChange {
  next: string;
  ossIds: string[];
}

interface PendingDepthChange {
  next: number;
  previous: number | null;
}

/**
 * Presentation-only mapping. An unknown handle id falls back to the generic image
 * instead of gating behaviour, so a new handle renders without a change here.
 */
const HANDLE_IMAGES_BY_VALUE: Record<string, string> = {
  handle_urban_topcut: upperHandleImage,
  handle_urban_botcut: centralHandleImage,
  handle_pto: ptoHandleImage,
};

export const RightCabinetStyleSidebar = ({ onProductAdded }: RightCabinetStyleSidebarProps) => {
  const dispatch = useAppDispatch();
  const activeProfile = useAppSelector(getActiveProductProfile);
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
  const configuratorGroups = useActiveCollection((collection) => collection.catalog.configurator.groups);
  const handlesDisabled = Boolean(activeCabinetRule?.isOpen) || dimensionOptions.handles.length === 0;
  const [pendingHandlePreview, setPendingHandlePreview] = useState<ChangePreview | null>(null);
  const [pendingOssHandleChange, setPendingOssHandleChange] = useState<PendingOssHandleChange | null>(null);
  const [pendingDepthChange, setPendingDepthChange] = useState<PendingDepthChange | null>(null);
  const [handleLockNotice, setHandleLockNotice] = useState<string | null>(null);
  const [isStyleSidebarTutorialStepActive, setIsStyleSidebarTutorialStepActive] = useState(false);
  const { change: changeAttributeValue, confirm: confirmAttributeValue, getState: getCommandState } =
    useChangeAttribute();
  /** Height the command service is applying; the dimensions effect must not send it again. */
  const commandHeightRef = useRef<number | null>(null);
  const hasModalOpen =
    pendingHandlePreview !== null ||
    pendingOssHandleChange !== null ||
    pendingDepthChange !== null ||
    handleLockNotice !== null;

  const handleOptions = useMemo(
    () =>
      dimensionOptions.handles?.length
        ? dimensionOptions.handles
        : handlesDisabled
          ? []
          : // Fallback before the rules produced availability: the catalog of the active
            // collection, never a local list of handle ids.
            selectOptions(activeProfile, "Handle").map((option) => ({
              label: option.label,
              value: option.value,
            })),
    [dimensionOptions.handles, handlesDisabled, activeProfile],
  );

  const handleImage = useMemo(() => {
    const value = selectedProductConfig?.Handle;
    return (typeof value === "string" ? HANDLE_IMAGES_BY_VALUE[value] : undefined) ?? image;
  }, [selectedProductConfig?.Handle]);

  useEffect(
    () =>
      subscribeToInteractiveConfiguratorTutorialActiveStepChange(({ stepId }) => {
        setIsStyleSidebarTutorialStepActive(
          stepId !== null && STYLE_SIDEBAR_LOCKED_TUTORIAL_STEP_IDS.has(stepId),
        );
      }),
    [],
  );

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
    const groups = configuratorGroups.filter((group) => group.proxyName === "Countertop Color");
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
  }, [configuratorGroups]);

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
  const maxAddableCabinetWidth = useMemo(
    () =>
      resolveMaxAddableCabinetWidthCm({
        maxCm: maxCountertopLength,
        currentTotalCm: sceneTotalWidth,
      }),
    [maxCountertopLength, sceneTotalWidth],
  );

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
    const maxAddableWidth = selectedProducts.length ? maxAddableCabinetWidth : null;

    return dimensionOptions.width.filter((option) => {
      if (option.disabled) return false;
      if (!filteredValues.includes(option.value)) return false;
      if (maxAddableWidth === null) return true;
      const numericWidth = Number(option.value);
      if (!Number.isFinite(numericWidth)) return false;
      return numericWidth <= maxAddableWidth + 0.01;
    });
  }, [
    activeCabinetRule?.code,
    activeDrawerProduct,
    activeMaterialTokens,
    countertopRules,
    dimensionOptions.width,
    maxAddableCabinetWidth,
    selectedDimensions.depth,
    activeCabinetRule?.isOpen,
    countertopStyle,
    sinkType,
    countertopThickness,
    selectedProducts.length,
  ]);

  const depthOptions = useMemo(() => {
    const values = dimensionOptions.depth.filter((option) => !option.disabled).map((option) => option.value);
    const filteredValues = filterDepthValuesByCountertopRules({
      values,
      activeMaterialTokens,
      rules: countertopRules,
      activeCountertopStyle: countertopStyle ?? null,
      activeBasinStyle: sinkType ?? null,
      profile: activeProfile,
    });
    const allowedValues = new Set(filteredValues.map((value) => String(value)));
    return dimensionOptions.depth.filter((option) => !option.disabled && allowedValues.has(String(option.value)));
  }, [activeMaterialTokens, activeProfile, countertopRules, countertopStyle, sinkType, dimensionOptions.depth]);

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
    if (isStyleSidebarTutorialStepActive) return;

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

  /** Shows what the command service answered; an applied change needs nothing more. */
  const showHandleChangeResult = (result: ChangeResult) => {
    switch (result.status) {
      case "confirmation-required":
        setPendingHandlePreview(result.preview);
        return;
      case "blocked":
        setHandleLockNotice(result.reason);
        return;
      case "error":
        setHandleLockNotice(result.message);
        return;
      case "partial":
        setHandleLockNotice(
          `The handle was applied, but ${result.failed.map(({ change }) => change.attributeId).join(", ")} could not be updated.`,
        );
        return;
      case "applied":
        return;
    }
  };

  /**
   * A handle change goes through the command service: it checks the rules, asks for
   * confirmation when the profile says so, and sends the agreed set to the scene once.
   * Nothing changes before Confirm, so Cancel has nothing to revert.
   */
  const requestHandleChange = async (handleType: string) => {
    // Read at the moment of the change: removing Side Shelves just before changes the list.
    const cabinetId = getCabinetEntries(getCommandState())[0]?.stableKey;

    // No cabinet placed yet: this is the choice for the next cabinet; there is nothing to send.
    if (!cabinetId) {
      await saveSnapshot();
      dispatch(setSelectedProductConfig({ ...(selectedProductConfig ?? {}), Handle: handleType }));
      return;
    }

    showHandleChangeResult(
      await changeAttributeValue({ attributeId: "Handle", value: handleType, scope: "cabinet", cabinetId }),
    );
  };

  const closePendingHandlePreview = () => {
    setPendingHandlePreview(null);
  };

  const confirmPendingHandlePreview = async () => {
    if (!pendingHandlePreview) return;
    const preview = pendingHandlePreview;
    setPendingHandlePreview(null);

    await saveSnapshot();

    const plannedHeight = preview.plan.find(({ attributeId }) => attributeId === "Height")?.value;
    commandHeightRef.current = typeof plannedHeight === "number" ? plannedHeight : null;

    const result = await confirmAttributeValue(preview);

    if (result.status !== "applied" && result.status !== "partial") {
      commandHeightRef.current = null;
    }

    showHandleChangeResult(result);
  };

  const handleSetHandleType = async (handleType: string) => {
    const previousHandle = selectedProductConfig?.Handle as string | undefined;

    if (typeof heightLocked === "number") {
      const option = dimensionOptions.handles.find((item) => String(item.value) === handleType);
      if (option?.disabled && option.reason?.startsWith("Not available for current configuration height")) {
        const ossIdsForLock = selectedProducts.filter((id) => id.toLowerCase().includes("side-shelf"));
        const leavingNonGroove =
          !hasCapability(activeProfile, "Handle", previousHandle ?? null, "supportsGrooveColor") &&
          hasCapability(activeProfile, "Handle", handleType, "supportsGrooveColor");

        if (ossIdsForLock.length > 0 && leavingNonGroove) {
          setPendingOssHandleChange({ next: handleType, ossIds: ossIdsForLock });
          return;
        }

        setHandleLockNotice(
          `A module with only ${heightLocked} cm (${cmToInches(heightLocked)}") height is present (e.g. Side Shelf). While it is on the scene, only handles for ${heightLocked} cm (${cmToInches(heightLocked)}") are available.`,
        );
        return;
      }
    }

    if (previousHandle === handleType) return;

    const isSwitchingAwayFromPto =
      !hasCapability(activeProfile, "Handle", previousHandle ?? null, "supportsGrooveColor") &&
      hasCapability(activeProfile, "Handle", handleType, "supportsGrooveColor");
    const ossIds = selectedProducts.filter((id) => id.toLowerCase().includes("side-shelf"));
    if (isSwitchingAwayFromPto && ossIds.length > 0) {
      setPendingOssHandleChange({ next: handleType, ossIds });
      return;
    }

    await requestHandleChange(handleType);
  };

  const closePendingOssHandleChange = () => {
    setPendingOssHandleChange(null);
  };

  const confirmPendingOssHandleChange = async () => {
    if (!pendingOssHandleChange) return;
    const { next, ossIds } = pendingOssHandleChange;
    setPendingOssHandleChange(null);

    for (const ossId of ossIds) {
      await removeProduct(ossId);
      dispatch(removeProductId(ossId));
    }

    await requestHandleChange(next);
  };

  useEffect(() => {
    if (!isOpenedStyleSidebar) return;
    if (!selectedProducts.length) return;
    if (selectedDimensions.height === null || selectedDimensions.depth === null || selectedDimensions.width === null) {
      return;
    }

    // A height the command service just applied is already in the scene.
    if (commandHeightRef.current !== null && commandHeightRef.current === selectedDimensions.height) {
      commandHeightRef.current = null;
      return;
    }

    // Selecting another cabinet copies its actual size into the selection. That is not a change
    // to send: it would give every cabinet the selected one's height and depth (I04).
    const state = getCommandState();
    const hasSize = (dimensions: ReturnType<typeof getCabinetDimensionsByRuntimeId>) =>
      dimensions?.height === selectedDimensions.height && dimensions?.depth === selectedDimensions.depth;

    if (hasSize(getCabinetDimensionsByRuntimeId(state, getSelectedSceneProduct(state)))) return;

    // Opening the sidebar re-runs this effect; when every cabinet already has this size there is nothing to send.
    const placedCabinets = getCabinetEntries(state);
    if (
      placedCabinets.length > 0 &&
      placedCabinets.every(({ runtimeId }) => hasSize(getCabinetDimensionsByRuntimeId(state, runtimeId)))
    ) {
      return;
    }

    const dimConfig = { Height: selectedDimensions.height, Depth: selectedDimensions.depth };
    setConfigBatch({}, dimConfig);

    selectedProducts.forEach((id) => updateDimensionDataForProduct(id, dimConfig));
  }, [selectedDimensions, selectedProducts, isOpenedStyleSidebar, getCommandState]);

  useEffect(() => {
    // Only set default Handle if it's completely missing (first time, no previous selection)
    const fallbackHandle = selectEffectiveFallback(activeProfile, "Handle");

    if (!handlesDisabled && fallbackHandle && !selectedProductConfig?.Handle && selectedProductConfig !== null) {
      dispatch(
        setSelectedProductConfig({
          ...selectedProductConfig,
          Handle: fallbackHandle,
        }),
      );
    }
  }, [dispatch, selectedProductConfig, handlesDisabled, activeProfile]);

  // A handle changed by the rules reaches the scene through the handle listener in
  // optionsListener.ts; a user choice goes through the command service above.

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
    if (isStyleSidebarTutorialStepActive) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!sidebarRef.current) return;

      const target = event.target as Element | null;
      if (target?.closest?.('[data-filter-menu="true"]')) return;
      if (target?.closest?.(JOYRIDE_FLOATER_SELECTOR)) return;

      if (sidebarRef.current.contains(event.target as Node)) return;

      dispatch(setOpenStyleSidebar(false));
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [dispatch, hasModalOpen, isOpenedStyleSidebar, isStyleSidebarTutorialStepActive]);

  // Set the product to the desired side (left/right).
  useEffect(() => {
    if (!isPlayCanvasReady) return;

    const onPlusClick = async (entityId: string, side: "left" | "right") => {
      console.log("Clicked Plus Button", entityId, side);

      if (!activeDrawerProduct) return;
      const availableAddWidths = filterWidthValuesByCountertopRules({
        values: dimensionOptions.width.filter((option) => !option.disabled).map((option) => option.value),
        activeCabinetCode: activeCabinetRule?.code,
        isSinkBaseCabinet: activeDrawerProduct?.toLowerCase().includes("sink-base"),
        activeCabinetIsOpen: Boolean(activeCabinetRule?.isOpen),
        activeMaterialTokens,
        rules: countertopRules,
        selectedDepth: selectedDimensions.depth ?? null,
        activeCountertopStyle: countertopStyle ?? null,
        activeBasinStyle: sinkType ?? null,
        activeThickness: countertopThickness ?? null,
      })
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);

      const fittingAddWidths =
        maxAddableCabinetWidth === null
          ? availableAddWidths
          : availableAddWidths.filter((width) => width <= maxAddableCabinetWidth + 0.01);

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
        (maxAddableCabinetWidth === null || selectedDimensions.width <= maxAddableCabinetWidth + 0.01);
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
        const nextConfigBase: Record<string, unknown> =
          isSinkBase && (resolvedSinkType || countertopStyle)
            ? {
                ...productConfig,
                ...(resolvedSinkType ? { sinkType: resolvedSinkType } : {}),
                ...(countertopStyle ? { CountertopStyle: countertopStyle } : {}),
              }
            : { ...(productConfig ?? {}) };
        const nextConfig = withRuntimeProductType(nextConfigBase, activeDrawerProduct);

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
    maxAddableCabinetWidth,
    onProductAdded,
    productConfig,
    saveSnapshot,
    sceneTotalWidth,
    selectedDimensions.width,
    selectedProducts.length,
    activeCabinetRule?.code,
    activeCabinetRule?.isOpen,
    activeMaterialTokens,
    countertopStyle,
    countertopThickness,
    countertopRules,
    dimensionOptions.width,
    selectedDimensions.depth,
    sinkType,
    dispatch,
    vesselColor,
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

      <PopupCenterContent isOpening={pendingHandlePreview !== null} onClose={closePendingHandlePreview}>
        <div className={s.confirmPopup}>
          <div className={s.confirmHeader}>
            <div className={s.confirmTitle}>Update Handle Style?</div>
            <div className={s.confirmClose} onClick={closePendingHandlePreview}>
              <CloseBtnIcon />
            </div>
          </div>
          <div className={s.confirmContent}>
            <p>{pendingHandlePreview?.reasons[0]?.reason}</p>
          </div>
          <div className={s.confirmFooter}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <BaseButton variant="ghost" onClick={closePendingHandlePreview} fullWidth={true}>
                Cancel
              </BaseButton>
              <BaseButton onClick={() => void confirmPendingHandlePreview()} fullWidth={true}>
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

      <div
        ref={sidebarRef}
        className={`${s.cabinetStyleSidebar} ${isOpenedStyleSidebar ? s.active : ""}`}
        data-tutorial-target={INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS.customSizingHandle}
      >
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

          <div className={`${s.bottomText} ${s.mobileBottomText}`}>
            Click <span className={s.plusButtonIcon}> + </span> button to place your cabinet
          </div>

          {!handlesDisabled && (
            <div className={s.image}>
              <img src={handleImage} alt="handle preview" />
            </div>
          )}
        </div>

        <div className={`${s.bottomText} ${s.desktopBottomText}`}>
          Click <span className={s.plusButtonIcon}> + </span> button to place your cabinet
        </div>
      </div>
    </>
  );
};
