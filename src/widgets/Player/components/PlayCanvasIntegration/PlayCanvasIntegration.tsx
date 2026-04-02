import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { NestedDropdown, type DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";
import { MobileNestedMenu } from "@/shared/ui/NestedDropdown/MobileNestedMenu";
import { removeProduct } from "@/utils/functions/playcanvas/removeProduct";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  addProductId,
  addProductPreset,
  removeProductId,
  resetCabinetBuilderBootstrap,
  resetProducts,
  setActiveCabinetType,
  setActiveCountertopThickness,
  setPlacedCabinetStyle,
  setSelectedDimensions,
  setSelectedProductConfig,
  setSelectedSceneProduct,
  swapProductIds,
  setTowelBarOption,
  setTowelBarColor,
} from "@/entities/product/model/store/slice";
import { swapProducts } from "@/utils/functions/playcanvas/swapProducts.ts";
import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight.tsx";
import { getSelectTool } from "@/utils/functions/playcanvas/getSelectTool";
import { getDimensionTool } from "@/utils/functions/playcanvas/getDimensionTool";
import { setConfig } from "@/utils/functions/playcanvas/setConfig";
import { setHandleButtonClick } from "@/utils/functions/playcanvas/setHandleButtonClick";
import { setProductByParams } from "@/utils/functions/playcanvas/setProductByParams";
import { setVisibleButtons } from "@/utils/functions/playcanvas/setVisibleButtons";
import {
  getDimensionOptions,
  getCabinetCatalog,
  getActiveCountertopColor,
  getCountertopColorSku,
  getCountertopStyle,
  getActiveCountertopThickness,
  getProductsPresets,
  getSinkType,
  getSelectedDimensions,
  getIsDrawerOpen,
  getSelectedSceneProduct,
  getSelectedProductConfig,
  getActiveCabinetRule,
  getSinkBaseCount,
  getTowelBarOption,
} from "@/entities/product/model/store/selectors";
import { getIsActiveStyleSidebar } from "@/features/sidebar/model/store/selectors";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { updateDimensionDataForProduct } from "@/utils/functions/playcanvas/updateDimensionData";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { getEdgeCabinets } from "@/utils/functions/playcanvas/getEdgeCabinets";
import { getRememberedSidePanels, setSidePanel } from "@/utils/functions/playcanvas/sidePanels";
import { setVisibleDrawerButtons } from "@/utils/functions/playcanvas/setVisibleDrawerButtons";
import { onDrawerCloseWidgetRender, onDrawerWidgetRender } from "@/utils/functions/playcanvas/drawerWidgetRenderers";
import { OpenMenuIcon } from "@/shared/assets/images/svg/OpenMenuIcon";
import { DeleteMenuIcon } from "@/shared/assets/images/svg/DeleteMenuIcon";
import { DuplicateIcon } from "@/shared/assets/images/svg/DuplicateIcon";
import { getDropdownPosition } from "@/utils/functions/getDropdownPosition";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import { useGetConfiguratorQuery } from "@/entities";
import { useGetCountertopDatatableQuery } from "@/entities/countertop";
import {
  buildCountertopRuleState,
  filterDepthValuesByCountertopRules,
  filterWidthValuesByCountertopRules,
  parseCountertopMatrix,
  resolveCountertopMaxLengthByRules,
  resolveDefaultThicknessFromRules,
} from "@/features/configurator-rule-core/countertop";
import { useSceneTotalWidth } from "@/shared/hooks/useSceneTotalWidth";
import { ROUTES } from "@/shared";
import { CustomizeModePrompt } from "@/shared/ui/Popups/ui/CustomizeModePrompt/CustomizeModePrompt";
import { captureScreenshot } from "@/utils/functions/playcanvas/captureScreenshot";
import { formatCmWithInches } from "@/utils/units";

// 🔧 UPDATE THIS VERSION WHEN DEPLOYING NEW PLAYCANVAS BUILD
const PLAYCANVAS_VERSION = "034";
const PLAYCANVAS_SRC = `/HastingCabinetsParametrization/index.html?v=${PLAYCANVAS_VERSION}`;

const GLOBAL_CAMERA_PADDING_WIDE = 2.0;
const GLOBAL_CAMERA_PADDING_TALL = 2.6;
const SIDE_SHELF_WIDTH_CM = 15;

const stripRuntimeEntitySuffix = (value: string): string => {
  const trimmed = value.trim();
  const lastDash = trimmed.lastIndexOf("-");
  if (lastDash <= 0) return trimmed;

  const suffix = trimmed.slice(lastDash + 1);
  if (/^[a-z0-9]{6,}$/i.test(suffix)) {
    return trimmed.slice(0, lastDash);
  }

  return trimmed;
};

