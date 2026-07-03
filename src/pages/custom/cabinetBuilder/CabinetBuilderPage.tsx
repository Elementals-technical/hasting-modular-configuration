import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductStyleGrid } from "@/entities/product/ui/ProductStyleGrid/ProductStyleGrid";
import { productMockData } from "@/entities/product/ui/ProductModelsGrid/ProductModelsGrid";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { InstructionPopup } from "@/shared/ui/Popups/ui/InstructionPopup/InstructionPopup";
import { PopupCenterContent } from "@/shared/ui/Popups/PopupCenterContent/PopupCenterContent";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { BaseButton } from "@/shared/ui/Buttons/BaseButton";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";

import { RightCabinetStyleSidebar } from "@/features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";
import {
  INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS,
  INTERACTIVE_CONFIGURATOR_TUTORIAL_ROUTE_QUERY,
  INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS,
  dispatchInteractiveConfiguratorTutorialSceneCabinetReady,
  subscribeToInteractiveConfiguratorTutorialActiveStepChange,
  subscribeToInteractiveConfiguratorTutorialEvent,
  subscribeToInteractiveConfiguratorTutorialSceneCabinetRequest,
} from "@/features/interactiveConfiguratorTutorial";

import { addProduct, type addProductConfigI } from "@/utils/functions/playcanvas/addProduct";
import { removeAllProducts } from "@/utils/functions/playcanvas/removeAllProducts";
import { removeProduct } from "@/utils/functions/playcanvas/removeProduct";
import {
  addProductId,
  reset,
  resetCabinetBuilderBootstrap,
  resetProducts,
  removeProductId,
  setActiveBasinStyle,
  setActiveCabinetType,
  setActiveCountertopColor,
  setCountertopColorSku,
  setActiveCountertopThickness,
  setBookMatching,
  setCabinetColor,
  setCountertopStyle,
  setDividersOption,
  setDividersStyle,
  setDrawerPanelFluting,
  setFaucetHolesAmount,
  setFaucetHolesSpacing,
  setGrainDirection,
  setHasBootstrappedCabinetBuilder,
  setHandleGrooveColor,
  setLedOption,
  setSelectedDimensions,
  setSelectedProductConfig,
  setSelectedSceneProduct,
  setTowelBarColor,
  setTowelBarOption,
  setVesselColor,
  setDrawerProduct,
  addProductPreset,
  setCabinetCatalog,
  setPlacedCabinetStyle,
  replacePlacedDividersForCabinet,
  switchAllCabinetsDrawerStyle,
  clearTopPlacedDividersForCabinets,
} from "@/entities/product/model/store/slice";

import {
  getActiveCabinetType,
  getActiveCabinetRule,
  getActiveCountertopThickness,
  getCabinetCatalog,
  getCabinetColor,
  getCountertopStyle,
  getHandleGrooveColor,
  getActiveCountertopColor,
  getSelectedProducts,
  getDrawerProduct,
  getDimensionOptions,
  getSelectedProductConfig,
  getSelectedDimensions,
  getSinkType,
  getVesselColor,
  getProductsPresets,
  getHasBootstrappedCabinetBuilder,
  getDominantDrawerGroup,
  getSinkBaseCount,
  getSideShelfCount,
  getPlacedCabinetStyles,
} from "@/entities/product/model/store/selectors";
import { selectCountertopCabinetCompositionConstraint } from "@/entities/product/model/store/derivedSelectors";
import { resolveCabinetTypeImage, resolveCabinetStyleImage } from "@/entities/product/lib/resolveCabinetImages";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import { applyConfiguratorRules, buildHandleStyleConfigPatch } from "@/features/configurator-rule-core/cabinetBuilder";
import {
  formatCompositionLengthReachedReason,
  useCountertopLengthGuard,
} from "@/features/configurator-rule-core/countertop";
import { getUniqueCatalogWidths } from "@/features/configurator-rule-core/cabinetBuilder";

import { getIsActiveStyleSidebar } from "@/features/sidebar/model/store/selectors";

import { cabinetTypeMetadataByCode, drawerMetaByValue } from "./constants";
import { DrawerStyleConflictPopup } from "./DrawerStyleConflictPopup";
import s from "./CabinetBuilderPage.module.scss";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { addPreset } from "@/utils/functions/playcanvas/addPreset";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { setConfig } from "@/utils/functions/playcanvas/setConfig";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { collectPlacedDividersFromConfig } from "@/utils/functions/playcanvas/dividers";
import { useLazyRestoreConfigurationQuery } from "@/entities";
import { buildPresetFromConfiguration } from "@/utils/buildPresetFromConfiguration";
import { useGetProductDatatableQuery } from "@/entities/product/api";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import { autoRemoveSide, isGrooveType, restoreSidePanelState, type SidePanelStatus } from "@/features/sidePanel";
import { enforceSidePanelEligibility } from "@/features/sidePanel/lib/sidePanelEnforce";
import { setSidePanelsOption, setSidePanelSideStatus } from "@/entities/product/model/store/slice";
import { captureSnapshot } from "@/entities/history/lib/captureSnapshot";
import { pushSnapshot, setHistoryRestoring } from "@/entities/history/model/store/slice";
import { store, type RootState } from "@/app/store";
import { showEmptyButton, hideEmptyButton } from "@/utils/functions/playcanvas/emptyButton";
import { applySwatchOrderFromMetadata } from "@/features/swatchOrder";

type AccordionConfig = {
  id: string;
  title: string;
  content: ReactNode;
  defaultOpen?: boolean;
  tutorialTarget?: string;
};

const CABINET_TYPE_ID = "cabinet-type";
const CABINET_STYLE_ID = "cabinet-style";
const defaultValue = CABINET_TYPE_ID;
const MATRIX_CABINET_DATATABLE_ID = 439;
const CUSTOM_DEFAULT_CABINET_COLOR = "Pulpis Chiaro TKH";
const CUSTOM_DEFAULT_COUNTERTOP_COLOR = "Cacao Orinoco FF MT";
const CUSTOM_DEFAULT_SINK_TYPE = "Top_Tekorlux_Rectangular";

const ENABLE_AUTO_ADD_FIRST_PRODUCT = false;

const PENDING_CUSTOM_DELETE_PRODUCT_ID_KEY = "pendingCustomDeleteProductId";

const isSidePanelStatus = (value: string | undefined): value is SidePanelStatus =>
  value === "active" || value === "none" || value === "auto-removed";

const resolveSidePanelStatus = (value: string | undefined, fallback: SidePanelStatus): SidePanelStatus =>
  isSidePanelStatus(value) ? value : fallback;

type AddSelectedCabinetToSceneOptions = {
  keepStyleSidebarOpen?: boolean;
  resetAccordionAfterAdd?: boolean;
};

const stripRuntimeSuffix = (value: string) => {
  const trimmed = value.trim();
  const lastDash = trimmed.lastIndexOf("-");
  if (lastDash <= 0) return trimmed;

  const suffix = trimmed.slice(lastDash + 1);
  if (/^[a-z0-9]{6,}$/i.test(suffix)) {
    return trimmed.slice(0, lastDash);
  }

  return trimmed;
};

const isSameRuntimeProduct = (left: string, right: string) =>
  left === right || stripRuntimeSuffix(left) === stripRuntimeSuffix(right);

const CABINET_TYPE_ORDER: Record<string, number> = {
  "Sink-Base": 0,
  "Sink-Cabinet": 1,
  "Side-Cabinet": 1,
  "Open-Shelf": 2,
  "Side-Shelf": 3,
};

const mapDrawerValueToConfig = (value?: string) => {
  if (value === "1") return "1D";
  if (value === "2") return "2D";
  if (value === "1+inner") return "1DWID";
  return undefined;
};

const mapConfigToDrawerValue = (config?: string): string | null => {
  if (config === "1D") return "1";
  if (config === "2D") return "2";
  if (config === "1DWID") return "1+inner";
  return null;
};

const inferCountertopStyleFromSinkType = (sinkType: string): "Vessel" | "Integrated" => {
  const trimmed = sinkType.trim();
  if (trimmed === "Vessel" || trimmed.startsWith("Vessel_")) return "Vessel";
  return "Integrated";
};

const readConfigDrawerValue = (config: unknown): string | null => {
  if (!config || typeof config !== "object") return null;

  const drawers = (config as Record<string, unknown>).Drawers;
  return typeof drawers === "string" ? mapConfigToDrawerValue(drawers) : null;
};

export const CabinetBuilderPage = () => {
  const [isOpenedBuildInfo, setIsOpenedBuildInfo] = useState(() => !sessionStorage.getItem("instractions"));
  const [accordionValue, setAccordionValue] = useState(defaultValue);
  const [activeStyleId, setActiveStyleId] = useState<number | null>(null);
  const [pendingMixingStyle, setPendingMixingStyle] = useState<{ id: number; value: string; title: string } | null>(
    null,
  );
  const [isPtoSwitchPromptOpen, setIsPtoSwitchPromptOpen] = useState(false);
  const [pendingTutorialDefaultCabinetType, setPendingTutorialDefaultCabinetType] = useState(false);
  const [pendingTutorialDefaultCabinetStyle, setPendingTutorialDefaultCabinetStyle] = useState(false);
  const [pendingTutorialSceneCabinetRequestId, setPendingTutorialSceneCabinetRequestId] = useState<string | null>(null);
  const [isInteractiveTutorialActive, setIsInteractiveTutorialActive] = useState(false);

  const bootstrappedRef = useRef(false);
  const customPresetInitializedRef = useRef<string | null>(null);
  const autoAddSignatureRef = useRef<string | null>(null);
  const handledPendingDeleteIdRef = useRef<string | null>(null);
  const isAddingTutorialSceneCabinetRef = useRef(false);
  // Set to true by explicit user selection after deletion, allowing auto-add to fire once more
  const allowNextAutoAddRef = useRef(false);

  const dispatch = useAppDispatch();
  const canvasReady = usePlayCanvasReady();

  const { pathname, key: locationKey } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const configId = searchParams.get("configId");
  const isInteractiveTutorialRoute =
    searchParams.get(INTERACTIVE_CONFIGURATOR_TUTORIAL_ROUTE_QUERY.name) ===
    INTERACTIVE_CONFIGURATOR_TUTORIAL_ROUTE_QUERY.value;
  const presetIdFromUrl = useMemo(() => {
    const rawPresetId = searchParams.get("preset");
    if (!rawPresetId) return null;

    const parsedPresetId = Number(rawPresetId);
    if (!Number.isFinite(parsedPresetId)) return null;

    return parsedPresetId;
  }, [searchParams]);
  const presetFromUrl = useMemo(() => {
    if (presetIdFromUrl === null) return null;
    return productMockData.find((item) => item.id === presetIdFromUrl) ?? null;
  }, [presetIdFromUrl]);
  const customPresetBootstrapKey = presetFromUrl ? String(presetFromUrl.id) : null;
  const [restoreConfiguration] = useLazyRestoreConfigurationQuery();

  const activeCabinetType = useAppSelector(getActiveCabinetType);
  const activeCabinetRule = useAppSelector(getActiveCabinetRule);
  const selectedProducts = useAppSelector(getSelectedProducts);

  const drawerProduct = useAppSelector(getDrawerProduct);
  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const cabinetCatalog = useAppSelector(getCabinetCatalog);
  const cabinetColor = useAppSelector(getCabinetColor);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const countertopThickness = useAppSelector(getActiveCountertopThickness);
  const sinkType = useAppSelector(getSinkType);
  const vesselColor = useAppSelector(getVesselColor);
  const dimensionOptions = useAppSelector(getDimensionOptions);
  const isStyleSidebarOpen = useAppSelector(getIsActiveStyleSidebar);
  const isStyleDrawerActive = Boolean(drawerProduct) && isStyleSidebarOpen;
  const productsPresets = useAppSelector(getProductsPresets);
  const hasBootstrappedCabinetBuilder = useAppSelector(getHasBootstrappedCabinetBuilder);
  const dominantDrawerGroup = useAppSelector(getDominantDrawerGroup);
  const sinkBaseCount = useAppSelector(getSinkBaseCount);
  const sideShelfCount = useAppSelector(getSideShelfCount);
  const placedCabinetStyles = useAppSelector(getPlacedCabinetStyles);
  const countertopCompositionConstraint = useAppSelector(selectCountertopCabinetCompositionConstraint);

  const { data: matrixCabinetTable, isLoading: isMatrixLoading } =
    useGetProductDatatableQuery(MATRIX_CABINET_DATATABLE_ID);

  // console.log("matrixCabinetTable", matrixCabinetTable);

  const saveSnapshot = useHistorySnapshot();
  const hasProducts = selectedProducts.length > 0;
  const lengthGuard = useCountertopLengthGuard(selectedProducts, selectedDimensions.width ?? null);
  const maxCountertopLength = lengthGuard.max;
  const remainingCountertopLength = lengthGuard.remaining;
  const compositionExceededReason =
    maxCountertopLength !== null
      ? formatCompositionLengthReachedReason(maxCountertopLength)
      : "Maximum composition length reached for the selected countertop setup.";

  const addableCatalogWidths = useMemo(() => {
    return getUniqueCatalogWidths(cabinetCatalog);
  }, [cabinetCatalog]);

  const canAddCabinetByLength = useMemo(() => {
    if (!hasProducts) return true;
    if (!addableCatalogWidths.length) return true;
    return addableCatalogWidths.some(lengthGuard.canAccommodate);
  }, [addableCatalogWidths, hasProducts, lengthGuard.canAccommodate]);

  const hasAddableWidthForActiveType = useMemo(() => {
    if (!hasProducts) return true;

    const activeTypeWidths = dimensionOptions.width
      .filter((option) => !option.disabled)
      .map((option) => Number(option.value))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (!activeTypeWidths.length) return false;
    return activeTypeWidths.some(lengthGuard.canAccommodate);
  }, [dimensionOptions.width, hasProducts, lengthGuard.canAccommodate]);

  const cabinetStyleOptions = useMemo(() => {
    const drawerOptionMap = new Map(dimensionOptions.drawers.map((option) => [String(option.value), option]));

    const activeDrawerValues = Array.from(drawerOptionMap.keys()).sort((a, b) => {
      const aNum = Number.parseFloat(a);
      const bNum = Number.parseFloat(b);
      const aIsNum = Number.isFinite(aNum);
      const bIsNum = Number.isFinite(bNum);

      if (aIsNum && bIsNum && aNum !== bNum) return bNum - aNum;
      if (aIsNum !== bIsNum) return aIsNum ? -1 : 1;
      return a.localeCompare(b);
    });
    const heightValue = selectedDimensions.height ?? 0;

    return activeDrawerValues.filter(Boolean).map((value, index) => {
      const ruleOption = drawerOptionMap.get(String(value));
      const meta = drawerMetaByValue[String(value)] ?? {
        id: 200 + index + 1,
        title: String(value),
        isShortDesc: false,
      };

      const isMixingRestricted =
        (dominantDrawerGroup === "double" && (value === "1" || value === "1+inner")) ||
        (dominantDrawerGroup === "single" && value === "2");

      return {
        id: meta.id,
        title: meta.title,
        value: String(value),
        isAvailable:
          countertopCompositionConstraint.canAddCabinet &&
          (ruleOption ? !ruleOption.disabled : true) &&
          hasAddableWidthForActiveType,
        disabledReason:
          !countertopCompositionConstraint.canAddCabinet && hasProducts
            ? countertopCompositionConstraint.reason
            : !hasAddableWidthForActiveType && hasProducts
              ? compositionExceededReason
              : ruleOption?.reason,
        isMixingRestricted,
        isShortDesc: meta.isShortDesc ?? false,
        metadata: {
          ...(meta.metadata ?? {}),
          image: resolveCabinetStyleImage(String(value), heightValue, activeCabinetType, meta.metadata?.image),
        },
      };
    });
  }, [
    selectedDimensions.height,
    dimensionOptions.drawers,
    activeCabinetType,
    dominantDrawerGroup,
    countertopCompositionConstraint.canAddCabinet,
    countertopCompositionConstraint.reason,
    hasAddableWidthForActiveType,
    hasProducts,
    compositionExceededReason,
  ]);

  const selectedHandle = typeof selectedProductConfig?.Handle === "string" ? selectedProductConfig.Handle : null;
  const isOssBlockedByHandle = Boolean(selectedHandle && selectedHandle !== "handle_pto");

  const hasBaseOrSideCabinetOnScene = useMemo(
    () =>
      selectedProducts.some((productId) => {
        const matchedRuleCode = cabinetCatalog.typeCabinetRules.find((rule) =>
          productId.toLowerCase().includes(rule.code.toLowerCase()),
        )?.code;
        return (
          matchedRuleCode === "Sink-Base" || matchedRuleCode === "Sink-Cabinet" || matchedRuleCode === "Side-Cabinet"
        );
      }),
    [selectedProducts, cabinetCatalog.typeCabinetRules],
  );

  const cabinetTypeOptions = useMemo(
    () =>
      [...cabinetCatalog.typeCabinetRules]
        .sort((a, b) => {
          const aOrder = CABINET_TYPE_ORDER[a.code] ?? Number.MAX_SAFE_INTEGER;
          const bOrder = CABINET_TYPE_ORDER[b.code] ?? Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.code.localeCompare(b.code);
        })
        .map((rule) => {
          const meta = cabinetTypeMetadataByCode[rule.code] ?? {};
          const heightValue = selectedDimensions.height ?? 0;
          const typeHasFittingWidth =
            !hasProducts ||
            remainingCountertopLength === null ||
            (rule.widths ?? []).some(
              (width) => Number.isFinite(width) && width > 0 && width <= remainingCountertopLength + 0.01,
            );

          const isSinkBaseDisabled = rule.code === "Sink-Base" && sinkBaseCount >= 2;
          const isSideShelfDisabled = rule.code === "Side-Shelf" && sideShelfCount >= 2;
          const isShelfRequiresBaseCabinet =
            (rule.code === "Open-Shelf" || rule.code === "Side-Shelf") && !hasBaseOrSideCabinetOnScene;
          const isSideShelfHandleBlocked = rule.code === "Side-Shelf" && isOssBlockedByHandle;
          const isLengthLimited = hasProducts && !typeHasFittingWidth;
          const isBlockedByCountertopComposition = hasProducts && !countertopCompositionConstraint.canAddCabinet;
          const isDisabled =
            isBlockedByCountertopComposition ||
            isSinkBaseDisabled ||
            isSideShelfDisabled ||
            isShelfRequiresBaseCabinet ||
            isSideShelfHandleBlocked ||
            isLengthLimited;
          const disabledReason = isBlockedByCountertopComposition
            ? countertopCompositionConstraint.reason
            : isSinkBaseDisabled
              ? "Vanity configurations allow a maximum of two Sink Base units."
              : isSideShelfDisabled
                ? "Vanity configurations allow a maximum of two Side Shelf units."
                : isShelfRequiresBaseCabinet
                  ? "Add at least one Sink Base or Side Cabinet first."
                  : isSideShelfHandleBlocked
                    ? "This cabinet type is only compatible with a PTO handle."
                    : isLengthLimited
                      ? compositionExceededReason
                      : undefined;

          return {
            id: rule.code,
            title: meta.title ?? rule.code.replace(/-/g, " "),
            name: rule.code,
            desc: meta.desc,
            isShortDesc: meta.isShortDesc ?? false,
            isAvailable: !isDisabled,
            disabledReason,
            disabledActionLabel:
              !isBlockedByCountertopComposition && !isShelfRequiresBaseCabinet && isSideShelfHandleBlocked
                ? "Switch to PTO handle here"
                : undefined,
            onDisabledAction:
              !isBlockedByCountertopComposition && !isShelfRequiresBaseCabinet && isSideShelfHandleBlocked
                ? () => setIsPtoSwitchPromptOpen(true)
                : undefined,
            metadata: {
              image: resolveCabinetTypeImage(rule.code, heightValue, dominantDrawerGroup, meta.image),
            },
          };
        }),
    [
      cabinetCatalog.typeCabinetRules,
      selectedDimensions.height,
      sinkBaseCount,
      sideShelfCount,
      dominantDrawerGroup,
      isOssBlockedByHandle,
      countertopCompositionConstraint.canAddCabinet,
      countertopCompositionConstraint.reason,
      hasBaseOrSideCabinetOnScene,
      hasProducts,
      remainingCountertopLength,
      compositionExceededReason,
    ],
  );

  const handleApprovePtoSwitch = useCallback(async () => {
    setIsPtoSwitchPromptOpen(false);
    if (hasProducts && !countertopCompositionConstraint.canAddCabinet) return;
    await saveSnapshot();
    dispatch(
      setSelectedProductConfig({
        ...(selectedProductConfig ?? {}),
        Handle: "handle_pto",
      }),
    );
    await setConfigBatch({}, buildHandleStyleConfigPatch("handle_pto", handleGrooveColor));
    dispatch(setActiveCabinetType("Side-Shelf"));
    dispatch(setDrawerProduct("Side-Shelf"));
    dispatch(setOpenStyleSidebar(true));
  }, [
    countertopCompositionConstraint.canAddCabinet,
    dispatch,
    handleGrooveColor,
    hasProducts,
    saveSnapshot,
    selectedProductConfig,
  ]);

  const handleClose = () => {
    sessionStorage.setItem("instractions", "1");
    setIsOpenedBuildInfo(false);
  };

  const handleSelectCabinetConfig = useCallback(
    (name?: string, config?: addProductConfigI) => {
      if (!name) return;
      if (hasProducts && !countertopCompositionConstraint.canAddCabinet) return;

      dispatch(setDrawerProduct(name));
      dispatch(setSelectedProductConfig(config ?? null));

      if (config?.sinkType) {
        dispatch(setActiveBasinStyle(config.sinkType));
      }
    },
    [countertopCompositionConstraint.canAddCabinet, dispatch, hasProducts],
  );

  const handleOpenStyleSidebar = useCallback(() => {
    dispatch(setOpenStyleSidebar(true));
  }, [dispatch]);

  const handleSelectDrawerStyle = useCallback(
    (id: number) => {
      if (hasProducts && !countertopCompositionConstraint.canAddCabinet) return;
      autoAddSignatureRef.current = null;
      if (!hasProducts) allowNextAutoAddRef.current = true;
      setActiveStyleId(id);

      const option = cabinetStyleOptions.find((item) => item.id === id);
      const mappedValue = mapDrawerValueToConfig(option?.value);

      if (mappedValue) {
        dispatch(
          setSelectedProductConfig({
            ...selectedProductConfig,
            Drawers: mappedValue,
          }),
        );
      }
    },
    [
      cabinetStyleOptions,
      countertopCompositionConstraint.canAddCabinet,
      dispatch,
      hasProducts,
      selectedProductConfig,
    ],
  );

  const handleResetToDefaultState = useCallback(() => {
    setAccordionValue(CABINET_TYPE_ID);
  }, []);

  const handleMixingRestrictedSelect = useCallback(
    (id: number) => {
      const option = cabinetStyleOptions.find((item) => item.id === id);
      if (!option) return;
      setPendingMixingStyle({ id, value: option.value ?? "", title: option.title });
    },
    [cabinetStyleOptions],
  );

  const handleMixingConfirm = useCallback(async () => {
    if (!pendingMixingStyle) return;

    const { id } = pendingMixingStyle;
    const option = cabinetStyleOptions.find((item) => item.id === id);
    const mappedValue = mapDrawerValueToConfig(option?.value);
    const drawerRawValue = option?.value;

    if (!mappedValue || !drawerRawValue) {
      setPendingMixingStyle(null);
      return;
    }

    setPendingMixingStyle(null);

    const isDrawerCabinetId = (productId: string) =>
      cabinetCatalog.typeCabinetRules.some(
        (rule) => !rule.isOpen && productId.toLowerCase().includes(rule.code.toLowerCase()),
      );

    const cabinetIdsToUpdate = Array.from(
      new Set([...selectedProducts.filter(isDrawerCabinetId), ...Object.keys(placedCabinetStyles)]),
    );
    const inferredCabinetType =
      cabinetIdsToUpdate
        .map(
          (productId) =>
            cabinetCatalog.typeCabinetRules.find((rule) => productId.toLowerCase().includes(rule.code.toLowerCase()))
              ?.code,
        )
        .find((code): code is string => Boolean(code)) ?? activeCabinetType;

    if (!inferredCabinetType) {
      return;
    }

    // Compute the full rules result for the new drawer selection to capture any rule-driven changes
    // (e.g. handle_urban_topcut may force a different height for 1DW vs 2DW).
    // Use selectedProductIds:[] so supportsHeightForAllProducts always returns true —
    // we are switching ALL cabinets, so old-style products must not block the height change.
    const rulesResult = applyConfiguratorRules(
      {
        cabinetType: inferredCabinetType,
        width: selectedDimensions.width ?? 0,
        depth: selectedDimensions.depth ?? 0,
        height: selectedDimensions.height ?? 0,
        drawers: drawerRawValue,
        handle: typeof selectedProductConfig?.Handle === "string" ? selectedProductConfig.Handle : undefined,
      },
      undefined,
      { selectedProductIds: [] },
      cabinetCatalog,
    );

    // Handle: replicate applyRulesToState auto-change logic so PlayCanvas stays in sync
    const currentHandle = typeof selectedProductConfig?.Handle === "string" ? selectedProductConfig.Handle : null;
    let newHandle: string | null = currentHandle;
    const handles = rulesResult.availableOptions.handles;

    if (currentHandle && handles.length > 0) {
      const handleOption = handles.find((h) => h.value === currentHandle);
      if (handleOption && !handleOption.enabled && !handleOption.deferAutoChange) {
        const preferred =
          typeof rulesResult.heightLocked === "number"
            ? handles.find((h) => h.value === "handle_pto" && h.enabled)
            : undefined;
        const firstEnabled = preferred ?? handles.find((h) => h.enabled);
        newHandle = firstEnabled ? String(firstEnabled.value) : null;
      }
    } else if (!currentHandle && typeof rulesResult.heightLocked === "number") {
      const preferred = handles.find((h) => h.value === "handle_pto" && h.enabled);
      if (preferred) newHandle = "handle_pto";
    }

    if (typeof rulesResult.heightLocked === "number" && rulesResult.heightLocked === 50 && newHandle !== "handle_pto") {
      const preferred = handles.find((h) => h.value === "handle_pto" && h.enabled);
      if (preferred) newHandle = "handle_pto";
    }

    // Height: if the handle changed, re-run rules with the NEW handle so the forced-height
    // mapping is evaluated against the correct handle (not the old one).
    const finalRulesResult =
      newHandle !== currentHandle
        ? applyConfiguratorRules(
            {
              cabinetType: inferredCabinetType,
              width: selectedDimensions.width ?? 0,
              depth: selectedDimensions.depth ?? 0,
              height: selectedDimensions.height ?? 0,
              drawers: drawerRawValue,
              handle: newHandle || undefined,
            },
            undefined,
            { selectedProductIds: [] },
            cabinetCatalog,
          )
        : rulesResult;

    const newHeight = finalRulesResult.nextSelection.height;
    const newHandleConfig = newHandle !== null ? buildHandleStyleConfigPatch(newHandle, handleGrooveColor) : null;

    await saveSnapshot();

    const configsBeforeDrawerChange =
      drawerRawValue === "1" && cabinetIdsToUpdate.length > 0
        ? await Promise.all(cabinetIdsToUpdate.map((productId) => getConfig(productId)))
        : [];
    const topDividerClearCabinetIds =
      drawerRawValue === "1"
        ? cabinetIdsToUpdate.filter((productId, index) => {
            const previousDrawerValue =
              placedCabinetStyles[productId] ?? readConfigDrawerValue(configsBeforeDrawerChange[index]);
            return previousDrawerValue === "2";
          })
        : [];
    const topDividerClearCabinetIdSet = new Set(topDividerClearCabinetIds);

    // 1. Apply Drawers to placed products (per-product IDs)
    if (cabinetIdsToUpdate.length > 0) {
      const cabinetIdsToKeepDividers = cabinetIdsToUpdate.filter(
        (productId) => !topDividerClearCabinetIdSet.has(productId),
      );

      if (cabinetIdsToKeepDividers.length > 0) {
        await setConfigBatch(cabinetIdsToKeepDividers, { Drawers: mappedValue });
      }

      if (topDividerClearCabinetIds.length > 0) {
        await setConfigBatch(topDividerClearCabinetIds, {
          Drawers: mappedValue,
          TopDrawerDividers: { zones: {} },
        });
      }
    }

    // Height and Handle must use the broadcast form setConfigBatch({}) — same pattern as the sidebar
    // and PlayCanvasIntegration. Per-product-ID calls do not propagate height/handle changes.
    // Always broadcast Handle (even if unchanged) so PlayCanvas re-evaluates its internal
    // height-forcing rules. Then always broadcast Height to ensure the correct value is applied.
    if (newHandleConfig) {
      await setConfigBatch({}, newHandleConfig);
    }
    if (typeof newHeight === "number") {
      const dimConfig: Record<string, number> = { Height: newHeight };
      if (typeof selectedDimensions.depth === "number") {
        dimConfig.Depth = selectedDimensions.depth;
      }
      await setConfigBatch({}, dimConfig);
    }

    // Fallback: in some compositions batch updates can keep stale height until sidebar interaction.
    // Force-sync each updated cabinet if its real config height is still not the rule-derived one.
    if (typeof newHeight === "number" && cabinetIdsToUpdate.length > 0) {
      const currentConfigs = await Promise.all(cabinetIdsToUpdate.map((productId) => getConfig(productId)));

      for (let i = 0; i < cabinetIdsToUpdate.length; i += 1) {
        const productId = cabinetIdsToUpdate[i];
        const rawConfig = currentConfigs[i];
        const config = rawConfig && typeof rawConfig === "object" ? (rawConfig as Record<string, unknown>) : {};

        if (typeof config.Height === "number" && config.Height === newHeight) continue;

        await setConfig(productId, {
          ...config,
          Drawers: mappedValue,
          ...(newHandleConfig ?? {}),
          Height: newHeight,
          ...(typeof selectedDimensions.depth === "number" ? { Depth: selectedDimensions.depth } : {}),
        });
      }
    }

    // 2. Atomically update Redux: selectedProductConfig.Drawers + all placedCabinetStyles in one action
    //    to ensure dominantDrawerGroup and cabinetStyleOptions recompute in the same render cycle.
    setActiveStyleId(id);
    cabinetIdsToUpdate.forEach((productId) => {
      dispatch(setPlacedCabinetStyle({ id: productId, value: drawerRawValue }));
    });
    if (topDividerClearCabinetIds.length > 0) {
      dispatch(clearTopPlacedDividersForCabinets(topDividerClearCabinetIds));
    }
    dispatch(
      switchAllCabinetsDrawerStyle({
        configValue: mappedValue,
        rawValue: drawerRawValue,
        // Pass the rule-derived values already sent to PlayCanvas so Redux stays in sync
        // even when applyRulesToState's supportsHeightForAllProducts check would block the change.
        forcedHeight: typeof newHeight === "number" ? newHeight : null,
        forcedHandle: newHandle !== currentHandle ? newHandle : null,
      }),
    );
  }, [
    pendingMixingStyle,
    dispatch,
    cabinetStyleOptions,
    placedCabinetStyles,
    activeCabinetType,
    selectedDimensions,
    selectedProductConfig,
    selectedProducts,
    cabinetCatalog,
    handleGrooveColor,
    saveSnapshot,
  ]);

  const handleMixingCancel = useCallback(() => {
    setPendingMixingStyle(null);
  }, []);

  const setActiveCabinet = useCallback(
    (id: string) => {
      if (hasProducts && !canAddCabinetByLength) {
        return;
      }

      if (hasProducts && remainingCountertopLength !== null) {
        const targetRule = cabinetCatalog.typeCabinetRules.find((rule) => rule.code === id);
        const canFitThisType = (targetRule?.widths ?? []).some(
          (width) => Number.isFinite(width) && width > 0 && width <= remainingCountertopLength + 0.01,
        );
        if (!canFitThisType) {
          return;
        }
      }

      if ((id === "Open-Shelf" || id === "Side-Shelf") && !hasBaseOrSideCabinetOnScene) {
        return;
      }

      autoAddSignatureRef.current = null;
      if (!hasProducts) {
        allowNextAutoAddRef.current = true;
        setActiveStyleId(null); // Reset stale style from previous session so auto-add waits for explicit style pick
      }
      dispatch(setActiveCabinetType(id));
      setAccordionValue(CABINET_STYLE_ID);

      const isOpen = cabinetCatalog.typeCabinetRules.find((rule) => rule.code === id)?.isOpen;
      if (isOpen) {
        dispatch(setOpenStyleSidebar(true));
      }
    },
    [
      cabinetCatalog.typeCabinetRules,
      canAddCabinetByLength,
      dispatch,
      hasBaseOrSideCabinetOnScene,
      hasProducts,
      remainingCountertopLength,
    ],
  );

  const selectTutorialDefaultCabinetType = useCallback(() => {
    const option = cabinetTypeOptions.find((item) => item.isAvailable ?? true);
    const playcanvasValue = option?.name ?? option?.title ?? option?.desc;

    if (!option || !playcanvasValue) return false;

    handleSelectCabinetConfig(String(playcanvasValue));
    setActiveCabinet(String(playcanvasValue));
    return true;
  }, [cabinetTypeOptions, handleSelectCabinetConfig, setActiveCabinet]);

  const selectTutorialDefaultCabinetStyle = useCallback(() => {
    const option = cabinetStyleOptions.find((item) => (item.isAvailable ?? true) && !item.isMixingRestricted);

    if (!option) return false;

    handleSelectDrawerStyle(option.id);
    handleOpenStyleSidebar();
    return true;
  }, [cabinetStyleOptions, handleOpenStyleSidebar, handleSelectDrawerStyle]);

  const handleSelectTutorialDefaultCabinetType = useCallback(() => {
    if (selectTutorialDefaultCabinetType()) return;
    setPendingTutorialDefaultCabinetType(true);
  }, [selectTutorialDefaultCabinetType]);

  const handleSelectTutorialDefaultCabinetStyle = useCallback(() => {
    if (selectTutorialDefaultCabinetStyle()) return;
    setPendingTutorialDefaultCabinetStyle(true);
  }, [selectTutorialDefaultCabinetStyle]);

  const handleEnsureTutorialSceneCabinet = useCallback(({ requestId }: { requestId: string }) => {
    setPendingTutorialSceneCabinetRequestId(requestId);
  }, []);

  const handleCancelPendingTutorialActions = useCallback(() => {
    setPendingTutorialDefaultCabinetType(false);
    setPendingTutorialDefaultCabinetStyle(false);
    setPendingTutorialSceneCabinetRequestId(null);
  }, []);

  useEffect(() => {
    if (!pendingTutorialDefaultCabinetType) return;
    if (selectTutorialDefaultCabinetType()) {
      setPendingTutorialDefaultCabinetType(false);
    }
  }, [pendingTutorialDefaultCabinetType, selectTutorialDefaultCabinetType]);

  useEffect(() => {
    if (!pendingTutorialDefaultCabinetStyle) return;
    if (selectTutorialDefaultCabinetStyle()) {
      setPendingTutorialDefaultCabinetStyle(false);
    }
  }, [pendingTutorialDefaultCabinetStyle, selectTutorialDefaultCabinetStyle]);

  useEffect(
    () =>
      subscribeToInteractiveConfiguratorTutorialActiveStepChange(({ stepId }) => {
        setIsInteractiveTutorialActive(stepId !== null);
      }),
    [],
  );

  useEffect(
    () =>
      subscribeToInteractiveConfiguratorTutorialEvent(
        INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.selectDefaultCabinetType,
        handleSelectTutorialDefaultCabinetType,
      ),
    [handleSelectTutorialDefaultCabinetType],
  );

  useEffect(
    () =>
      subscribeToInteractiveConfiguratorTutorialEvent(
        INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.selectDefaultCabinetStyle,
        handleSelectTutorialDefaultCabinetStyle,
      ),
    [handleSelectTutorialDefaultCabinetStyle],
  );

  useEffect(
    () =>
      subscribeToInteractiveConfiguratorTutorialSceneCabinetRequest(handleEnsureTutorialSceneCabinet),
    [handleEnsureTutorialSceneCabinet],
  );

  useEffect(
    () =>
      subscribeToInteractiveConfiguratorTutorialEvent(
        INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.cancelPendingActions,
        handleCancelPendingTutorialActions,
      ),
    [handleCancelPendingTutorialActions],
  );

  const resolveCabinetTypeId = useCallback(
    (productType?: string | null) => {
      if (!productType) return null;

      const normalized = productType.toLowerCase();
      const match = cabinetCatalog.typeCabinetRules.find((rule) => normalized.includes(rule.code.toLowerCase()));

      return match?.code ?? null;
    },
    [cabinetCatalog.typeCabinetRules],
  );

  useEffect(() => {
    if (!matrixCabinetTable) return;
    const catalog = buildCabinetCatalogFromMatrix(matrixCabinetTable);
    if (catalog.typeCabinetRules.length) {
      dispatch(setCabinetCatalog(catalog));
    }
  }, [dispatch, matrixCabinetTable]);

  useEffect(() => {
    if (isStyleSidebarOpen && !hasProducts && canvasReady) {
      showEmptyButton();
    } else {
      hideEmptyButton();
    }
  }, [isStyleSidebarOpen, hasProducts, canvasReady]);

  useEffect(() => {
    if (!pathname.includes("/custom/cabinet-builder")) return;
    if (presetFromUrl) return;
    if (productsPresets.length) return;
    if (hasBootstrappedCabinetBuilder) return;

    const preservedCabinetColor = cabinetColor?.trim() ? cabinetColor : CUSTOM_DEFAULT_CABINET_COLOR;
    const preservedCountertopColor = countertopColor?.trim() ? countertopColor : CUSTOM_DEFAULT_COUNTERTOP_COLOR;
    const preservedSinkType = sinkType?.trim() ? sinkType : CUSTOM_DEFAULT_SINK_TYPE;

    bootstrappedRef.current = false;
    dispatch(reset());
    dispatch(resetCabinetBuilderBootstrap());
    dispatch(setCabinetColor(preservedCabinetColor));
    dispatch(setActiveCountertopColor(preservedCountertopColor));
    dispatch(setActiveBasinStyle(preservedSinkType));

    if (canvasReady) {
      removeAllProducts();
    }
  }, [
    canvasReady,
    dispatch,
    hasBootstrappedCabinetBuilder,
    pathname,
    productsPresets.length,
    presetFromUrl,
    cabinetColor,
    countertopColor,
    sinkType,
  ]);

  useEffect(() => {
    if (!pathname.includes("/custom/cabinet-builder")) return;
    if (configId) return;
    if (!canvasReady) return;
    if (!presetFromUrl?.presetProducts.length || !customPresetBootstrapKey) return;
    if (customPresetInitializedRef.current === customPresetBootstrapKey) return;

    let cancelled = false;
    customPresetInitializedRef.current = customPresetBootstrapKey;

    const run = async () => {
      try {
        bootstrappedRef.current = false;
        dispatch(reset());
        dispatch(resetCabinetBuilderBootstrap());
        await removeAllProducts();

        if (cancelled) return;

        const presetProducts = presetFromUrl.presetProducts;
        const [firstPreset] = presetProducts;
        const presetCabinetColor = firstPreset?.CabinetColor ?? CUSTOM_DEFAULT_CABINET_COLOR;
        const presetCountertopColor = firstPreset?.CountertopColor ?? CUSTOM_DEFAULT_COUNTERTOP_COLOR;
        const presetSinkType = firstPreset?.sinkType ?? CUSTOM_DEFAULT_SINK_TYPE;
        const presetHandleGrooveColor = firstPreset?.HandleGrooveColor ?? presetCabinetColor;

        dispatch(addProductPreset(presetProducts));
        dispatch(setCabinetColor(presetCabinetColor));
        dispatch(setActiveCountertopColor(presetCountertopColor));
        dispatch(setActiveBasinStyle(presetSinkType));
        dispatch(setCountertopStyle(inferCountertopStyleFromSinkType(presetSinkType)));
        dispatch(setHandleGrooveColor(presetHandleGrooveColor));
      } catch (error) {
        customPresetInitializedRef.current = null;
        console.error("[Custom] Failed to initialize preset entry", error);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    canvasReady,
    configId,
    customPresetBootstrapKey,
    dispatch,
    pathname,
    presetFromUrl,
  ]);

  useEffect(() => {
    if (!canvasReady || !productsPresets.length || bootstrappedRef.current) return;
    if (hasBootstrappedCabinetBuilder) return;
    if (configId) return;

    bootstrappedRef.current = true;
    dispatch(setHasBootstrappedCabinetBuilder(true));

    const run = async () => {
      dispatch(resetProducts());
      const existingIds = getOrderedProductIds();
      const [firstPreset] = productsPresets;
      const preferredCabinetColor = firstPreset?.CabinetColor ?? cabinetColor ?? CUSTOM_DEFAULT_CABINET_COLOR;
      const preferredCountertopColor =
        countertopColor ?? firstPreset?.CountertopColor ?? CUSTOM_DEFAULT_COUNTERTOP_COLOR;
      const preferredSinkType = sinkType ?? firstPreset?.sinkType ?? CUSTOM_DEFAULT_SINK_TYPE;
      const preferredHandleGrooveColor = firstPreset?.HandleGrooveColor ?? handleGrooveColor ?? preferredCabinetColor;

      if (!existingIds.length) {
        const mergedPresets = productsPresets.map((preset) => ({
          ...preset,
          CabinetColor: preset.CabinetColor ?? preferredCabinetColor,
          sinkType: preset.sinkType ?? preferredSinkType,
          CountertopColor: preset.CountertopColor ?? preferredCountertopColor,
          HandleGrooveColor: preset.HandleGrooveColor ?? preferredHandleGrooveColor,
        }));

        await removeAllProducts();
        await addPreset(mergedPresets);

        dispatch(setCabinetColor(preferredCabinetColor));
        dispatch(setActiveCountertopColor(preferredCountertopColor));
        dispatch(setHandleGrooveColor(preferredHandleGrooveColor));
      } else {
        const batchConfig: Record<string, unknown> = {
          CabinetColor: preferredCabinetColor,
          CountertopColor: preferredCountertopColor,
          HandleGrooveColor: preferredHandleGrooveColor,
        };
        if (countertopStyle) batchConfig.CountertopStyle = countertopStyle;

        if (Object.keys(batchConfig).length) {
          await setConfigBatch({}, batchConfig);
        }

        dispatch(setCabinetColor(preferredCabinetColor));
        dispatch(setActiveCountertopColor(preferredCountertopColor));
        dispatch(setHandleGrooveColor(preferredHandleGrooveColor));
      }

      const orderedIds = existingIds.length ? existingIds : getOrderedProductIds();
      orderedIds.forEach((id) => dispatch(addProductId(id)));

      // Populate mixing restriction state from the bootstrapped presets
      orderedIds.forEach((productId, index) => {
        const preset = productsPresets[index];
        const drawerRawValue = mapConfigToDrawerValue(preset?.Drawers);
        if (drawerRawValue) {
          dispatch(setPlacedCabinetStyle({ id: productId, value: drawerRawValue }));
        }
      });

      if (firstPreset?.name) {
        dispatch(setDrawerProduct(firstPreset.name));
      }

      dispatch(setSelectedProductConfig(firstPreset ?? null));

      const nextDimensions: Partial<typeof selectedDimensions> = {};

      if (typeof firstPreset?.Width === "number") nextDimensions.width = firstPreset.Width;
      if (typeof firstPreset?.Height === "number") nextDimensions.height = firstPreset.Height;
      if (typeof firstPreset?.Depth === "number") nextDimensions.depth = firstPreset.Depth;

      if (Object.keys(nextDimensions).length) {
        dispatch(setSelectedDimensions(nextDimensions));
      }

      const cabinetTypeId = resolveCabinetTypeId(firstPreset?.name);
      if (cabinetTypeId !== null) {
        dispatch(setActiveCabinetType(cabinetTypeId));
      }
    };

    run();
  }, [
    canvasReady,
    dispatch,
    hasBootstrappedCabinetBuilder,
    productsPresets,
    resolveCabinetTypeId,
    selectedDimensions,
    cabinetColor,
    countertopColor,
    handleGrooveColor,
    sinkType,
    configId,
    countertopStyle,
  ]);

  useEffect(() => {
    if (!canvasReady) return;
    if (!hasBootstrappedCabinetBuilder) return;

    const pendingDeleteId = sessionStorage.getItem(PENDING_CUSTOM_DELETE_PRODUCT_ID_KEY);
    if (!pendingDeleteId) return;
    if (handledPendingDeleteIdRef.current === pendingDeleteId) return;

    const pendingProductId = selectedProducts.find((id) => isSameRuntimeProduct(id, pendingDeleteId));
    if (!pendingProductId) return;

    handledPendingDeleteIdRef.current = pendingDeleteId;

    const runDelete = async () => {
      const orderedIds = getOrderedProductIds();
      const deleteId =
        orderedIds.find((id) => isSameRuntimeProduct(id, pendingProductId)) ??
        orderedIds.find((id) => isSameRuntimeProduct(id, pendingDeleteId));

      if (!deleteId) {
        dispatch(removeProductId(pendingProductId));
        sessionStorage.removeItem(PENDING_CUSTOM_DELETE_PRODUCT_ID_KEY);
        return;
      }

      try {
        const deleteIndex = orderedIds.indexOf(deleteId);
        if (deleteIndex >= 0 && deleteIndex < productsPresets.length) {
          const nextPresets = productsPresets.filter((_, index) => index !== deleteIndex);
          dispatch(addProductPreset(nextPresets));
        }

        await removeProduct(deleteId);
        dispatch(removeProductId(deleteId));

        const nextIds = getOrderedProductIds();
        const nextSelectedId = nextIds[0];

        if (nextSelectedId) {
          const nextConfigRaw = await getConfig(nextSelectedId);
          const nextConfig =
            nextConfigRaw && typeof nextConfigRaw === "object"
              ? (nextConfigRaw as Record<string, unknown>)
              : ({} as Record<string, unknown>);

          dispatch(setSelectedSceneProduct(nextSelectedId));
          dispatch(setSelectedProductConfig(nextConfig));

          const nextDimensions: { width?: number; height?: number; depth?: number } = {};
          if (typeof nextConfig.Width === "number") nextDimensions.width = nextConfig.Width;
          if (typeof nextConfig.Height === "number") nextDimensions.height = nextConfig.Height;
          if (typeof nextConfig.Depth === "number") nextDimensions.depth = nextConfig.Depth;
          if (Object.keys(nextDimensions).length) {
            dispatch(setSelectedDimensions(nextDimensions));
          }

          const nextProductType =
            (typeof nextConfig.ProductType === "string" && nextConfig.ProductType) ||
            (typeof nextConfig.productType === "string" && nextConfig.productType) ||
            (typeof nextConfig.type === "string" && nextConfig.type) ||
            nextSelectedId;

          dispatch(setDrawerProduct(nextProductType));

          const nextTypeId = resolveCabinetTypeId(nextProductType);
          if (nextTypeId !== null) {
            dispatch(setActiveCabinetType(nextTypeId));
          }
        }
      } finally {
        sessionStorage.removeItem(PENDING_CUSTOM_DELETE_PRODUCT_ID_KEY);
      }
    };

    void runDelete();
  }, [canvasReady, dispatch, hasBootstrappedCabinetBuilder, productsPresets, selectedProducts, resolveCabinetTypeId]);

  const handleRestoreConfiguration = useCallback(
    async (id: string | number) => {
      dispatch(setHistoryRestoring(true));
      try {
        const result = await restoreConfiguration(id).unwrap();

        const path = result?.metadata?.path;
        const restorePath = typeof path === "string" && path.startsWith("/") ? path : null;

        applySwatchOrderFromMetadata(result?.metadata as Record<string, unknown> | undefined, dispatch);

        const configuration = result?.configuration || {};

        const orderedIdsFromMeta = result?.metadata?.orderedProductIds;
        const sourceIds = Array.isArray(orderedIdsFromMeta)
          ? orderedIdsFromMeta.filter((id) => typeof id === "string")
          : [];

        const isTopConfig = (id: string, value: unknown) => {
          if (!value || typeof value !== "object") return false;

          const record = value as Record<string, unknown>;
          const name =
            (typeof record.productType === "string" && record.productType) ||
            (typeof record.entityName === "string" && record.entityName) ||
            id;

          return name.startsWith("Top_");
        };

        const configIdsRaw = sourceIds.length ? sourceIds : Object.keys(configuration);
        const productConfigIds = configIdsRaw.filter((id) => !isTopConfig(id, configuration[id]));
        const topConfigIds = configIdsRaw.filter((id) => isTopConfig(id, configuration[id]));

        const uiState = result?.metadata?.uiState;
        const uiStateValues = uiState && typeof uiState === "object" ? (uiState as Record<string, unknown>) : null;

        const presetProducts = buildPresetFromConfiguration(configuration, productConfigIds);

        dispatch(resetProducts());
        await removeAllProducts();

        const createdIds = await addPreset(presetProducts);
        dispatch(addProductPreset(presetProducts));

        const createdProductIds = Array.isArray(createdIds)
          ? createdIds.filter((productId): productId is string => typeof productId === "string")
          : [];
        const orderedIds = getOrderedProductIds(createdProductIds);
        orderedIds.forEach((productId) => dispatch(addProductId(productId)));

        const configIds = productConfigIds;
        let sidePanelValue: string | undefined;
        let towelBarValue: string | undefined;
        let towelBarSideValue: string | undefined;
        let towelBarColorValue: string | undefined;

        for (let i = 0; i < orderedIds.length; i += 1) {
          const sourceId = configIds[i];
          const configValue = sourceId ? configuration[sourceId] : null;

          if (configValue && typeof configValue === "object") {
            const cfg = configValue as Record<string, unknown>;

            // Populate mixing restriction state from restored config
            if (typeof cfg.Drawers === "string") {
              const drawerRawValue = mapConfigToDrawerValue(cfg.Drawers);
              if (drawerRawValue) {
                dispatch(setPlacedCabinetStyle({ id: orderedIds[i], value: drawerRawValue }));
              }
            }

            if (!sidePanelValue && typeof cfg.SidePanel === "string") {
              sidePanelValue = cfg.SidePanel;
            }
            if (!sidePanelValue && typeof cfg.SidePanels === "string") {
              sidePanelValue = cfg.SidePanels;
            }
            if (!towelBarValue && typeof cfg.TowelBarOption === "string") {
              towelBarValue = cfg.TowelBarOption;
            }
            if (!towelBarValue && typeof cfg.TowelBar === "string") {
              towelBarValue = cfg.TowelBar;
            }
            if (!towelBarSideValue && typeof cfg.TowelBarSide === "string") {
              towelBarSideValue = cfg.TowelBarSide;
            }
            if (!towelBarColorValue && typeof cfg.TowelBarColor === "string") {
              towelBarColorValue = cfg.TowelBarColor;
            }

            await setConfig(orderedIds[i], configValue);
            dispatch(
              replacePlacedDividersForCabinet({
                cabinetId: orderedIds[i],
                dividers: collectPlacedDividersFromConfig(orderedIds[i], configValue),
              }),
            );
          }
        }

        for (const topId of topConfigIds) {
          const configValue = configuration[topId];

          if (!configValue || typeof configValue !== "object") continue;

          const record = configValue as Record<string, unknown>;
          const name =
            (typeof record.productType === "string" && record.productType) ||
            (typeof record.entityName === "string" && record.entityName) ||
            topId;

          if (name.startsWith("Top_")) {
            await setConfigBatch({ productType: name }, configValue);
          }
        }

        let topConfigThickness: string | undefined;
        for (const topId of topConfigIds) {
          const cfg = configuration[topId];
          if (cfg && typeof cfg === "object") {
            const record = cfg as Record<string, unknown>;
            if (typeof record.Thickness === "number" && isFinite(record.Thickness)) {
              topConfigThickness = String(record.Thickness);
              break;
            }
            if (typeof record.Thickness === "string" && record.Thickness) {
              topConfigThickness = record.Thickness;
              break;
            }
          }
        }

        const uiCabinetColor =
          typeof uiStateValues?.CabinetColor === "string" ? (uiStateValues.CabinetColor as string) : undefined;
        const uiHandleGrooveColor =
          typeof uiStateValues?.HandleGrooveColor === "string"
            ? (uiStateValues.HandleGrooveColor as string)
            : undefined;
        const uiSinkType = typeof uiStateValues?.sinkType === "string" ? (uiStateValues.sinkType as string) : undefined;
        const uiCountertopColor =
          typeof uiStateValues?.CountertopColor === "string" ? (uiStateValues.CountertopColor as string) : undefined;
        const uiCountertopColorSku =
          typeof uiStateValues?.CountertopColorSku === "string"
            ? (uiStateValues.CountertopColorSku as string)
            : undefined;
        const uiVesselColor =
          typeof uiStateValues?.VesselColor === "string" ? (uiStateValues.VesselColor as string) : undefined;
        const uiCountertopThickness =
          (typeof uiStateValues?.Thickness === "string" ? (uiStateValues.Thickness as string) : undefined) ??
          topConfigThickness;
        const uiDrawerPanelFluting =
          typeof uiStateValues?.DrawerPanelFluting === "string"
            ? (uiStateValues.DrawerPanelFluting as string)
            : undefined;
        const uiGrainDirection =
          typeof uiStateValues?.GrainDirection === "string" ? (uiStateValues.GrainDirection as string) : undefined;
        const uiBookMatching =
          typeof uiStateValues?.BookMatching === "string" ? (uiStateValues.BookMatching as string) : undefined;
        const uiCountertopStyle =
          typeof uiStateValues?.CountertopStyle === "string" ? (uiStateValues.CountertopStyle as string) : undefined;
        const uiSidePanels =
          typeof uiStateValues?.SidePanels === "string" ? (uiStateValues.SidePanels as string) : undefined;
        const uiSidePanelLeft =
          typeof uiStateValues?.SidePanelLeft === "string" ? (uiStateValues.SidePanelLeft as string) : undefined;
        const uiSidePanelRight =
          typeof uiStateValues?.SidePanelRight === "string" ? (uiStateValues.SidePanelRight as string) : undefined;
        const uiLedOption =
          typeof uiStateValues?.LedOption === "string" ? (uiStateValues.LedOption as string) : undefined;
        const uiDividersOption =
          typeof uiStateValues?.DividersOption === "string" ? (uiStateValues.DividersOption as string) : undefined;
        const uiDividersStyle =
          typeof uiStateValues?.DividersStyle === "string" ? (uiStateValues.DividersStyle as string) : undefined;
        const uiTowelBarOption =
          typeof uiStateValues?.TowelBarOption === "string" ? (uiStateValues.TowelBarOption as string) : undefined;
        const uiTowelBarColor =
          typeof uiStateValues?.TowelBarColor === "string" ? (uiStateValues.TowelBarColor as string) : undefined;
        const uiTowelBarSide =
          typeof uiStateValues?.["TowelBarSide"] === "string" ? (uiStateValues["TowelBarSide"] as string) : undefined;
        const uiFaucetHolesAmount =
          typeof uiStateValues?.FaucetHolesAmount === "string"
            ? (uiStateValues.FaucetHolesAmount as string)
            : undefined;
        const uiFaucetHolesSpacing =
          typeof uiStateValues?.FaucetHolesSpacing === "string"
            ? (uiStateValues.FaucetHolesSpacing as string)
            : undefined;

        const batchConfig: Record<string, unknown> = {};
        if (uiCabinetColor) batchConfig.CabinetColor = uiCabinetColor;
        if (uiHandleGrooveColor) batchConfig.HandleGrooveColor = uiHandleGrooveColor;
        if (uiCountertopColor) batchConfig.CountertopColor = uiCountertopColor;
        if (uiCountertopStyle) batchConfig.CountertopStyle = uiCountertopStyle;

        if (Object.keys(batchConfig).length) {
          await setConfigBatch(orderedIds, batchConfig);
        }

        if (uiCountertopThickness) {
          await setConfigBatch({}, { Thickness: uiCountertopThickness });
        }

        if (uiVesselColor !== undefined) {
          await setConfigBatch({ productType: "Sink-Base" }, { VesselColor: uiVesselColor });
        }

        const towelBarOption = uiTowelBarOption || towelBarValue;
        const towelBarSide = uiTowelBarSide || towelBarSideValue;
        if (typeof towelBarOption === "string") {
          const isNone = towelBarOption === "None";
          const side = typeof towelBarSide === "string" && towelBarSide ? towelBarSide : towelBarOption.toLowerCase();
          await setConfigBatch(
            {},
            {
              TowelBar: isNone ? "None" : "TowelBar40_R",
              TowelBarSide: isNone ? "both" : side,
            },
          );

          dispatch(setTowelBarOption(towelBarOption));
          if (isNone) {
            dispatch(setTowelBarColor(""));
          }
        }

        const towelColor = uiTowelBarColor || towelBarColorValue;
        if (towelColor) {
          await setConfigBatch({}, { TowelBarColor: towelColor });
          dispatch(setTowelBarColor(towelColor));
        }

        if (uiCabinetColor) dispatch(setCabinetColor(uiCabinetColor));
        if (uiHandleGrooveColor) dispatch(setHandleGrooveColor(uiHandleGrooveColor));
        if (uiSinkType) dispatch(setActiveBasinStyle(uiSinkType));
        if (uiCountertopColor) dispatch(setActiveCountertopColor(uiCountertopColor));
        if (uiCountertopColorSku) dispatch(setCountertopColorSku(uiCountertopColorSku));
        if (uiVesselColor !== undefined) dispatch(setVesselColor(uiVesselColor));
        if (uiCountertopThickness) dispatch(setActiveCountertopThickness(uiCountertopThickness));
        if (uiDrawerPanelFluting) dispatch(setDrawerPanelFluting(uiDrawerPanelFluting));
        if (uiGrainDirection) dispatch(setGrainDirection(uiGrainDirection));
        if (uiBookMatching !== undefined) dispatch(setBookMatching(uiBookMatching));
        if (uiCountertopStyle) dispatch(setCountertopStyle(uiCountertopStyle));
        if (uiLedOption) dispatch(setLedOption(uiLedOption));
        if (uiDividersOption) dispatch(setDividersOption(uiDividersOption));
        if (uiDividersStyle) dispatch(setDividersStyle(uiDividersStyle));
        if (uiFaucetHolesAmount) dispatch(setFaucetHolesAmount(uiFaucetHolesAmount));
        if (uiFaucetHolesSpacing !== undefined) dispatch(setFaucetHolesSpacing(uiFaucetHolesSpacing));

        const [firstPreset] = presetProducts;
        if (firstPreset?.name) {
          dispatch(setDrawerProduct(firstPreset.name));
        }

        dispatch(setSelectedProductConfig(firstPreset ?? null));

        const nextDimensions: Partial<typeof selectedDimensions> = {};
        if (typeof firstPreset?.Width === "number") nextDimensions.width = firstPreset.Width;
        if (typeof firstPreset?.Height === "number") nextDimensions.height = firstPreset.Height;
        if (typeof firstPreset?.Depth === "number") nextDimensions.depth = firstPreset.Depth;

        if (Object.keys(nextDimensions).length) {
          dispatch(setSelectedDimensions(nextDimensions));
        }

        const cabinetTypeId = resolveCabinetTypeId(firstPreset?.name);
        if (cabinetTypeId !== null) {
          dispatch(setActiveCabinetType(cabinetTypeId));
        }

        const sidePanel = uiSidePanels || sidePanelValue;
        if (sidePanel && isGrooveType(sidePanel)) {
          const leftStatus = resolveSidePanelStatus(uiSidePanelLeft, "active");
          const rightStatus = resolveSidePanelStatus(uiSidePanelRight, "active");
          await restoreSidePanelState(sidePanel, leftStatus, rightStatus, orderedIds.length);
          dispatch(setSidePanelsOption(sidePanel));
          dispatch(setSidePanelSideStatus({ side: "left", status: leftStatus }));
          dispatch(setSidePanelSideStatus({ side: "right", status: rightStatus }));
          await enforceSidePanelEligibility(dispatch, sidePanel, leftStatus, rightStatus, orderedIds.length);
        }

        const snapshot = await captureSnapshot(() => store.getState() as RootState);
        dispatch(setHistoryRestoring(false));
        dispatch(pushSnapshot(snapshot));

        if (restorePath) {
          navigate(restorePath);
        }
      } catch (error) {
        dispatch(setHistoryRestoring(false));
        console.error("[Configurations] Restore failed", error);
      }
    },
    [dispatch, navigate, resolveCabinetTypeId, restoreConfiguration],
  );

  useEffect(() => {
    if (!canvasReady || !configId || bootstrappedRef.current) return;

    bootstrappedRef.current = true;
    dispatch(setHasBootstrappedCabinetBuilder(true));

    handleRestoreConfiguration(configId);
  }, [canvasReady, configId, dispatch, handleRestoreConfiguration]);

  const addSelectedCabinetToScene = useCallback(
    async ({
      keepStyleSidebarOpen = false,
      resetAccordionAfterAdd = true,
    }: AddSelectedCabinetToSceneOptions = {}) => {
      if (!pathname.includes("/custom/cabinet-builder")) return false;
      if (!canvasReady || hasProducts || !activeCabinetType) return false;

      const selectedCabinetRule = cabinetCatalog.typeCabinetRules.find((rule) => rule.code === activeCabinetType);
      if (!selectedCabinetRule) return false;
      if (!selectedCabinetRule.isOpen && !activeStyleId) return false;

      if (
        selectedDimensions.height === null ||
        selectedDimensions.depth === null ||
        selectedDimensions.width === null
      ) {
        return false;
      }

      const signature = `${activeCabinetType ?? ""}|${activeStyleId ?? ""}`;
      if (autoAddSignatureRef.current === signature) return false;
      autoAddSignatureRef.current = signature;

      const productName = selectedCabinetRule.code;
      const currentSelectedConfig = selectedProductConfig ?? {};
      const currentDrawers =
        typeof currentSelectedConfig.Drawers === "string" ? currentSelectedConfig.Drawers : undefined;
      const currentHandle =
        typeof currentSelectedConfig.Handle === "string" ? currentSelectedConfig.Handle : undefined;

      try {
        const newProductRules = applyConfiguratorRules(
          {
            cabinetType: productName,
            width: selectedDimensions.width,
            depth: selectedDimensions.depth,
            height: selectedDimensions.height,
            drawers: mapConfigToDrawerValue(currentDrawers),
            handle: currentHandle,
          },
          undefined,
          { selectedProductIds: [] },
          cabinetCatalog,
        );

        const resolvedHeight = newProductRules.nextSelection.height ?? selectedDimensions.height;
        const resolvedHandle = (() => {
          const handles = newProductRules.availableOptions.handles;
          if (currentHandle && handles.length > 0) {
            const option = handles.find((handle) => handle.value === currentHandle);
            if (option && !option.enabled) {
              return handles.find((handle) => handle.enabled)?.value?.toString() ?? "handle_urban_topcut";
            }
          }
          return currentHandle ?? "handle_urban_topcut";
        })();

        const productConfig: addProductConfigI = {
          Height: resolvedHeight,
          Depth: selectedDimensions.depth,
          Width: selectedDimensions.width,
          CabinetColor: cabinetColor,
          CountertopColor: countertopColor,
          HandleGrooveColor: handleGrooveColor,
          Handle: resolvedHandle,
          Drawers: currentDrawers,
          Thickness: countertopThickness || undefined,
          CountertopStyle: countertopStyle || undefined,
        };

        if (selectedCabinetRule.hasSink && sinkType) {
          productConfig.sinkType = sinkType;
          if (vesselColor) {
            productConfig.VesselColor = vesselColor;
          }
        }

        await saveSnapshot();
        if (productName === "Side-Shelf") {
          await autoRemoveSide(dispatch, "right", selectedProducts.length);
        }

        const productId = await addProduct(productName, productConfig);

        if (!productId) {
          autoAddSignatureRef.current = null;
          return false;
        }

        dispatch(addProductId(productId));
        handleSelectCabinetConfig(productName, productConfig);

        const drawerRawValue = mapConfigToDrawerValue(currentDrawers);
        if (drawerRawValue) {
          dispatch(setPlacedCabinetStyle({ id: productId, value: drawerRawValue }));
        }

        allowNextAutoAddRef.current = false;
        dispatch(setHasBootstrappedCabinetBuilder(true));

        if (resetAccordionAfterAdd) {
          handleResetToDefaultState();
        }

        if (!keepStyleSidebarOpen) {
          dispatch(setOpenStyleSidebar(false));
        }

        return true;
      } catch (error) {
        autoAddSignatureRef.current = null;
        allowNextAutoAddRef.current = false;
        console.error("Failed to add product to scene:", error);
        return false;
      }
    },
    [
      activeCabinetType,
      activeStyleId,
      cabinetCatalog,
      cabinetColor,
      canvasReady,
      countertopColor,
      countertopStyle,
      countertopThickness,
      dispatch,
      handleGrooveColor,
      handleResetToDefaultState,
      handleSelectCabinetConfig,
      hasProducts,
      pathname,
      saveSnapshot,
      selectedDimensions.depth,
      selectedDimensions.height,
      selectedDimensions.width,
      selectedProductConfig,
      selectedProducts.length,
      sinkType,
      vesselColor,
    ],
  );

  useEffect(() => {
    if (!pendingTutorialSceneCabinetRequestId) return;

    const requestId = pendingTutorialSceneCabinetRequestId;
    let isCancelled = false;

    const completeRequest = () => {
      if (isCancelled) return;

      dispatchInteractiveConfiguratorTutorialSceneCabinetReady(requestId);
      setPendingTutorialSceneCabinetRequestId((currentRequestId) =>
        currentRequestId === requestId ? null : currentRequestId,
      );
    };

    const hasRuntimeSceneCabinet = () => getOrderedProductIds().length > 0;

    async function run() {
      if (isCancelled) return;

      if (hasRuntimeSceneCabinet()) {
        completeRequest();
        return;
      }

      if (isAddingTutorialSceneCabinetRef.current) {
        return;
      }

      isAddingTutorialSceneCabinetRef.current = true;

      try {
        const isAdded = await addSelectedCabinetToScene({
          keepStyleSidebarOpen: true,
          resetAccordionAfterAdd: false,
        });

        if (isAdded || hasRuntimeSceneCabinet()) {
          completeRequest();
          return;
        }
      } finally {
        isAddingTutorialSceneCabinetRef.current = false;
      }
    }

    void run();

    return () => {
      isCancelled = true;
    };
  }, [addSelectedCabinetToScene, pendingTutorialSceneCabinetRequestId]);

  // Auto-add product when cabinet type and style are selected and scene is empty
  useEffect(() => {
    if (!ENABLE_AUTO_ADD_FIRST_PRODUCT) return;
    if ((hasBootstrappedCabinetBuilder && !allowNextAutoAddRef.current) || !canvasReady || hasProducts) return;

    void addSelectedCabinetToScene();
  }, [
    addSelectedCabinetToScene,
    canvasReady,
    hasProducts,
    hasBootstrappedCabinetBuilder,
  ]);

  useEffect(() => {
    const target = searchParams.get("accordion");

    if (target) setAccordionValue(target);
  }, [searchParams, locationKey]);

  const accordions: AccordionConfig[] = [
    {
      id: CABINET_TYPE_ID,
      title: "Cabinet Type",
      defaultOpen: true,
      tutorialTarget: INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS.customCabinetType,
      content: (
        <ProductOptionsGrid
          handleAdd={handleSelectCabinetConfig}
          data={cabinetTypeOptions}
          setActiveCabinet={setActiveCabinet}
          isLoading={isMatrixLoading}
          variant="cabinetType"
        />
      ),
    },
    {
      id: CABINET_STYLE_ID,
      title: "Cabinet Style",
      tutorialTarget: INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS.customCabinetStyle,
      content: (() => {
        const isOpenShelfCabinet = Boolean(activeCabinetRule?.isOpen);

        if (isOpenShelfCabinet) {
          return <div className={s.message}>Drawers are not available for this cabinet type.</div>;
        }

        return (
          <ProductStyleGrid
            handleOpenStyleSidebar={handleOpenStyleSidebar}
            data={cabinetStyleOptions}
            requiresActiveCabinet
            isActive={isStyleDrawerActive}
            activeStyleId={activeStyleId}
            onSelectStyle={handleSelectDrawerStyle}
            onMixingRestrictedSelect={handleMixingRestrictedSelect}
          />
        );
      })(),
    },
  ];
  const shouldShowBuildInfoPopup =
    isOpenedBuildInfo && !isInteractiveTutorialActive && !isInteractiveTutorialRoute;

  return (
    <>
      <div className={s.cabinetBuilder}>
        {shouldShowBuildInfoPopup && <InstructionPopup handleClose={handleClose} />}

        {
          <ConfiguratorAccordionGroup
            defaultValue={defaultValue}
            value={accordionValue}
            onValueChange={setAccordionValue}
          >
            {accordions.map(({ id, title, content, tutorialTarget }) => (
              <ConfiguratorAccordionItem key={id} value={id} title={title} dataTarget={tutorialTarget}>
                {content}
              </ConfiguratorAccordionItem>
            ))}
          </ConfiguratorAccordionGroup>
        }

        <RightCabinetStyleSidebar onProductAdded={handleResetToDefaultState} />
      </div>

      <DrawerStyleConflictPopup
        isOpening={pendingMixingStyle !== null}
        newStyleTitle={pendingMixingStyle?.title ?? ""}
        onConfirm={handleMixingConfirm}
        onCancel={handleMixingCancel}
      />
      <PopupCenterContent isOpening={isPtoSwitchPromptOpen} onClose={() => setIsPtoSwitchPromptOpen(false)}>
        <div className={s.confirmPopup}>
          <div className={s.confirmHeader}>
            <div className={s.confirmTitle}>Switch Handle Style?</div>
            <div className={s.confirmClose} onClick={() => setIsPtoSwitchPromptOpen(false)}>
              <CloseBtnIcon />
            </div>
          </div>
          <div className={s.confirmContent}>
            <p>This cabinet type is only compatible with a PTO handle.</p>
            <p>Switch to PTO handle here?</p>
          </div>
          <div className={s.confirmFooter}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <BaseButton variant="ghost" onClick={() => setIsPtoSwitchPromptOpen(false)} fullWidth={true}>
                Cancel
              </BaseButton>
              <BaseButton onClick={() => void handleApprovePtoSwitch()} fullWidth={true}>
                Approve
              </BaseButton>
            </div>
          </div>
        </div>
      </PopupCenterContent>
    </>
  );
};