const humanizeDisplayName = (value: string): string => {
  const base = stripRuntimeEntitySuffix(value).replace(/[_-]+/g, " ").trim();
  if (!base) return value;
  return base
    .split(/\s+/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
};

const toDimensionDisplayName = (productType: string, fallback?: string): string => {
  const normalizedType = stripRuntimeEntitySuffix(productType).toLowerCase();
  if (normalizedType === "top_solid" || normalizedType === "top-solid") return "Top Solid";
  if (normalizedType === "sink-base") return "Sink Base";
  if (normalizedType === "sink-cabinet") return "Sink Cabinet";
  return humanizeDisplayName(productType || fallback || "");
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const thicknessToCm = (thickness: number): number => Number((thickness * 2.54).toFixed(3));
const formatThicknessLabel = (thickness: number): string => {
  const normalizedInches = Number(thickness.toFixed(3));
  const cm = thicknessToCm(normalizedInches);
  return `${normalizedInches}" (${cm} cm)`;
};

const mapCabinetTypeToGroup = (cabinetType?: string | null) => {
  if (!cabinetType) return null;

  const val = cabinetType.toLowerCase();

  if (val.includes("side-shelf") || val === "oss") return "OSS";
  if (val.includes("open-shelf") || val === "os") return "OS";
  if (
    val.includes("sink-base") ||
    val.includes("sink-cabinet") ||
    val.includes("side-cabinet") ||
    val === "sb" ||
    val === "sc" ||
    val === "sbsc"
  ) {
    return "SBSC";
  }

  return null;
};

const PENDING_CUSTOM_DELETE_PRODUCT_ID_KEY = "pendingCustomDeleteProductId";

export const PlayCanvasIntegration = () => {
  type CustomizeModePromptAction = "default" | "add" | "delete";

  const containerRef = useRef<HTMLIFrameElement | null>(null);
  const pendingHandleSyncRef = useRef(false);
  const prevHandleRef = useRef<string | undefined>(undefined);
  const isMobileMediaQueryRef = useRef<MediaQueryList | null>(null);
  const [dropdownState, setDropdownState] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0,
  });

  const [countertopPopoverState, setCountertopPopoverState] = useState<{
    visible: boolean;
    x: number;
    y: number;
    entityName: string | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    entityName: null,
  });

  const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);
  const [isCustomizeModePromptOpen, setIsCustomizeModePromptOpen] = useState(false);
  const [customizeModePromptAction, setCustomizeModePromptAction] = useState<CustomizeModePromptAction>("default");
  const [customizeModePromptDeleteTarget, setCustomizeModePromptDeleteTarget] = useState<string | null>(null);
  const [isMobileMenu, setIsMobileMenu] = useState(false);
  const [mobilePreviewImage, setMobilePreviewImage] = useState<string | null>(null);
  const openDrawerButtonsTargetRef = useRef<string | null>(null);
  const suppressNextDropdownOpenRef = useRef(false);
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const countertopPopoverRef = useRef<HTMLDivElement | null>(null);

  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const isPrebuilt = location.pathname.startsWith("/prebuilt");
  const isPrebuiltRef = useRef(isPrebuilt);

  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const selectedSceneProduct = useAppSelector(getSelectedSceneProduct);
  const sinkBaseCount = useAppSelector(getSinkBaseCount);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const productIds = useAppSelector((store) => store.rootStateUI.product.productIds);
  const dimensionOptions = useAppSelector(getDimensionOptions);
  const cabinetCatalog = useAppSelector(getCabinetCatalog);
  const isDrawerOpen = useAppSelector(getIsDrawerOpen);
  const activeCountertopColor = useAppSelector(getActiveCountertopColor);
  const countertopColorSku = useAppSelector(getCountertopColorSku);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const activeCountertopThickness = useAppSelector(getActiveCountertopThickness);
  const activeBasinStyle = useAppSelector(getSinkType);
  const productsPresets = useAppSelector(getProductsPresets);
  const activeCabinetRule = useAppSelector(getActiveCabinetRule);
  const towelBarOption = useAppSelector(getTowelBarOption);
  const isStyleSidebarOpen = useAppSelector(getIsActiveStyleSidebar);
  const sceneTotalWidth = useSceneTotalWidth(productIds, selectedDimensions.width ?? null);

  const saveSnapshot = useHistorySnapshot();

  const { data: counterTopData } = useGetCountertopDatatableQuery(438);
  const { data: counterTopMaterials } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });

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

  const isDrawerCabinet = useMemo(() => {
    const raw =
      (typeof selectedProductConfig?.ProductType === "string" && selectedProductConfig.ProductType) ||
      (typeof selectedProductConfig?.productType === "string" && selectedProductConfig.productType) ||
      (typeof selectedProductConfig?.type === "string" && selectedProductConfig.type) ||
      selectedSceneProduct ||
      "";

    // Strip trailing random suffix (e.g. "Open-Shelf-abc123" → "Open-Shelf")
    const lastDash = raw.lastIndexOf("-");
    const baseType =
      lastDash > 0 && raw.slice(lastDash + 1).length >= 6 ? raw.slice(0, lastDash).toLowerCase() : raw.toLowerCase();

    const openShelfTypes = ["open-shelf", "side-shelf", "os", "oss"];

    return !openShelfTypes.includes(baseType);
  }, [selectedProductConfig, selectedSceneProduct]);

  const isOneOrTwoDrawerProduct = useMemo(() => {
    const drawersRaw =
      (typeof selectedProductConfig?.Drawers === "string" && selectedProductConfig.Drawers) ||
      (typeof selectedProductConfig?.drawers === "string" && selectedProductConfig.drawers) ||
      "";
    const normalizedDrawers = drawersRaw.trim().toUpperCase();

    if (normalizedDrawers === "1D" || normalizedDrawers === "2D") {
      return true;
    }

    const candidates = [
      selectedSceneProduct,
      typeof selectedProductConfig?.ProductType === "string" ? (selectedProductConfig.ProductType as string) : null,
      typeof selectedProductConfig?.productType === "string" ? (selectedProductConfig.productType as string) : null,
      typeof selectedProductConfig?.type === "string" ? (selectedProductConfig.type as string) : null,
      typeof selectedProductConfig?.entityName === "string" ? (selectedProductConfig.entityName as string) : null,
    ]
      .filter(Boolean)
      .map((value) =>
        String(value)
          .toLowerCase()
          .replace(/[_\s-]/g, ""),
      );

    return candidates.some((value) => value.includes("1drawer") || value.includes("2drawer"));
  }, [selectedProductConfig, selectedSceneProduct]);

  const handleOptions = useMemo(() => {
    const isOpenCabinet = Boolean(activeCabinetRule?.isOpen);
    const openReason = "Not available for open cabinets";

    if (dimensionOptions.handles?.length) {
      return dimensionOptions.handles.map((h) => ({
        label: String(h.name ?? h.value),
        value: String(h.value),
        disabled: isOpenCabinet ? true : h.disabled,
        reason: isOpenCabinet ? openReason : h.reason,
      }));
    }

    return [
      {
        label: "Push to open",
        value: "handle_pto",
        disabled: isOpenCabinet || undefined,
        reason: isOpenCabinet ? openReason : undefined,
      },
      {
        label: "Upper Groove",
        value: "handle_urban_topcut",
        disabled: isOpenCabinet || undefined,
        reason: isOpenCabinet ? openReason : undefined,
      },
      {
        label: "Central Groove",
        value: "handle_urban_botcut",
        disabled: isOpenCabinet || undefined,
        reason: isOpenCabinet ? openReason : undefined,
      },
    ];
  }, [activeCabinetRule?.isOpen, dimensionOptions.handles]);

  const getCompositionProducts = useCallback((): Record<string, any> | null => {
    // @ts-ignore
    const rootContainerRef = window.containerRef;
    const canvasIframe = rootContainerRef?.current?.contentWindow as any;
    const compositionManager = canvasIframe?.ConfiguratorAPI?.config?.compositionManager;
    const composition = compositionManager?.getActiveComposition?.();
    const allProducts = composition?.getAllProducts?.();

    if (!allProducts || typeof allProducts !== "object") return null;
    return allProducts as Record<string, any>;
  }, []);

  const getCountertopSyncData = useCallback(() => {
    const allProducts = getCompositionProducts();
    if (!allProducts) return null;

    let hasCabinets = false;
    let summedWidth = 0;
    let sidePanelsCount = 0;
    let primaryCabinetHeight: number | null = null;
    let fallbackCabinetHeight: number | null = null;
    let countertopId: string | null = null;
    let currentCountertopWidth: number | null = null;
    let currentCountertopHeight: number | null = null;

    Object.entries(allProducts).forEach(([id, product]) => {
      if (!product || typeof product !== "object") return;

      const category = typeof product.category === "string" ? product.category.toLowerCase() : "";
      const productType = typeof product.productType === "string" ? product.productType : "";
      const normalizedType = productType.toLowerCase();

      if (category === "cabinets") {
        hasCabinets = true;
        if (normalizedType.includes("side-shelf")) {
          summedWidth += SIDE_SHELF_WIDTH_CM;
        } else if (typeof product.Width === "number" && Number.isFinite(product.Width)) {
          summedWidth += product.Width;
        }
        if (typeof product.Height === "number" && Number.isFinite(product.Height)) {
          fallbackCabinetHeight = fallbackCabinetHeight === null ? product.Height : fallbackCabinetHeight;
          if (!normalizedType.includes("side-shelf")) {
            primaryCabinetHeight = primaryCabinetHeight === null ? product.Height : primaryCabinetHeight;
          }
        }
      }

      if (productType === "SidePanel_Left" || productType === "SidePanel_Right") {
        sidePanelsCount += 1;
      }

      if (category === "countertops" && !countertopId) {
        countertopId = id;
        currentCountertopWidth = typeof product.Width === "number" ? product.Width : null;
        currentCountertopHeight = typeof product.Height === "number" ? product.Height : null;
      }
    });

    if (!hasCabinets || !countertopId) return null;

    return {
      countertopId,
      currentWidth: currentCountertopWidth,
      currentHeight: currentCountertopHeight,
      targetWidth: Number((summedWidth + sidePanelsCount).toFixed(2)),
      targetHeight: primaryCabinetHeight ?? fallbackCabinetHeight,
    };
  }, [getCompositionProducts]);

  const syncCountertopConfig = useCallback(async () => {
    const syncData = getCountertopSyncData();
    if (!syncData) return;

    const nextConfig: { Width?: number; Height?: number } = {};

    if (typeof syncData.targetWidth === "number") {
      if (typeof syncData.currentWidth !== "number" || Math.abs(syncData.currentWidth - syncData.targetWidth) >= 0.01) {
        nextConfig.Width = syncData.targetWidth;
      }
    }

    if (typeof syncData.targetHeight === "number") {
      if (
        typeof syncData.currentHeight !== "number" ||
        Math.abs(syncData.currentHeight - syncData.targetHeight) >= 0.01
      ) {
        nextConfig.Height = syncData.targetHeight;
      }
    }

    if (!Object.keys(nextConfig).length) {
      return;
    }

    await setConfig(syncData.countertopId, nextConfig);

    const updatedCountertopConfig = await getConfig(syncData.countertopId);
    if (updatedCountertopConfig) {
      setCountertopDimensionData(syncData.countertopId, updatedCountertopConfig as Record<string, unknown>);
    }
  }, [getCountertopSyncData]);

  const patchDimensionToolDisplayName = useCallback(() => {
    const tool = getDimensionTool() as any;
    if (!tool || tool.__displayNamePatched) return false;

    const originalGetDisplayName =
      typeof tool._getDisplayName === "function" ? tool._getDisplayName.bind(tool) : undefined;

    tool._getDisplayName = (productType: string) => {
      const fromRegistry = originalGetDisplayName?.(productType);
      return toDimensionDisplayName(productType, typeof fromRegistry === "string" ? fromRegistry : undefined);
    };
    tool.__displayNamePatched = true;
    return true;
  }, []);

  function setCountertopDimensionData(productId: string, config: Record<string, unknown>) {
    const dimensionTool = getDimensionTool() as any;
    if (!dimensionTool) {
      updateDimensionDataForProduct(productId, config);
      return;
    }

    const width = toFiniteNumber(config.Width);
    const depth = toFiniteNumber(config.Depth);
    const heightKey = toFiniteNumber(config.Height);
    const rawConfigThickness = toFiniteNumber(config.Thickness);
    const thicknessValue =
      rawConfigThickness !== null && rawConfigThickness > 0
        ? rawConfigThickness
        : toFiniteNumber(activeCountertopThickness);
    const thicknessLabel = thicknessValue !== null ? formatThicknessLabel(thicknessValue) : undefined;

    const nextData: Record<string, unknown> = { productId };
    if (width !== null) nextData.Width = { [String(width)]: formatCmWithInches(width) };
    if (depth !== null) nextData.Depth = { [String(depth)]: formatCmWithInches(depth) };
    if (heightKey !== null && thicknessLabel) nextData.Height = { [String(heightKey)]: thicknessLabel };

    if (!nextData.Width && !nextData.Depth && !nextData.Height) return;
    dimensionTool.setDimensionData(nextData);
  }

  const getVariantMeta = useCallback(
    (variant: { metadata?: Record<string, unknown>; name: string; image?: string | null }) => {
      const meta = (variant.metadata ?? {}) as Record<string, unknown>;
      const nested =
        typeof meta.metadata === "object" && meta.metadata
          ? (meta.metadata as Record<string, unknown>)
          : ({} as Record<string, unknown>);

      const pick = (...values: unknown[]): string | undefined => {
        for (const value of values) {
          const str = toOptionalString(value);
          if (str) return str;
        }
        return undefined;
      };

      return {
        material: pick(nested.Material, meta.Material),
        color: pick(nested.Color, meta.Color),
        look: pick(nested.Look, meta.Look),
        hex: pick(nested.hex, meta.hex),
        image: pick(nested.image, meta.image, variant.image),
        value: pick(meta.value, nested.value, variant.name),
        label: pick(meta.label, meta.Label, nested.label, nested.Label, variant.name),
      };
    },
    [],
  );

  const countertopOptionsFromApi = useMemo(() => {
    const groups = (counterTopMaterials?.availableOptions ?? []).filter((g) => g.proxyName === "Countertop Color");
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

    return groups.flatMap((group) =>
      group.options.flatMap((option) =>
        option.variants
          .filter((variant) => variant.enabled)
          .map((variant) => {
            const meta = getVariantMeta(variant);
            const metaMaterial = meta.material;
            const metaColor = meta.color;
            const metaLook = meta.look;
            const metaHex = meta.hex;
            const descSource = option.name || group.proxyName || variant.name;

            return {
              id: variant.id,
              title: meta.label ?? variant.name,
              name: variant.name,
              desc: normalizeMaterialLabel(descSource),
              metadata: {
                image: meta.image,
                value: meta.value ?? variant.name,
                sku: toOptionalString((variant.metadata as Record<string, unknown>)?.sku),
                materials: buildMaterialTokens(
                  option.name || variant.name,
                  metaMaterial,
                  group.proxyName ? [group.proxyName] : [],
                ),
                colors: toStringArrayFromCsv(metaColor),
                looks: toStringArrayFromCsv(metaLook),
                hex: metaHex?.trim(),
              },
            };
          }),
      ),
    );
  }, [counterTopMaterials, getVariantMeta]);

  const activeMaterialTokens = useMemo(() => {
    if (!activeCountertopColor) return [];
    const match = countertopOptionsFromApi.find((option) => {
      const candidate = option.metadata?.value ?? option.name ?? option.title ?? option.desc;
      return candidate === activeCountertopColor;
    });
    return match?.metadata?.materials ?? [];
  }, [activeCountertopColor, countertopOptionsFromApi]);

  const countertopRules = useMemo(() => parseCountertopMatrix(counterTopData), [counterTopData]);
  const maxCountertopLength = useMemo(
    () =>
      resolveCountertopMaxLengthByRules({
        rules: countertopRules,
        materialTokens: countertopColorSku ? [countertopColorSku] : [],
        style: countertopStyle ?? null,
        depth: selectedDimensions.depth ?? null,
        thickness: activeCountertopThickness ?? null,
      }),
    [activeCountertopThickness, countertopColorSku, countertopRules, countertopStyle, selectedDimensions.depth],
  );
  const remainingCountertopLength =
    maxCountertopLength !== null && sceneTotalWidth !== null ? maxCountertopLength - sceneTotalWidth : null;

  const addableCabinetWidths = useMemo(() => {
    const baseOptions = dimensionOptions.width.filter((option) => !option.disabled).map((option) => option.value);
    return filterWidthValuesByCountertopRules({
      values: baseOptions,
      activeCabinetCode: null,
      activeCabinetIsOpen: false,
      activeMaterialTokens,
      rules: countertopRules,
      selectedDepth: selectedDimensions.depth ?? null,
    })
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
  }, [activeMaterialTokens, countertopRules, dimensionOptions.width, selectedDimensions.depth]);

  // When a countertop material is known but no thickness has been set yet, resolve
  // the default from the rules matrix and push it into both Redux and PlayCanvas.
  // This ensures getConfig() returns a non-zero Thickness before the user clicks
  // the countertop, avoiding the stale-closure "0" shown by the dimension tool.
  useEffect(() => {
    if (activeCountertopThickness) return;
    if (!activeMaterialTokens.length) return;
    if (!countertopRules.length) return;

    const defaultThickness = resolveDefaultThicknessFromRules({
      rules: countertopRules,
      activeMaterialTokens,
      depth: selectedDimensions.depth ?? null,
    });

    if (defaultThickness) {
      dispatch(setActiveCountertopThickness(defaultThickness));
      setConfigBatch({}, { Thickness: defaultThickness });
    }
  }, [activeCountertopThickness, activeMaterialTokens, countertopRules, selectedDimensions.depth, dispatch]);

  const canAddAnotherCabinet = useMemo(() => {
    if (!addableCabinetWidths.length) return false;
    if (remainingCountertopLength === null) return true;
    return addableCabinetWidths.some((width) => width <= remainingCountertopLength + 0.01);
  }, [addableCabinetWidths, remainingCountertopLength]);

  const canDuplicateSelectedCabinet = useMemo(() => {
    if (!canAddAnotherCabinet) return false;
    if (remainingCountertopLength === null) return true;
    if (typeof selectedDimensions.width !== "number") return false;
    return selectedDimensions.width <= remainingCountertopLength + 0.01;
  }, [canAddAnotherCabinet, remainingCountertopLength, selectedDimensions.width]);

  const ruleState = useMemo(
    () =>
      buildCountertopRuleState({
        rules: countertopRules,
        activeMaterialTokens,
        width: selectedDimensions.width ?? null,
        depth: selectedDimensions.depth ?? null,
        activeBasinStyle,
        activeThickness: activeCountertopThickness ?? null,
      }),
    [
      activeBasinStyle,
      activeCountertopThickness,
      activeMaterialTokens,
      countertopRules,
      selectedDimensions.depth,
      selectedDimensions.width,
    ],
  );

  const thicknessOptions = useMemo(
    () => Array.from(ruleState.allowedThicknesses).sort((a, b) => a - b),
    [ruleState.allowedThicknesses],
  );

  const widthOptions = useMemo(() => {
    const baseOptions = dimensionOptions.width.filter((option) => !option.disabled).map((option) => option.value);
    const filteredByRules = filterWidthValuesByCountertopRules({
      values: baseOptions,
      activeCabinetCode: activeCabinetRule?.code,
      isSinkBaseCabinet: Boolean(selectedSceneProduct?.toLowerCase().startsWith("sink-base-")),
      activeCabinetIsOpen: Boolean(activeCabinetRule?.isOpen),
      activeMaterialTokens,
      rules: countertopRules,
      selectedDepth: selectedDimensions.depth ?? null,
      activeCountertopStyle: countertopStyle ?? null,
      activeBasinStyle,
      activeThickness: activeCountertopThickness ?? null,
    });
    if (
      maxCountertopLength === null ||
      sceneTotalWidth === null ||
      typeof selectedDimensions.width !== "number" ||
      !Number.isFinite(selectedDimensions.width)
    ) {
      return filteredByRules;
    }

    const maxSelectableWidth = maxCountertopLength - (sceneTotalWidth - selectedDimensions.width);
    return filteredByRules.filter((value) => {
      const numericWidth = Number(value);
      return Number.isFinite(numericWidth) && numericWidth <= maxSelectableWidth + 0.01;
    });
  }, [
    activeCabinetRule?.code,
    selectedSceneProduct,
    activeMaterialTokens,
    countertopRules,
    dimensionOptions.width,
    maxCountertopLength,
    sceneTotalWidth,
    selectedDimensions.depth,
    selectedDimensions.width,
    activeCabinetRule?.isOpen,
    activeBasinStyle,
    activeCountertopThickness,
    countertopStyle,
  ]);

  const depthOptions = useMemo(() => {
    const baseOptions = dimensionOptions.depth.filter((option) => !option.disabled).map((option) => option.value);
    return filterDepthValuesByCountertopRules({
      values: baseOptions,
      activeMaterialTokens,
      rules: countertopRules,
    });
  }, [activeMaterialTokens, countertopRules, dimensionOptions.depth]);

  const resolveCabinetTypeId = useCallback(
    (productType: string | null) => {
      if (!productType) return null;

      const normalized = productType.toLowerCase();
      const match = cabinetCatalog.typeCabinetRules.find((rule) => normalized.includes(rule.code.toLowerCase()));

      return match?.code ?? null;
    },
    [cabinetCatalog.typeCabinetRules],
  );

  const showDropdownForEntity = useCallback((entityName: string) => {
    const iframeEl = containerRef.current;
    if (!iframeEl) return;

    if (isMobileMediaQueryRef.current?.matches) {
      setDropdownState((prev) => ({ ...prev, visible: true }));
      return;
    }

    const pos = getDropdownPosition(entityName, iframeEl, lastPointerPosRef.current);
    setDropdownState({ visible: true, x: pos.x, y: pos.y });
  }, []);

  const showCountertopPopoverForEntity = useCallback((entityName: string) => {
    const iframeEl = containerRef.current;
    if (!iframeEl) return;

    if (isMobileMediaQueryRef.current?.matches) {
      setCountertopPopoverState((prev) => ({ ...prev, visible: true, entityName }));
      return;
    }

    const pos = getDropdownPosition(entityName, iframeEl, lastPointerPosRef.current, {
      width: 360,
      height: 320,
    });

    setCountertopPopoverState({ visible: true, x: pos.x, y: pos.y, entityName });
  }, []);

  const closeCountertopPopover = useCallback(() => {
    setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
  }, []);

  // Track pointer position so we know where the user clicked inside the iframe.
  // We listen on both: postMessage from the iframe (preferred) and mousemove on
  // the parent window (fallback — gives the last known position before the
  // cursor enters the iframe).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 1024px)");
    isMobileMediaQueryRef.current = mediaQuery;
    const sync = () => setIsMobileMenu(mediaQuery.matches);

    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let timerId: number | null = null;

    const tryPatch = () => {
      if (patchDimensionToolDisplayName() && timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
      }
    };

    tryPatch();
    window.addEventListener("playcanvas-ready", tryPatch);
    timerId = window.setInterval(tryPatch, 500);

    return () => {
      window.removeEventListener("playcanvas-ready", tryPatch);
      if (timerId !== null) {
        window.clearInterval(timerId);
      }
    };
  }, [patchDimensionToolDisplayName]);

  useEffect(() => {
    const iframeEl = containerRef.current;

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "pointer-position") {
        lastPointerPosRef.current = { x: e.data.x, y: e.data.y };
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!iframeEl) return;

      const rect = iframeEl.getBoundingClientRect();
      lastPointerPosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    window.addEventListener("message", onMessage);
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  // Bridge PlayCanvas Configurator API
  useEffect(() => {
    (window as any).containerRef = containerRef;
    (window as any).playCanvasReady = false;

    const iframeEl = containerRef.current;
    if (!iframeEl) return;

    let pollId: number | null = null;

    const markReady = () => {
      (window as any).playCanvasReady = true;
      window.dispatchEvent(new Event("playcanvas-ready"));
    };

    const tryBridgeApi = (cw: any) => {
      const api = cw?.ConfiguratorAPI;
      const addProduct = api?.addProduct || cw?.addProduct;
      if (typeof addProduct === "function") {
        cw.addProduct = api?.addProduct ? api.addProduct.bind(api) : addProduct.bind(api || cw);

        const cameraApi = api?.camera;
        if (cameraApi) {
          try {
            cameraApi.setFramingConfig?.({
              paddingWide: GLOBAL_CAMERA_PADDING_WIDE,
              paddingTall: GLOBAL_CAMERA_PADDING_TALL,
            });
            cameraApi.focusCamera?.();
          } catch (error) {
            console.warn("[PlayCanvasIntegration] Failed to apply global camera zoom-out settings", error);
          }
        }

        markReady();
        return true;
      }
      return false;
    };

    const handleLoad = () => {
      const cw = iframeEl.contentWindow as any;
      if (!cw) return;

      if (tryBridgeApi(cw)) return;

      const startedAt = Date.now();
      const pollInterval = 200;
      const maxWaitMs = 30000;

      pollId = window.setInterval(() => {
        if (tryBridgeApi(cw)) {
          if (pollId !== null) clearInterval(pollId);
          pollId = null;
          return;
        }

        if (Date.now() - startedAt > maxWaitMs) {
          if (pollId !== null) clearInterval(pollId);
          pollId = null;
          console.warn("PlayCanvasIntegration: ConfiguratorAPI.addProduct not available");
        }
      }, pollInterval);
    };

    iframeEl.addEventListener("load", handleLoad);
    return () => {
      iframeEl.removeEventListener("load", handleLoad);
      if (pollId !== null) clearInterval(pollId);
    };
  }, []);

  // useEffect(() => {
  //   if (!playCanvasReady) return;

  //   const tool = getDimensionTool();
  //   tool?.setEnabled(true);
  // }, [playCanvasReady]);

  const handleSetWidth = useCallback(
    async (width: number) => {
      if (!selectedSceneProduct) return;

      try {
        await saveSnapshot();
        await setConfig(selectedSceneProduct, { Width: width });
        await syncCountertopConfig();

        dispatch(setSelectedDimensions({ width }));
      } catch (error) {
        console.error("[PlayCanvasIntegration] Failed to set width", error);
      } finally {
        setDropdownState((prev) => ({ ...prev, visible: false }));
      }
    },
    [selectedSceneProduct, saveSnapshot, dispatch, syncCountertopConfig],
  );

  const handleSetDepth = useCallback(
    async (depth: number) => {
      if (!productIds) return;

      try {
        await saveSnapshot();
        await setConfigBatch({}, { Depth: depth });

        dispatch(setSelectedDimensions({ depth }));
      } catch (error) {
        console.error("[PlayCanvasIntegration] Failed to set depth", error);
      } finally {
        setDropdownState((prev) => ({ ...prev, visible: false }));
      }
    },
    [productIds, saveSnapshot, dispatch],
  );

  useEffect(() => {
    if (selectedDimensions.height === null || selectedDimensions.height === undefined) return;
    void syncCountertopConfig();
  }, [selectedDimensions.height, syncCountertopConfig]);

  const handleSetHandleType = useCallback(
    async (handleType: string) => {
      const option = dimensionOptions.handles.find((h) => String(h.value) === handleType);
      if (option?.disabled) return;

      try {
        await saveSnapshot();
        pendingHandleSyncRef.current = true;
        dispatch(setSelectedProductConfig({ ...(selectedProductConfig ?? {}), Handle: handleType }));

        if (productIds.length) {
          await setConfigBatch({}, { Handle: handleType });
        }
      } catch (error) {
        console.error("[PlayCanvasIntegration] Failed to set handle type", error);
      } finally {
        setDropdownState((prev) => ({ ...prev, visible: false }));
      }
    },
    [dispatch, dimensionOptions.handles, productIds, saveSnapshot, selectedProductConfig],
  );

  // After a handle selection forces a new height via the rules engine, push it to PlayCanvas.
  // The same effect in RightCabinetStyleSidebar.
  useEffect(() => {
    if (!pendingHandleSyncRef.current) return;

    if (selectedDimensions.height === null || selectedDimensions.height === undefined) return;

    pendingHandleSyncRef.current = false;
    setConfigBatch({}, { Height: selectedDimensions.height });
  }, [selectedDimensions]);

  useEffect(() => {
    const currentHandle =
      typeof selectedProductConfig?.Handle === "string" ? (selectedProductConfig.Handle as string) : undefined;
    const prevHandle = prevHandleRef.current;
    prevHandleRef.current = currentHandle;

    if (!currentHandle || currentHandle === prevHandle) return;
    if (!productIds.length) return;

    setConfigBatch({}, { Handle: currentHandle });
  }, [productIds.length, selectedProductConfig?.Handle]);

  useEffect(() => {
    if (!isDrawerOpen) return;

    setDropdownState((prev) => ({ ...prev, visible: false }));
    setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
  }, [isDrawerOpen]);

  // Detects if the currently selected scene entity is a TowelBar addon.
  // Entity names follow the pattern "TowelBar_Left-<randomId>" / "TowelBar_Right-<randomId>"
  const isTowelBarEntity = useMemo(() => {
    const candidates = [
      selectedSceneProduct,
      typeof selectedProductConfig?.productType === "string" ? (selectedProductConfig.productType as string) : null,
      typeof selectedProductConfig?.entityName === "string" ? (selectedProductConfig.entityName as string) : null,
    ]
      .filter(Boolean)
      .map((value) =>
        String(value)
          .toLowerCase()
          .replace(/[_\s-]/g, ""),
      );

    return candidates.some((value) => value.startsWith("towelbar"));
  }, [selectedProductConfig, selectedSceneProduct]);

  const handleRemoveProducts = useCallback(async () => {
    if (!selectedSceneProduct) return;

    try {
      await saveSnapshot();

      // ── Towel Bar deletion ────────────────────────────────────────────────
      // TowelBar entities are NOT cabinet products — they are managed entirely
      // via setConfigBatch({ TowelBar, TowelBarSide }).
      // We must NOT call removeProduct/removeProductId for them.
      if (isTowelBarEntity) {
        // Determine which side was deleted from the entity name
        // e.g. "TowelBar_Left-abc123" → "left",  "TowelBar_Right-xyz789" → "right"
        const nameLower = (selectedSceneProduct ?? "").toLowerCase();
        const deletedSide: "left" | "right" | null = nameLower.includes("towelbar_left")
          ? "left"
          : nameLower.includes("towelbar_right")
            ? "right"
            : null;

        // Deletion matrix:
        //  Both + delete left  → Right
        //  Both + delete right → Left
        //  Both + unknown side → None  (safe fallback)
        //  Left + delete left  → None
        //  Right + delete right → None
        let nextOption = "None";
        if (towelBarOption === "Both") {
          if (deletedSide === "left") nextOption = "Right";
          else if (deletedSide === "right") nextOption = "Left";
        }

        // Sync PlayCanvas: clear all, then re-add the remaining side if any
        await setConfigBatch({}, { TowelBar: "None", TowelBarSide: "both" });
        if (nextOption !== "None") {
          await setConfigBatch({}, { TowelBar: "TowelBar40_R", TowelBarSide: nextOption.toLowerCase() });
        } else {
          dispatch(setTowelBarColor(""));
        }

        dispatch(setTowelBarOption(nextOption));
        setDropdownState((prev) => ({ ...prev, visible: false }));
        return;
      }

      // ── Cabinet / side panel deletion (existing logic) ────────────────────
      await removeProduct(selectedSceneProduct);
      dispatch(removeProductId(selectedSceneProduct));
    } catch (error) {
      console.error("[PlayCanvasIntegration] Failed to remove product", error);
    } finally {
      setDropdownState((prev) => ({ ...prev, visible: false }));
    }
  }, [dispatch, isTowelBarEntity, selectedSceneProduct, towelBarOption, saveSnapshot]);

  const normalizeProductType = useCallback((value: string, productId: string) => {
    const lastDash = value.lastIndexOf("-");
    if (lastDash > 0) {
      const suffix = value.slice(lastDash + 1);
      if (suffix.length >= 6) {
        return value.slice(0, lastDash);
      }
    }

    if (value === productId) {
      const idLastDash = productId.lastIndexOf("-");
      if (idLastDash > 0) {
        const idSuffix = productId.slice(idLastDash + 1);
        if (idSuffix.length >= 6) {
          return productId.slice(0, idLastDash);
        }
      }
    }

    return value;
  }, []);
  const resolveProductTypeFromId = useCallback(
    (productId: string, config?: Record<string, unknown>) => {
      const configProductType = typeof config?.productType === "string" ? config.productType : null;
      if (configProductType) return normalizeProductType(configProductType, productId);

      const configEntityName = typeof config?.entityName === "string" ? config.entityName : null;
      if (configEntityName) return normalizeProductType(configEntityName, productId);

      const lastDash = productId.lastIndexOf("-");
      if (lastDash > 0) {
        return productId.slice(0, lastDash);
      }

      return productId;
    },
    [normalizeProductType],
  );

  const handleDuplicateProduct = useCallback(() => {
    if (!selectedSceneProduct || !canDuplicateSelectedCabinet) return;
    setDuplicateSourceId(selectedSceneProduct);
    const duplicateProductType = resolveProductTypeFromId(
      selectedSceneProduct,
      selectedProductConfig as Record<string, unknown> | undefined,
    );
    const options =
      typeof duplicateProductType === "string" && duplicateProductType.toLowerCase().includes("side-shelf")
        ? { productType: "Side-Shelf" }
        : undefined;
    setVisibleButtons(true, options);

    setDropdownState((prev) => ({ ...prev, visible: false }));
    setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
  }, [canDuplicateSelectedCabinet, resolveProductTypeFromId, selectedProductConfig, selectedSceneProduct]);

  useEffect(() => {
    if (!duplicateSourceId) return;

    const onPlusClick = async (entityId: string, side: "left" | "right") => {
      try {
        if (
          maxCountertopLength !== null &&
          sceneTotalWidth !== null &&
          typeof selectedDimensions.width === "number" &&
          sceneTotalWidth + selectedDimensions.width > maxCountertopLength + 0.01
        ) {
          return;
        }

        await saveSnapshot();
        const config = await getConfig(duplicateSourceId);
        if (!config) return;
        const mergedConfig = { ...config, ...selectedProductConfig };

        console.log("mergedConfig", mergedConfig);

        const productType = resolveProductTypeFromId(duplicateSourceId, mergedConfig);
        if (typeof productType === "string" && productType.toLowerCase().includes("side-shelf")) {
          await setSidePanel("None", side);
        }
        const productId = await setProductByParams(productType, entityId, side);
        if (!productId) return;

        await setConfig(productId, mergedConfig);
        dispatch(addProductId(productId));

        const drawers = mergedConfig.Drawers as string | undefined;
        const drawerRawValue = drawers === "1D" ? "1" : drawers === "2D" ? "2" : drawers === "1DWID" ? "1+inner" : null;
        if (drawerRawValue) dispatch(setPlacedCabinetStyle({ id: productId, value: drawerRawValue }));

        updateDimensionDataForProduct(productId, mergedConfig);
      } catch (error) {
        console.error("[PlayCanvasIntegration] Failed to duplicate product", error);
      } finally {
        setVisibleButtons(false);
        setDuplicateSourceId(null);
      }
    };

    setHandleButtonClick(onPlusClick);

    return () => {
      setVisibleButtons(false);
    };
  }, [
    dispatch,
    duplicateSourceId,
    maxCountertopLength,
    resolveProductTypeFromId,
    saveSnapshot,
    sceneTotalWidth,
    selectedDimensions.width,
    selectedProductConfig,
  ]);

  // Navigate to the Cabinet builder page with the enabled Right sidebar.
  const handleAddAdditionalProduct = useCallback(() => {
    if (!canAddAnotherCabinet) return;
    navigate("/custom/cabinet-builder?accordion=cabinet-type");

    setDropdownState((prev) => ({ ...prev, visible: false }));
    setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
  }, [canAddAnotherCabinet, navigate]);

  const handleOpenCustomizeModePrompt = useCallback(
    (action: CustomizeModePromptAction, deleteTarget: string | null = null) => {
      setCustomizeModePromptAction(action);
      setCustomizeModePromptDeleteTarget(deleteTarget);
      setIsCustomizeModePromptOpen(true);
      setDropdownState((prev) => ({ ...prev, visible: false }));
      setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
    },
    [],
  );

  const handleCustomizeModePromptOpenChange = useCallback((isOpening: boolean) => {
    setIsCustomizeModePromptOpen(isOpening);

    if (!isOpening) {
      setCustomizeModePromptAction("default");
      setCustomizeModePromptDeleteTarget(null);
    }
  }, []);

  const handleAddFromPrebuilt = useCallback(() => {
    handleOpenCustomizeModePrompt("add");
  }, [handleOpenCustomizeModePrompt]);

  const handleDeleteFromPrebuilt = useCallback(() => {
    if (!selectedSceneProduct) return;
    handleOpenCustomizeModePrompt("delete", selectedSceneProduct);
  }, [handleOpenCustomizeModePrompt, selectedSceneProduct]);

  const enforceSidePanelEligibilityForEdgeCabinets = useCallback(async () => {
    const { leftCabinetId, rightCabinetId } = getEdgeCabinets();
    const remembered = getRememberedSidePanels();
    const targets: Array<{ side: "left" | "right"; cabinetId: string | null; opposite: "left" | "right" }> = [
      { side: "left", opposite: "right", cabinetId: leftCabinetId },
      { side: "right", opposite: "left", cabinetId: rightCabinetId },
    ];

    const sideEligibility: Record<"left" | "right", boolean> = {
      left: true,
      right: true,
    };

    for (const target of targets) {
      if (!target.cabinetId) continue;
      const cfg = await getConfig(target.cabinetId);
      const config = cfg && typeof cfg === "object" ? (cfg as Record<string, unknown>) : null;
      const rawType =
        (typeof config?.productType === "string" && config.productType) ||
        (typeof config?.ProductType === "string" && config.ProductType) ||
        (typeof config?.name === "string" && config.name) ||
        target.cabinetId;
      const group = mapCabinetTypeToGroup(rawType);
      sideEligibility[target.side] = group !== "OS" && group !== "OSS";
    }

    for (const target of targets) {
      if (sideEligibility[target.side]) continue;
      const currentType = remembered[target.side];
      if (!currentType || currentType === "None") continue;

      if (sideEligibility[target.opposite] && remembered[target.opposite] === "None") {
        await setSidePanel(currentType, target.opposite);
      }

      await setSidePanel("None", target.side);
    }
  }, []);

  const handleSwapProducts = useCallback(
    async (idA: string, idB: string) => {
      await saveSnapshot();
      swapProducts(idA, idB);
      dispatch(swapProductIds({ idA, idB }));
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 0));
      await enforceSidePanelEligibilityForEdgeCabinets();
    },
    [dispatch, enforceSidePanelEligibilityForEdgeCabinets, saveSnapshot],
  );

  const handleMoveProduct = useCallback(
    async (direction: "left" | "right") => {
      if (!selectedSceneProduct) return;

      const orderedIds = getOrderedProductIds(productIds);
      const currentIndex = orderedIds.indexOf(selectedSceneProduct);
      if (currentIndex === -1) return;

      const neighborIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
      if (neighborIndex < 0 || neighborIndex >= orderedIds.length) return;

      await handleSwapProducts(selectedSceneProduct, orderedIds[neighborIndex]);
      setDropdownState((prev) => ({ ...prev, visible: false }));
    },
    [handleSwapProducts, productIds, selectedSceneProduct],
  );

  useEffect(() => {
    isPrebuiltRef.current = isPrebuilt;
    if (!isPrebuilt) {
      setIsCustomizeModePromptOpen(false);
      setCustomizeModePromptAction("default");
      setCustomizeModePromptDeleteTarget(null);
    }
  }, [isPrebuilt]);

  // Double-click detection via iframe contentDocument (same-origin).
  // window.mousedown does NOT fire for clicks inside an iframe, so we must
  // attach directly to the iframe's own document.
  useEffect(() => {
    const iframeEl = containerRef.current;
    if (!iframeEl) return;

    let detachListeners: (() => void) | null = null;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (!isPrebuiltRef.current) return;
      if (e.detail !== 2) return;
      setCustomizeModePromptAction("default");
      setCustomizeModePromptDeleteTarget(null);
      setIsCustomizeModePromptOpen(true);
    };

    const attach = () => {
      const doc = iframeEl.contentDocument;
      if (!doc) return () => {};
      const href = doc.location?.href;
      if (href === "about:blank") return () => {};

      doc.addEventListener("mousedown", onMouseDown, true);
      return () => {
        doc.removeEventListener("mousedown", onMouseDown, true);
      };
    };

    const attachSafe = () => {
      if (detachListeners) {
        detachListeners();
        detachListeners = null;
      }
      detachListeners = attach();
    };

    if (iframeEl.contentDocument) {
      attachSafe();
    }

    const onLoad = () => attachSafe();
    iframeEl.addEventListener("load", onLoad);
    return () => {
      iframeEl.removeEventListener("load", onLoad);
      if (detachListeners) detachListeners();
    };
  }, []);

  useEffect(() => {
    const iframeEl = containerRef.current;
    if (!iframeEl) return;

    const onFrameMouseDown = (e: MouseEvent) => {
      console.log("[CustomizeModePrompt] iframe element mousedown", {
        button: e.button,
        detail: e.detail,
      });
    };

    const onFrameClick = (e: MouseEvent) => {
      console.log("[CustomizeModePrompt] iframe element click", {
        button: e.button,
        detail: e.detail,
      });
    };

    const onFrameDblClick = (e: MouseEvent) => {
      console.log("[CustomizeModePrompt] iframe element dblclick", {
        button: e.button,
        detail: e.detail,
      });
    };

    iframeEl.addEventListener("mousedown", onFrameMouseDown, true);
    iframeEl.addEventListener("click", onFrameClick, true);
    iframeEl.addEventListener("dblclick", onFrameDblClick, true);

    return () => {
      iframeEl.removeEventListener("mousedown", onFrameMouseDown, true);
      iframeEl.removeEventListener("click", onFrameClick, true);
      iframeEl.removeEventListener("dblclick", onFrameDblClick, true);
    };
  }, []);

  const handleCustomizeFromPrompt = useCallback(async () => {
    setIsCustomizeModePromptOpen(false);
    const action = customizeModePromptAction;
    const deleteTargetId = customizeModePromptDeleteTarget;
    setCustomizeModePromptAction("default");
    setCustomizeModePromptDeleteTarget(null);
    if (!productsPresets.length) return;

    // Read current scene values first so default prebuilt colors are preserved
    // and explicit user overrides on prebuilt are also transferred to custom.
    const getNonEmptyString = (value: unknown): string | undefined =>
      typeof value === "string" && value.trim() ? value : undefined;

    let sceneCabinetColor: string | undefined;
    let sceneCountertopColor: string | undefined;
    let sceneSinkType: string | undefined;
    let sceneHandleGrooveColor: string | undefined;

    const orderedIds = getOrderedProductIds();
    for (const productId of orderedIds) {
      const config = await getConfig(productId);
      if (!config || typeof config !== "object") continue;

      sceneCabinetColor = sceneCabinetColor ?? getNonEmptyString((config as Record<string, unknown>).CabinetColor);
      sceneCountertopColor =
        sceneCountertopColor ?? getNonEmptyString((config as Record<string, unknown>).CountertopColor);
      sceneSinkType = sceneSinkType ?? getNonEmptyString((config as Record<string, unknown>).sinkType);
      sceneHandleGrooveColor =
        sceneHandleGrooveColor ?? getNonEmptyString((config as Record<string, unknown>).HandleGrooveColor);

      if (sceneCabinetColor && sceneCountertopColor && sceneSinkType && sceneHandleGrooveColor) {
        break;
      }
    }

    const updatedPresets = productsPresets.map((preset) => ({
      ...preset,
      CabinetColor: sceneCabinetColor ?? preset.CabinetColor,
      CountertopColor: sceneCountertopColor ?? preset.CountertopColor,
      sinkType: sceneSinkType ?? preset.sinkType,
      HandleGrooveColor: sceneHandleGrooveColor ?? preset.HandleGrooveColor,
    }));

    if (action === "delete" && deleteTargetId) {
      sessionStorage.setItem(PENDING_CUSTOM_DELETE_PRODUCT_ID_KEY, deleteTargetId);
    } else {
      sessionStorage.removeItem(PENDING_CUSTOM_DELETE_PRODUCT_ID_KEY);
    }

    dispatch(addProductPreset(updatedPresets));
    dispatch(resetProducts());
    dispatch(resetCabinetBuilderBootstrap());

    if (action === "add") {
      navigate("/custom/cabinet-builder?accordion=cabinet-type");
      return;
    }

    navigate(ROUTES.CUSTOM);
  }, [customizeModePromptAction, customizeModePromptDeleteTarget, dispatch, navigate, productsPresets]);

  const handleOpenCabinetStyle = useCallback(() => {
    navigate("/custom/cabinet-builder?accordion=cabinet-style");
    setDropdownState((prev) => ({ ...prev, visible: false }));
  }, [navigate]);

  const handleOpenCabinetColor = useCallback(() => {
    navigate(isPrebuilt ? "/prebuilt/color" : "/custom/cabinet-colors?accordion=cabinet-color");
    setDropdownState((prev) => ({ ...prev, visible: false }));
  }, [isPrebuilt, navigate]);

  const handleOpenAccessories = useCallback(() => {
    navigate(isPrebuilt ? "/prebuilt/accessories" : "/custom/accessories");
    setDropdownState((prev) => ({ ...prev, visible: false }));
  }, [isPrebuilt, navigate]);

  const isTopViewActive = useCallback((): boolean => {
    const api = (containerRef.current?.contentWindow as any)?.ConfiguratorAPI as
      | {
          isTopViewActive?: () => boolean;
        }
      | undefined;
    try {
      return Boolean(api?.isTopViewActive?.());
    } catch {
      return false;
    }
  }, []);

  const hideOpenDrawerButtons = useCallback(() => {
    if (isTopViewActive()) return;
    onDrawerWidgetRender(null);
    setVisibleDrawerButtons(false);
    openDrawerButtonsTargetRef.current = null;
  }, [isTopViewActive]);

  const handleOpenDrawerButtonsForSelectedProduct = useCallback(() => {
    if (!selectedSceneProduct) return;

    onDrawerWidgetRender((drawerInfo, parentEl) => {
      if (drawerInfo.cabinetId !== selectedSceneProduct) {
        parentEl.innerHTML = "";
        parentEl.style.display = "none";
        return;
      }

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
        const api = (containerRef.current?.contentWindow as any)?.ConfiguratorAPI as
          | {
              showTopView?: (cabinetId: string, drawerType: "Top" | "TopFull" | "Bot") => unknown;
              openDrawer?: (cabinetId: string, drawerType: "Top" | "TopFull" | "Bot") => unknown;
              setVisibleDividerSlotButtons?: (visible: boolean) => unknown;
              dividers?: {
                showIconDividerSlots?: (
                  cabinetId: string,
                  drawerType: "Top" | "TopFull" | "Bot",
                  show?: boolean,
                ) => unknown;
              };
            }
          | undefined;
        const normalizedDrawerType = drawerInfo.drawerType === "TopFull" ? "Top" : drawerInfo.drawerType;

        const hideDividerSlots = () => {
          api?.setVisibleDividerSlotButtons?.(false);
          api?.dividers?.showIconDividerSlots?.(drawerInfo.cabinetId, normalizedDrawerType, false);
          api?.dividers?.showIconDividerSlots?.(drawerInfo.cabinetId, drawerInfo.drawerType, false);

          // Fallback: force-hide divider slot DOM overlays inside iframe (both + and occupied/check states).
          const iframeDocument = containerRef.current?.contentWindow?.document;
          if (!iframeDocument) return;

          const nodes = iframeDocument.querySelectorAll(
            "#divider-slot-overlay-layer, .divider-slot-btn, .divider-slot-add, .divider-slot-occupied",
          );
          nodes.forEach((node) => {
            const el = node as HTMLElement;
            el.style.display = "none";
            el.style.visibility = "hidden";
            el.style.pointerEvents = "none";
          });
        };

        // Preview-only mode: hide divider slot "+" controls.
        hideDividerSlots();
        const openResult = api?.openDrawer?.(drawerInfo.cabinetId, normalizedDrawerType) as Promise<unknown> | unknown;
        const isThenable = !!openResult && typeof (openResult as Promise<unknown>).then === "function";
        if (isThenable) {
          (openResult as Promise<unknown>)
            .catch(() => null)
            .then(() => {
              api?.showTopView?.(drawerInfo.cabinetId, normalizedDrawerType);
            });
        } else {
          api?.showTopView?.(drawerInfo.cabinetId, normalizedDrawerType);
        }
        window.setTimeout(hideDividerSlots, 0);
        window.setTimeout(hideDividerSlots, 250);

        // After closing top view, auto-hide preview buttons and restore outline on the selected product.
        const watchTopViewClose = () => {
          if (isTopViewActive()) {
            window.requestAnimationFrame(watchTopViewClose);
            return;
          }

          // Keep "Open Drawer" buttons visible in preview mode after close.
          setVisibleDrawerButtons(true);

          if (selectedSceneProduct) {
            selectTool?.setSelectedByName(selectedSceneProduct, { mode: "replace" });
          }
        };
        window.requestAnimationFrame(watchTopViewClose);
      });
      parentEl.appendChild(button);
    });

    onDrawerCloseWidgetRender((drawerInfo, parentEl) => {
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

        const api = (containerRef.current?.contentWindow as any)?.ConfiguratorAPI as
          | {
              closeDrawer?: (cabinetId: string, drawerType: "Top" | "TopFull" | "Bot") => unknown;
              exitTopView?: () => unknown;
            }
          | undefined;

        const normalizedDrawerType = drawerInfo.drawerType === "TopFull" ? "Top" : drawerInfo.drawerType;
        const closeResult = api?.closeDrawer?.(drawerInfo.cabinetId, normalizedDrawerType) as
          | Promise<unknown>
          | unknown;
        const isThenable = !!closeResult && typeof (closeResult as Promise<unknown>).then === "function";

        const finishClose = () => {
          api?.exitTopView?.();
          setVisibleDrawerButtons(true);
          setDropdownState((prev) => ({ ...prev, visible: false }));
          setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
          if (selectedSceneProduct) {
            suppressNextDropdownOpenRef.current = true;
            getSelectTool()?.setSelectedByName(selectedSceneProduct, { mode: "replace" });
          }
        };

        if (isThenable) {
          (closeResult as Promise<unknown>).catch(() => null).then(finishClose);
        } else {
          finishClose();
        }
      });
      parentEl.appendChild(button);
    });

    setVisibleDrawerButtons(true);
    openDrawerButtonsTargetRef.current = selectedSceneProduct;
    setDropdownState((prev) => ({ ...prev, visible: false }));
  }, [selectedSceneProduct]);

  const isCountertopEntity = useCallback((entityName: string | null, config?: Record<string, unknown>) => {
    if (!entityName) return false;
    const candidates = [
      entityName,
      typeof config?.ProductType === "string" ? (config.ProductType as string) : null,
      typeof config?.productType === "string" ? (config.productType as string) : null,
      typeof config?.type === "string" ? (config.type as string) : null,
      typeof config?.entityName === "string" ? (config.entityName as string) : null,
    ].filter(Boolean) as string[];

    return candidates.some((value) => value.startsWith("Top_"));
  }, []);

  const isSidePanelEntity = useMemo(() => {
    const candidates = [
      selectedSceneProduct,
      typeof selectedProductConfig?.ProductType === "string" ? (selectedProductConfig.ProductType as string) : null,
      typeof selectedProductConfig?.productType === "string" ? (selectedProductConfig.productType as string) : null,
      typeof selectedProductConfig?.type === "string" ? (selectedProductConfig.type as string) : null,
      typeof selectedProductConfig?.entityName === "string" ? (selectedProductConfig.entityName as string) : null,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    return candidates.some((value) => value.includes("sidepanel") || value.includes("side-panel"));
  }, [selectedProductConfig, selectedSceneProduct]);

  const selectToolAttachedRef = useRef(false);
  const selectTool = getSelectTool();

  if (selectTool && !selectToolAttachedRef.current) {
    selectToolAttachedRef.current = true;

    selectTool.on("select", (selectedEntity) => {
      const firstSelected = Array.isArray(selectedEntity) ? selectedEntity[0] : selectedEntity;

      if (firstSelected) {
        if (openDrawerButtonsTargetRef.current && firstSelected.name !== openDrawerButtonsTargetRef.current) {
          hideOpenDrawerButtons();
        }

        console.log(`Выбран объект: ${firstSelected.name}`);

        (async () => {
          const config = await getConfig(firstSelected.name ?? "");

          if (!config) return;

          dispatch(setSelectedSceneProduct(firstSelected.name!));
          // replace any previous selection
          selectTool?.setSelectedByName(firstSelected.name ?? "", { mode: "replace" });

          const configForDimensions = { ...config };

          if (isCountertopEntity(firstSelected.name ?? "", configForDimensions)) {
            const syncData = getCountertopSyncData();
            if (syncData && syncData.countertopId === (firstSelected.name ?? "")) {
              const nextCountertopConfig: { Width?: number; Height?: number } = {};

              if (
                typeof syncData.currentWidth !== "number" ||
                Math.abs(syncData.currentWidth - syncData.targetWidth) >= 0.01
              ) {
                nextCountertopConfig.Width = syncData.targetWidth;
              }

              if (
                typeof syncData.targetHeight === "number" &&
                (typeof syncData.currentHeight !== "number" ||
                  Math.abs(syncData.currentHeight - syncData.targetHeight) >= 0.01)
              ) {
                nextCountertopConfig.Height = syncData.targetHeight;
              }

              if (Object.keys(nextCountertopConfig).length) {
                await setConfig(firstSelected.name ?? "", nextCountertopConfig);
              }

              configForDimensions.Width = syncData.targetWidth;
            }
          }

          if (isCountertopEntity(firstSelected.name ?? "", configForDimensions)) {
            setCountertopDimensionData(firstSelected.name ?? "", configForDimensions as Record<string, unknown>);
            setDropdownState((prev) => ({ ...prev, visible: false }));
            if (suppressNextDropdownOpenRef.current) {
              suppressNextDropdownOpenRef.current = false;
              return;
            }
            showCountertopPopoverForEntity(firstSelected.name ?? "");
          } else {
            updateDimensionDataForProduct(firstSelected.name ?? "", configForDimensions);
            setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
            if (suppressNextDropdownOpenRef.current) {
              suppressNextDropdownOpenRef.current = false;
              return;
            }
            showDropdownForEntity(firstSelected.name ?? "");
          }
        })();
      } else {
        console.log("клик в пустоту");
        if (openDrawerButtonsTargetRef.current) {
          hideOpenDrawerButtons();
        }
        // dispatch(setSelectedSceneProduct(""));
        setDropdownState((prev) => ({ ...prev, visible: false }));
        setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
      }
    });
  }

  useEffect(() => {
    if (!countertopPopoverState.visible) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !countertopPopoverRef.current) return;
      if (!countertopPopoverRef.current.contains(target)) {
        closeCountertopPopover();
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [closeCountertopPopover, countertopPopoverState.visible]);

  useEffect(() => {
    const handleGlobalModalOpened = () => {
      setDropdownState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      setCountertopPopoverState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };

    window.addEventListener("global-modal-opened", handleGlobalModalOpened);
    return () => window.removeEventListener("global-modal-opened", handleGlobalModalOpened);
  }, []);

  useEffect(() => {
    if (!isMobileMenu) {
      setMobilePreviewImage(null);
      return;
    }

    if (!dropdownState.visible && !countertopPopoverState.visible) {
      setMobilePreviewImage(null);
      return;
    }

    let isCancelled = false;

    const loadPreview = async () => {
      const image = await captureScreenshot();
      if (!isCancelled) {
        setMobilePreviewImage(image);
      }
    };

    void loadPreview();

    return () => {
      isCancelled = true;
    };
  }, [countertopPopoverState.visible, dropdownState.visible, isMobileMenu, selectedSceneProduct]);

  useEffect(() => {
    const entityName = countertopPopoverState.entityName;
    if (!countertopPopoverState.visible || !entityName) return;

    const handleResize = () => {
      const iframeEl = containerRef.current;
      if (!iframeEl) return;
      const pos = getDropdownPosition(entityName, iframeEl, lastPointerPosRef.current, {
        width: 360,
        height: 320,
      });
      setCountertopPopoverState((prev) => ({ ...prev, x: pos.x, y: pos.y }));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [countertopPopoverState.entityName, countertopPopoverState.visible]);

  useEffect(() => {
    if (!selectedSceneProduct) return;

    const loadConfig = async () => {
      const config = await getConfig(selectedSceneProduct);
      if (!config) return;

      const productType =
        (typeof config.ProductType === "string" && config.ProductType) ||
        (typeof config.productType === "string" && config.productType) ||
        (typeof config.type === "string" && config.type) ||
        null;
      const resolvedCabinetTypeId = resolveCabinetTypeId(productType ?? selectedSceneProduct);

      if (resolvedCabinetTypeId !== null) {
        dispatch(setActiveCabinetType(resolvedCabinetTypeId));
      }

      dispatch(setSelectedProductConfig(config));

      const nextDimensions: { width?: number; height?: number; depth?: number } = {};

      if (typeof config.Width === "number") nextDimensions.width = config.Width;
      if (typeof config.Height === "number") nextDimensions.height = config.Height;
      if (typeof config.Depth === "number") nextDimensions.depth = config.Depth;

      if (Object.keys(nextDimensions).length) {
        dispatch(setSelectedDimensions(nextDimensions));
      }
    };

    loadConfig();
  }, [dispatch, resolveCabinetTypeId, selectedSceneProduct]);

  useEffect(() => {
    if (!selectedSceneProduct) return;
    if (isStyleSidebarOpen) return;

    let cancelled = false;

    const syncSelectedDimensionsFromScene = async () => {
      if (pendingHandleSyncRef.current) return;
      const config = await getConfig(selectedSceneProduct);
      if (!config || cancelled) return;

      const width = toFiniteNumber(config.Width);
      const height = toFiniteNumber(config.Height);
      const depth = toFiniteNumber(config.Depth);

      const nextDimensions: { width?: number; height?: number; depth?: number } = {};

      if (width !== null && (selectedDimensions.width === null || Math.abs(selectedDimensions.width - width) >= 0.01)) {
        nextDimensions.width = width;
      }

      if (
        height !== null &&
        (selectedDimensions.height === null || Math.abs(selectedDimensions.height - height) >= 0.01)
      ) {
        nextDimensions.height = height;
      }

      if (depth !== null && (selectedDimensions.depth === null || Math.abs(selectedDimensions.depth - depth) >= 0.01)) {
        nextDimensions.depth = depth;
      }

      if (Object.keys(nextDimensions).length) {
        dispatch(setSelectedDimensions(nextDimensions));
      }
    };

    void syncSelectedDimensionsFromScene();
    const intervalId = window.setInterval(() => {
      void syncSelectedDimensionsFromScene();
    }, 350);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [dispatch, isStyleSidebarOpen, selectedDimensions.depth, selectedDimensions.height, selectedDimensions.width, selectedSceneProduct]);

  const dropdownItems: DropdownItem[] = useMemo(() => {
    if (isPrebuilt) {
      return [
        {
          id: "color",
          label: "Color",
          children: [
            {
              id: "cabinet-select-color",
              label: "Select Color",
              trailing: <ArrowTopRight color={"#333"} />,
              onClick: handleOpenCabinetColor,
            },
          ],
        },
        {
          id: "accessories",
          label: "Accessories",
          trailing: <ArrowTopRight color={"#333"} />,
          onClick: handleOpenAccessories,
        },
        ...(isOneOrTwoDrawerProduct
          ? [
              {
                id: "open",
                label: "Open",
                trailing: <OpenMenuIcon />,
                onClick: handleOpenDrawerButtonsForSelectedProduct,
              },
            ]
          : []),
        { id: "add", label: "Add", trailing: "", onClick: handleAddFromPrebuilt },
        ...(selectedSceneProduct
          ? [{ id: "delete", label: "Delete", trailing: <DeleteMenuIcon />, onClick: handleDeleteFromPrebuilt }]
          : []),
      ];
    }

    if (isSidePanelEntity) {
      return [{ id: "delete", label: "Delete", trailing: <DeleteMenuIcon />, onClick: handleRemoveProducts }];
    }

    if (isTowelBarEntity) {
      return [{ id: "delete", label: "Delete", trailing: <DeleteMenuIcon />, onClick: handleRemoveProducts }];
    }

    const items: DropdownItem[] = [
      {
        id: "resize",
        label: "Resize",
        children: [
          {
            id: "resize-width",
            label: "Width",
            children: widthOptions.map((value) => ({
              id: `resize-width-${value}`,
              label: `${value}`,
              onClick: () => handleSetWidth(Number(value)),
            })),
          },
          {
            id: "resize-depth",
            label: "Depth",
            children: depthOptions.map((value) => ({
              id: `resize-depth-${value}`,
              label: `${value}`,
              onClick: () => handleSetDepth(Number(value)),
            })),
          },
        ],
      },
      {
        id: "reposition",
        label: "Reposition",
        children: [
          { id: "reposition-left", label: "Move left", onClick: () => handleMoveProduct("left") },
          { id: "reposition-right", label: "Move right", onClick: () => handleMoveProduct("right") },
        ],
      },
      {
        id: "color",
        label: "Color",
        children: [
          {
            id: "cabinet-select-color",
            label: "Select Color",
            trailing: <ArrowTopRight color={"#333"} />,
            onClick: handleOpenCabinetColor,
          },
        ],
      },
      ...(canAddAnotherCabinet
        ? [
            {
              id: "add",
              label: "Add",
              trailing: "",
              children: [
                {
                  id: "add-right",
                  label: "Add Cabinet",
                  trailing: <ArrowTopRight color={"#333"} />,
                  onClick: () => handleAddAdditionalProduct(),
                },
              ],
            } as DropdownItem,
          ]
        : []),
      ...(isDrawerCabinet
        ? [
            {
              id: "details",
              label: "Details",
              trailing: "",
              children: [
                {
                  id: "cabinet-style",
                  label: "Cabinet Style",
                  trailing: <ArrowTopRight color={"#333"} />,
                  onClick: handleOpenCabinetStyle,
                },
                {
                  id: "handle-style",
                  label: "Handle Style",
                  trailing: "",
                  children: handleOptions.map((option) => ({
                    id: option.value,
                    label: option.label,
                    trailing: selectedProductConfig?.Handle === option.value ? "✓" : "",
                    disabled: option.disabled,
                    disabledReason: option.reason,
                    onClick: () => handleSetHandleType(option.value),
                  })),
                },
                {
                  id: "accessories",
                  label: "Accessories",
                  trailing: <ArrowTopRight color={"#333"} />,
                  onClick: handleOpenAccessories,
                },
              ],
            } as DropdownItem,
          ]
        : []),
      ...(selectedSceneProduct?.startsWith("Sink-Base-") && sinkBaseCount >= 2
        ? []
        : canDuplicateSelectedCabinet
          ? [{ id: "duplicate", label: "Duplicate", trailing: <DuplicateIcon />, onClick: handleDuplicateProduct }]
          : []),
      ...(isOneOrTwoDrawerProduct
        ? [
            {
              id: "open",
              label: "Open",
              trailing: <OpenMenuIcon />,
              onClick: handleOpenDrawerButtonsForSelectedProduct,
            },
          ]
        : []),
    ];

    if (productIds.length) {
      items.push({ id: "delete", label: "Delete", trailing: <DeleteMenuIcon />, onClick: handleRemoveProducts });
    }

    return items;
  }, [
    handleRemoveProducts,
    handleSetWidth,
    handleSetDepth,
    productIds.length,
    handleMoveProduct,
    handleOpenCabinetStyle,
    handleOpenCabinetColor,
    handleOpenAccessories,
    handleOpenDrawerButtonsForSelectedProduct,
    handleAddFromPrebuilt,
    handleDeleteFromPrebuilt,
    handleAddAdditionalProduct,
    handleDuplicateProduct,
    canAddAnotherCabinet,
    canDuplicateSelectedCabinet,
    widthOptions,
    depthOptions,
    isPrebuilt,
    isDrawerCabinet,
    isOneOrTwoDrawerProduct,
    isSidePanelEntity,
    isTowelBarEntity,
    handleOptions,
    handleSetHandleType,
    selectedProductConfig,
    selectedSceneProduct,
    sinkBaseCount,
  ]);

  const handleCountertopThicknessSelect = useCallback(
    async (thickness: number) => {
      if (!selectedSceneProduct || !thickness) return;
      await saveSnapshot();

      await setConfigBatch({}, { Thickness: thickness });
      dispatch(setActiveCountertopThickness(`${thickness}`));
    },
    [dispatch, saveSnapshot, selectedSceneProduct],
  );

  const handleOpenCountertopColor = useCallback(() => {
    navigate(
      isPrebuilt
        ? "/prebuilt/countertop?accordion=counter-top-color"
        : "/custom/countertop?accordion=counter-top-color",
    );
    setDropdownState((prev) => ({ ...prev, visible: false }));
    setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
  }, [isPrebuilt, navigate]);

  const handleOpenCountertopStyle = useCallback(() => {
    navigate(
      isPrebuilt ? "/prebuilt/countertop?accordion=countertop-style" : "/custom/countertop?accordion=countertop-style",
    );
    setDropdownState((prev) => ({ ...prev, visible: false }));
    setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
  }, [isPrebuilt, navigate]);

  const handleOpenBasinStyle = useCallback(() => {
    navigate(isPrebuilt ? "/prebuilt/countertop?accordion=basin-style" : "/custom/countertop?accordion=basin-style");
    setDropdownState((prev) => ({ ...prev, visible: false }));
    setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
  }, [isPrebuilt, navigate]);

  const countertopPopoverItems: DropdownItem[] = useMemo(() => {
    return [
      {
        id: "countertop-color",
        label: "Color",
        children: [
          {
            id: "countertop-select-color",
            label: "Select Color",
            trailing: <ArrowTopRight color={"#333"} />,
            onClick: handleOpenCountertopColor,
          },
        ],
      },
      {
        id: "countertop-thickness",
        label: "Thickness",
        children: thicknessOptions.map((value) => {
          const label = `${value}"`;
          return {
            id: label,
            label,
            onClick: () => handleCountertopThicknessSelect(value),
          };
        }),
      },
      {
        id: "countertop-style",
        label: "Countertop Style",
        children: [
          {
            id: "countertop-select-style",
            label: "Select Style",
            trailing: <ArrowTopRight color={"#333"} />,
            onClick: handleOpenCountertopStyle,
          },
        ],
      },
      {
        id: "basin-style",
        label: "Basin Style",
        children: [
          {
            id: "basin-select-style",
            label: "Select Style",
            trailing: <ArrowTopRight color={"#333"} />,
            onClick: handleOpenBasinStyle,
          },
        ],
      },
    ];
  }, [
    handleOpenBasinStyle,
    handleOpenCountertopColor,
    handleOpenCountertopStyle,
    handleCountertopThicknessSelect,
    thicknessOptions,
  ]);

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <iframe
        ref={containerRef}
        title="scene"
        id="demo"
        width="100%"
        height="100%"
        src={PLAYCANVAS_SRC}
        style={{
          width: "100%",
          height: "100%",
          flex: "1 1 auto",
          border: "none",
          display: "block",
        }}
      />

      {dropdownState.visible && !isDrawerOpen && !isMobileMenu && (
        <div
          style={{
            position: "absolute",
            top: dropdownState.y,
            left: dropdownState.x,
            pointerEvents: "auto",
            zIndex: 1000,
          }}
        >
          <NestedDropdown items={dropdownItems} />
        </div>
      )}

      {countertopPopoverState.visible && !isDrawerOpen && !isMobileMenu && (
        <div
          ref={countertopPopoverRef}
          style={{
            position: "absolute",
            top: countertopPopoverState.y,
            left: countertopPopoverState.x,
            pointerEvents: "auto",
            zIndex: 1000,
          }}
        >
          <NestedDropdown style={{ width: "200px" }} items={countertopPopoverItems} />
        </div>
      )}

      {isPrebuilt && (
        <CustomizeModePrompt
          isOpening={isCustomizeModePromptOpen}
          setIsOpening={handleCustomizeModePromptOpenChange}
          onConfirm={handleCustomizeFromPrompt}
        />
      )}

      {!isDrawerOpen && isMobileMenu && dropdownState.visible && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1100,
          }}
        >
          <MobileNestedMenu
            key={`mobile-dropdown-${selectedSceneProduct ?? "unknown"}`}
            items={dropdownItems}
            onClose={() => setDropdownState((prev) => ({ ...prev, visible: false }))}
            previewLabel={selectedSceneProduct}
            previewImage={mobilePreviewImage}
            selectedDimensions={selectedDimensions}
          />
        </div>
      )}

      {!isDrawerOpen && isMobileMenu && countertopPopoverState.visible && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1100,
          }}
        >
          <MobileNestedMenu
            key={`mobile-countertop-${countertopPopoverState.entityName ?? "unknown"}`}
            items={countertopPopoverItems}
            onClose={closeCountertopPopover}
            title="Select Countertop Configuration"
            previewLabel={countertopPopoverState.entityName}
            previewImage={mobilePreviewImage}
            selectedDimensions={selectedDimensions}
          />
        </div>
      )}
    </div>
  );
};
