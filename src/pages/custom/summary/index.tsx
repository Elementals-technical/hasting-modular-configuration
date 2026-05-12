import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { setSummarySkuJson, setSummaryTotal } from "@/shared/lib/summarySkuStore";
import { buildInfoTooltip } from "@/shared/lib/buildInfoTooltip";
import { formatBasinStyle } from "@/shared/lib/formatBasinStyle";
import { buildMaterialLookup } from "@/shared/lib/buildMaterialLookup";
import { buildSummaryMaterialElements } from "@/shared/lib/summaryMaterialElements";

import { Hint } from "@/shared/ui/Hint/Hint";
import { EditPenIcon } from "@/shared/assets/images/svg/EditPenIcon";
import { InformationIcon } from "@/shared/assets/images/svg/InformationIcon";
import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight";
import { NestedDropdown, type DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getActiveCabinetType,
  getCabinetColor,
  getCabinetColorSku,
  getCountertopColorSku,
  getVesselColor,
  getCountertopStyle,
  getPlacedDividers,
  getPlacedCabinetStyles,
  getDividersOption,
  getDividersStyle,
  getDrawerPanelFluting,
  getLedOption,
  getFaucetHolesAmount,
  getGrainDirection,
  getBookMatching,
  getHandleGrooveColor,
  getHandleGrooveColorSku,
  getPriceBySku,
  getPriceLoading,
  getHasBootstrappedCabinetBuilder,
  getProductsPresets,
  getSelectedProducts,
  getSelectedDimensions,
  getSelectedProductConfig,
  getSidePanelsOption,
  getSidePanelLeftStatus,
  getSidePanelRightStatus,
  getSinkType,
  getTowelBarColor,
  getTowelBarOption,
} from "@/entities/product/model/store/selectors";
// import { dividersMockData } from "@/pages/custom/accessories/constants";
import dataMaterial from "@/shared/constants/DataMaterial.json";
import {
  SPECIAL_VARIANT_DISPLAY_IMAGE,
  SPECIAL_VARIANT_DISPLAY_VALUE,
  getConfiguratorVariantOverrides,
} from "@/entities/configurator/lib/getConfiguratorVariantOverrides";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import {
  buildProductSku,
  buildCountertopSku,
  buildVesselSku,
  resolveVesselDimensionTokens,
  formatVesselDimensionLabel,
  vesselHeightCmMap,
  buildTowelBarSku,
  TOWEL_BAR_DEFAULTS,
  buildSidePanelSku,
  SIDE_PANEL_WIDTH_CM,
  buildDividerSku,
  buildOpenShelfSku,
  buildOpenSideShelfSku,
  extractColorCode,
  getCountertopMaterialTokensBySku,
  getCountertopMaterialTokensFromBasinType,
  buildCountertopColorSkuCandidates,
  resolveDefaultBasinByCountertopColor,
  resolveCountertopColorSkuFromCandidates,
  resolveCountertopColorCodeFromCandidates,
  resolveCabinetPricingMaterialSku,
  resolveCountertopMaterialSkuFromBasinType,
  resolveCountertopMaterialSkuFromColorCode,
} from "@/shared/lib/sku";
import { useGetConfiguratorQuery, useSaveConfigurationMutation } from "@/entities";
import {
  useGetCountertopDatatableQuery,
  calcTotalCountertopWidthCm,
  formatCountertopThicknessLabel,
} from "@/entities/countertop";
import { buildConfigurationMetadata } from "@/features/saveConfiguration";
import {
  SYNTESI_MATERIAL,
  findSyntesiCountertopUiValue,
  getAllowedVesselMaterialTokens,
  isSyntesiCountertopMaterialSku,
  normalizeMaterialToken,
  parseCountertopMatrix,
  resolveDefaultThicknessFromRules,
} from "@/features/configurator-rule-core/countertop";
import {
  adaptThreekitConfig,
  deriveAutofillMaterials,
  getHasSubmittedCart,
  getIsAutofillEnabled,
  getIsSwatchesEnabledInSummary,
  getManualSelectedMaterials,
  getSelectedMaterials,
  mergeAutofillWithSelectedMaterials,
  resolveSwatchesSummaryState,
  setAutofillEnabled,
  setCartMaterials,
  setSwatchesEnabledInSummary,
  toSwatchPreview,
  MAX_SLOTS as MAX_SWATCHES,
  openSwatchOrder,
} from "@/features/swatchOrder";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { QuotePrintDocument } from "@/features/quotePrint/ui/QuotePrintDocument";
import { printQuote } from "@/features/quotePrint/lib/printQuote";
import { captureQuotePreviewImage } from "@/features/quotePrint/lib/captureQuotePreviewImage";
import { formatQuoteGeneratedDate } from "@/features/quotePrint/lib/formatQuoteGeneratedDate";
import {
  convertSkuToInchesForSummary,
  formatCabinetDimsForSummary,
  formatCabinetDimsForSummaryWithFallback,
  formatCabinetDrawersForSummary,
  formatCabinetTitleForSummary,
  isShelfCabinetType,
} from "@/shared/lib/summaryFormatters";
import {
  normalizeProductConfigSnapshot,
  type NormalizedProductConfigSnapshot,
} from "@/shared/lib/normalizeProductConfigSnapshot";
import { shouldUsePresetProducts } from "@/shared/lib/shouldUsePresetProducts";
import { deriveBookMatchingChargeInfo, type BookMatchingCabinetInput } from "@/shared/lib/bookMatching";

import s from "./SummaryPage.module.scss";

const THREEKIT_PREVIEW_BASE_URL = "https://preview.threekit.com";
const DEFAULT_COUNTERTOP_COLOR = "Cacao Orinoco FF MT";
const DEFAULT_SINK_TYPE = "Top_Tekorlux_Rectangular";
const normalizeCabinetToken = (value: string) => value.toLowerCase().replace(/[\s_]+/g, "-");

const buildImageSrc = (imagePath?: string) => {
  if (!imagePath) return undefined;
  if (imagePath.startsWith("http")) return imagePath;
  if (imagePath.startsWith("/api/")) return `${THREEKIT_PREVIEW_BASE_URL}${imagePath}`;

  return imagePath;
};

// const resolveDividerImage = (selection?: string) => {
//   if (!selection) return undefined;
//   const match = dividersMockData.find((option) => option.title === selection);
//   return match?.metadata?.image;
// };

const formatPrice = (value?: number | null) => {
  if (typeof value !== "number") return "$0";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

const INCLUDED_IN_COUNTERTOP_PRICE_LABEL = "Included in Countertop";

const parsePriceValue = (price?: string): number => {
  if (!price) return 0;
  const normalized = price.replace(/[^0-9,.-]/g, "").trim();
  if (!normalized) return 0;

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const cleaned =
      decimalSeparator === "," ? normalized.replace(/\./g, "").replace(",", ".") : normalized.replace(/,/g, "");
    const value = Number.parseFloat(cleaned);
    return Number.isFinite(value) ? value : 0;
  }

  if (hasComma && !hasDot) {
    const maybeDecimal = /,\d{1,2}$/.test(normalized);
    const cleaned = maybeDecimal ? normalized.replace(",", ".") : normalized.replace(/,/g, "");
    const value = Number.parseFloat(cleaned);
    return Number.isFinite(value) ? value : 0;
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
};

type SummaryItem = {
  id: string;
  title: string;
  subtitle?: string;
  sku?: string;
  swatch?: {
    label: string;
    value: string;
    color: string;
    image?: string;
  };
  price: string;
  priceLabel?: string;
  copyable?: boolean;
  description?: Record<string, unknown>;
  showInfo?: boolean;
};

type SummarySection = {
  id: string;
  title: string;
  items: SummaryItem[];
  copyLabel?: string;
};

/** Readable labels for handle types */
const handleLabelMap: Record<string, string> = {
  handle_urban_topcut: "Upper Groove",
  handle_urban_botcut: "Central Groove",
  handle_pto: "Push to Open",
};

/** Readable labels for drawer configs */
const drawerLabelMap: Record<string, string> = {
  "1D": "1 Drawer",
  "2D": "2 Drawer",
  "1DWID": "1 Drawer with inner drawer",
};

/** Readable labels for material SKU codes */
const materialSkuLabelMap: Record<string, string> = {
  LACG: "Lacquered Gloss",
  LACM: "Lacquered Matt",
  FX: "Fenix",
  HPL: "HPL",
  POR: "Porcelain",
  GLSM: "Glass Matt",
  GLSG: "Glass Gloss",
  SSMMO: "Minermalmaro",
  SSTM: "Tekormud",
  SSOCR: "Ocritech",
  SSTKR: "Tekorlux",
};

/** Readable labels for side panel groove types */
const sidePanelLabelMap: Record<string, string> = {
  NoG: "No Groove",
  UpperG: "Upper Groove",
  CenterG: "Center Groove",
  DoubleG: "Double Groove",
};

const SIDE_PANEL_SUMMARY_DEPTH_MAP: Record<number, number> = {
  46: 45.5,
  50.5: 50,
};

const normalizeSidePanelSummaryDepth = (value: number | null): number | null => {
  if (value === null) return null;
  const rounded = Math.round(value * 10) / 10;
  return SIDE_PANEL_SUMMARY_DEPTH_MAP[rounded] ?? value;
};

export const CustomSummaryPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [quotePreviewImage, setQuotePreviewImage] = useState<string>("");
  const [openEditMenuSectionId, setOpenEditMenuSectionId] = useState<string | null>(null);
  const editMenuRef = useRef<HTMLDivElement | null>(null);
  const lastSavedHashRef = useRef<string | null>(null);
  const editPathBySectionId = useMemo<Record<string, string>>(
    () => ({
      cabinet: "/custom/cabinet-colors",
      "cabinet-options": "/custom/cabinet-colors",
      countertop: "/custom/countertop",
      basin: "/custom/countertop",
      accessories: "/custom/accessories",
      faucet: "/custom/faucet-holes",
    }),
    [],
  );

  const priceBySku = useAppSelector(getPriceBySku);
  const isPriceLoading = useAppSelector(getPriceLoading);
  const productsPresets = useAppSelector(getProductsPresets);
  const hasBootstrappedCabinetBuilder = useAppSelector(getHasBootstrappedCabinetBuilder);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const selectedDimensions = useAppSelector(getSelectedDimensions);

  const selectedProductConfig = useAppSelector(getSelectedProductConfig);

  const activeCabinetType = useAppSelector(getActiveCabinetType);
  const cabinetColor = useAppSelector(getCabinetColor);
  const cabinetColorSku = useAppSelector(getCabinetColorSku);
  const countertopColorSku = useAppSelector(getCountertopColorSku);
  const vesselColor = useAppSelector(getVesselColor);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const handleGrooveColorSku = useAppSelector(getHandleGrooveColorSku);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const countertopThickness = useAppSelector(getActiveCountertopThickness);

  const sinkType = useAppSelector(getSinkType);
  const drawerPanelFluting = useAppSelector(getDrawerPanelFluting);
  const grainDirection = useAppSelector(getGrainDirection);
  const bookMatching = useAppSelector(getBookMatching);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const sidePanelsOption = useAppSelector(getSidePanelsOption);
  const sidePanelLeft = useAppSelector(getSidePanelLeftStatus);
  const sidePanelRight = useAppSelector(getSidePanelRightStatus);
  const placedDividers = useAppSelector(getPlacedDividers);
  const placedCabinetStyles = useAppSelector(getPlacedCabinetStyles);
  const dividersStyle = useAppSelector(getDividersStyle);
  const dividersOption = useAppSelector(getDividersOption);
  const ledOption = useAppSelector(getLedOption);
  const towelBarColor = useAppSelector(getTowelBarColor);
  const towelBarOption = useAppSelector(getTowelBarOption);
  const faucetHolesAmount = useAppSelector(getFaucetHolesAmount);
  const isSwatchesEnabledInSummary = useAppSelector(getIsSwatchesEnabledInSummary);
  const isAutofillEnabled = useAppSelector(getIsAutofillEnabled);
  const manualSelectedMaterials = useAppSelector(getManualSelectedMaterials);
  const selectedMaterials = useAppSelector(getSelectedMaterials);
  const hasSubmittedCart = useAppSelector(getHasSubmittedCart);

  const [productConfigs, setProductConfigs] = useState<NormalizedProductConfigSnapshot[]>([]);
  const [generatedConfigId, setGeneratedConfigId] = useState<string | null>(null);
  const [saveConfiguration] = useSaveConfigurationMutation();

  const handleCopy = (text: string, id: string) => {
    if (!navigator.clipboard) {
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };
  const handleEditSection = useCallback(
    (sectionId: string) => {
      if (sectionId === "swatches") {
        dispatch(openSwatchOrder());
        return;
      }
      if (sectionId === "cabinet") {
        setOpenEditMenuSectionId((current) => (current === sectionId ? null : sectionId));
        return;
      }
      const path = editPathBySectionId[sectionId];
      if (path) navigate(path);
    },
    [dispatch, navigate, editPathBySectionId],
  );

  const handleCabinetEditMenuNavigate = useCallback(
    (path: string) => {
      setOpenEditMenuSectionId(null);
      navigate(path);
    },
    [navigate],
  );

  const cabinetEditMenuItems = useMemo<DropdownItem[]>(
    () => [
      {
        id: "cabinet-builder",
        label: "Cabinet Builder",
        trailing: <ArrowTopRight color="#333" />,
        onClick: () => handleCabinetEditMenuNavigate("/custom/cabinet-builder"),
      },
      {
        id: "color",
        label: "Color",
        trailing: <ArrowTopRight color="#333" />,
        onClick: () => handleCabinetEditMenuNavigate("/custom/cabinet-colors"),
      },
    ],
    [handleCabinetEditMenuNavigate],
  );

  useEffect(() => {
    if (!openEditMenuSectionId) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (editMenuRef.current && !editMenuRef.current.contains(event.target as Node)) {
        setOpenEditMenuSectionId(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenEditMenuSectionId(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openEditMenuSectionId]);

  const resolveItemPrice = useCallback((sku?: string) => (sku ? formatPrice(priceBySku[sku]) : "$0"), [priceBySku]);

  const materialLookup = useMemo(() => {
    return buildMaterialLookup(dataMaterial, [
      {
        value: SPECIAL_VARIANT_DISPLAY_VALUE,
        entry: {
          image: SPECIAL_VARIANT_DISPLAY_IMAGE,
          label: SPECIAL_VARIANT_DISPLAY_VALUE,
        },
      },
    ]);
  }, []);

  const resolveSwatch = useCallback(
    (value: string) => {
      const entry = materialLookup.get(value);
      return {
        color: entry?.hex ?? "#dcdcdc",
        image: buildImageSrc(entry?.image),
        label: entry?.label ?? value,
        value,
      };
    },
    [materialLookup],
  );

  const { data: cabinetColors } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });
  const { data: countertopMatrixData } = useGetCountertopDatatableQuery(438);
  const countertopRules = useMemo(() => parseCountertopMatrix(countertopMatrixData), [countertopMatrixData]);

  const { cabinetColorSkuByName, handleGrooveColorSkuByName, countertopColorSkuCandidatesByValue } = useMemo(() => {
    const groups = cabinetColors?.availableOptions ?? [];
    const buildMapForProxy = (proxyName: string) => {
      const map = new Map<string, string>();
      groups
        .filter((group) => group.proxyName === proxyName)
        .forEach((group) => {
          group.options.forEach((option) => {
            option.variants?.forEach((variant) => {
              if (!variant.enabled) return;
              const meta = (variant.metadata ?? {}) as Record<string, unknown>;
              const overrides = getConfiguratorVariantOverrides({ proxyName, variant });
              const value = overrides.value || (meta.value as string) || variant.name;
              const sku = (meta.sku as string) || "";
              if (value && sku) map.set(value, sku);
            });
          });
        });
      return map;
    };

    return {
      cabinetColorSkuByName: buildMapForProxy("Cabinet Color"),
      handleGrooveColorSkuByName: buildMapForProxy("Handle Groove Color"),
      countertopColorSkuCandidatesByValue: buildCountertopColorSkuCandidates(groups),
    };
  }, [cabinetColors]);

  useEffect(() => {
    let isMounted = true;

    const loadConfigs = async () => {
      if (!selectedProducts.length) {
        if (isMounted) setProductConfigs([]);
        return;
      }

      const configs = await Promise.all(
        selectedProducts.map(async (id) => {
          const config = await getConfig(id);
          return config
            ? normalizeProductConfigSnapshot({
                id,
                raw: config as Record<string, unknown>,
                selectedDimensions,
              })
            : null;
        }),
      );
      const cleaned = configs.filter((config): config is NormalizedProductConfigSnapshot => Boolean(config));
      if (isMounted) setProductConfigs(cleaned);
    };

    loadConfigs();

    return () => {
      isMounted = false;
    };
  }, [selectedDimensions, selectedProducts]);

  useEffect(() => {
    let isMounted = true;

    captureQuotePreviewImage().then((image) => {
      if (!isMounted || !image) return;
      setQuotePreviewImage(image);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("print") !== "1") return;
    let isCancelled = false;

    const timer = window.setTimeout(() => {
      void (async () => {
        const image = await captureQuotePreviewImage();
        if (isCancelled) return;

        if (image) {
          setQuotePreviewImage(image);
        }

        await printQuote({ previewImage: image });
        if (isCancelled) return;

        params.delete("print");
        navigate(
          { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : "" },
          { replace: true },
        );
      })();
    }, 300);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [location.search, location.pathname, navigate]);

  const buildCabinetDescription = useCallback(
    (opts: {
      cabinetType: string | null;
      drawers: string | null;
      handle: string | null;
      pattern: string | null;
      width: number | null;
      height: number | null;
      depth: number | null;
      cabColor: string;
      cabMaterialSku: string | null;
      hdlColor: string;
      hdlMaterialSku: string | null;
    }): Record<string, unknown> => {
      const isShelfCabinet = isShelfCabinetType(opts.cabinetType);
      const elements = buildSummaryMaterialElements([
        {
          productElement: "Cabinet",
          materialSku: opts.cabMaterialSku,
          colorCode: opts.cabColor,
          materialSkuLabelMap,
        },
        {
          productElement: "Handle",
          materialSku: isShelfCabinet ? null : opts.hdlMaterialSku,
          colorCode: opts.hdlColor,
          materialSkuLabelMap,
        },
      ]);
      return {
        "Product Category": "Vanity",
        Products: "Urban Standard",
        "Cabinet Type": opts.cabinetType?.replace(/-/g, " ") ?? "Unknown",
        "Cabinet Style": isShelfCabinet ? null : (opts.drawers ? (drawerLabelMap[opts.drawers] ?? opts.drawers) : "Unknown"),
        "Handle Style": isShelfCabinet ? null : (opts.handle ? (handleLabelMap[opts.handle] ?? opts.handle) : "Unknown"),
        "Drawer Panel Fluting": opts.pattern || "None",
        Width: opts.width,
        Height: opts.height,
        Depth: opts.depth,
        elements,
      };
    },
    [],
  );

  const summarySections: SummarySection[] = useMemo(() => {
    const grainSku = grainDirection === "GrainHorizontal" ? "H" : grainDirection === "GrainVertical" ? "V" : null;
    const resolveCabinetMaterialSku = (swatchValue?: string | null) => {
      const materialSku =
        (swatchValue ? cabinetColorSkuByName.get(swatchValue) : null) ||
        cabinetColorSku ||
        cabinetColorSkuByName.get(cabinetColor) ||
        null;

      return resolveCabinetPricingMaterialSku({
        colorName: swatchValue ?? cabinetColor,
        materialSku,
      });
    };
    const resolveMaterialColorCode = (colorValue: string | null | undefined, materialSku: string | null) =>
      extractColorCode(colorValue, { materialSku });
    const shouldUsePresets = shouldUsePresetProducts({
      productsPresetsCount: productsPresets.length,
      productIdsCount: selectedProducts.length,
      sceneConfigsCount: productConfigs.length,
      hasBootstrappedCabinetBuilder,
    });
    const sceneProductConfigs = shouldUsePresets ? productConfigs.slice(productsPresets.length) : productConfigs;
    const orderedProductIds = getOrderedProductIds(selectedProducts);
    const productOrder = new Map((orderedProductIds.length ? orderedProductIds : selectedProducts).map((id, index) => [id, index]));
    const sortBySceneOrder = (
      left: NormalizedProductConfigSnapshot,
      right: NormalizedProductConfigSnapshot,
    ) =>
      (productOrder.get(left.id) ?? productOrder.get(left._productId) ?? Number.MAX_SAFE_INTEGER) -
      (productOrder.get(right.id) ?? productOrder.get(right._productId) ?? Number.MAX_SAFE_INTEGER);
    const sceneProductConfigsInSceneOrder = [...sceneProductConfigs].sort(sortBySceneOrder);
    const cabinetConfigs = sceneProductConfigs.filter((config) => config.category === "cabinets");
    const cabinetCount = shouldUsePresets
      ? productsPresets.length + cabinetConfigs.length
      : cabinetConfigs.length > 0
        ? cabinetConfigs.length
        : 1;
    const resolveNameFromRaw = (v: string) => {
      const lastDash = v.lastIndexOf("-");
      if (lastDash > 0 && v.slice(lastDash + 1).length >= 6) return v.slice(0, lastDash);
      return v;
    };
    const isSinkBaseName = (value: string | null | undefined) => {
      if (!value) return false;
      const normalized = normalizeCabinetToken(value);
      return normalized.includes("sink-base") || normalized.includes("sinkbase");
    };
    const sinkBaseCountForHcut = Math.max(
      1,
      cabinetConfigs.length > 0
        ? cabinetConfigs.filter((config) => {
            const rawName =
              typeof config.ProductType === "string"
                ? config.ProductType
                : typeof config.productType === "string"
                  ? config.productType
                  : typeof config.entityName === "string"
                    ? resolveNameFromRaw(config.entityName)
                    : typeof config._productId === "string"
                      ? resolveNameFromRaw(config._productId)
                      : typeof config.name === "string"
                        ? config.name
                        : null;
            return isSinkBaseName(rawName);
          }).length
        : productsPresets.length > 0
          ? productsPresets.filter((preset) => isSinkBaseName(preset.name ?? null)).length
          : isSinkBaseName(
                typeof selectedProductConfig?.name === "string"
                  ? selectedProductConfig.name
                  : typeof activeCabinetType === "string"
                    ? activeCabinetType
                    : null,
              )
            ? 1
            : 0,
    );
    const configCabinetItems = cabinetConfigs.map((config, index) => {
      const width = typeof config.Width === "number" ? config.Width : undefined;
      const depth = typeof config.Depth === "number" ? config.Depth : undefined;
      const height = typeof config.Height === "number" ? config.Height : undefined;
      const drawers = formatCabinetDrawersForSummary(config.Drawers);
      const dims = formatCabinetDimsForSummary(width, depth, height);
      const subtitle = [drawers, dims].filter(Boolean).join(" | ");
      const name =
        config.ProductType ??
        config.productType ??
        (config.entityName ? resolveNameFromRaw(config.entityName) : undefined) ??
        config.name ??
        undefined;
      const swatchValue =
        typeof config.CabinetColor === "string" && config.CabinetColor ? config.CabinetColor : cabinetColor;
      const swatch = resolveSwatch(swatchValue);

      const productCabinetType = name ?? activeCabinetType;
      const normalizedName = normalizeCabinetToken(productCabinetType ?? "");
      const cabinetMaterialSku = resolveCabinetMaterialSku(swatchValue);

      const handleMaterialSku = handleGrooveColorSku || handleGrooveColorSkuByName.get(handleGrooveColor) || null;

      let sku: string;
      if (normalizedName.includes("open-shelf") || normalizedName.includes("openshelf")) {
        sku = buildOpenShelfSku({
          width: width ?? null,
          height: height ?? null,
          depth: depth ?? null,
          cabinetMaterialSku: cabinetMaterialSku,
          cabinetColorCode: resolveMaterialColorCode(swatchValue, cabinetMaterialSku),
          grainDirection: grainSku,
        });
      } else if (normalizedName.includes("side-shelf") || normalizedName.includes("sideshelf")) {
        const side: "L" | "R" = index === 0 ? "L" : "R";
        sku = buildOpenSideShelfSku({
          side,
          width: width ?? null,
          height: height ?? null,
          depth: depth ?? null,
          cabinetMaterialSku: cabinetMaterialSku,
          cabinetColorCode: resolveMaterialColorCode(swatchValue, cabinetMaterialSku),
          grainDirection: grainSku,
        });
      } else {
        sku = buildProductSku({
          cabinetType: productCabinetType ? productCabinetType.replace(/[\s_]+/g, "-") : productCabinetType,
          drawers: typeof config.Drawers === "string" ? config.Drawers : null,
          handle: typeof config.Handle === "string" ? config.Handle : null,
          pattern: drawerPanelFluting || null,
          width: width ?? null,
          height: height ?? null,
          depth: depth ?? null,
          cab: cabinetMaterialSku
            ? {
                materialSku: cabinetMaterialSku,
                colorCode: resolveMaterialColorCode(swatchValue, cabinetMaterialSku),
                grainDirection: grainSku,
              }
            : null,
          hdl: handleMaterialSku
            ? { materialSku: handleMaterialSku, colorCode: resolveMaterialColorCode(handleGrooveColor, handleMaterialSku) }
            : null,
          msp: null,
          bkpl: null,
        });
      }

      return {
        id: `cabinet-config-${index}`,
        title: formatCabinetTitleForSummary(name ?? activeCabinetType),
        subtitle,
        sku,
        swatch: {
          label: "Cabinet",
          value: swatch.value,
          color: swatch.color,
          image: swatch.image,
        },
        price: resolveItemPrice(sku),
        copyable: true,
        showInfo: true,
        description: buildCabinetDescription({
          cabinetType: productCabinetType,
          drawers: typeof config.Drawers === "string" ? config.Drawers : null,
          handle: typeof config.Handle === "string" ? config.Handle : null,
          pattern: drawerPanelFluting || null,
          width: width ?? null,
          height: height ?? null,
          depth: depth ?? null,
          cabColor: swatchValue,
          cabMaterialSku: cabinetMaterialSku,
          hdlColor: handleGrooveColor,
          hdlMaterialSku: handleGrooveColorSku || handleGrooveColorSkuByName.get(handleGrooveColor) || null,
        }),
      };
    });
    const presetCabinetItems = shouldUsePresets
      ? productsPresets.map((preset, index) => {
          const drawers = formatCabinetDrawersForSummary(preset.Drawers);
          const presetHeight = selectedDimensions.height ?? preset.Height ?? undefined;
          const presetDepth = selectedDimensions.depth ?? preset.Depth ?? undefined;
          const dims = formatCabinetDimsForSummary(preset.Width, presetDepth, presetHeight);
          const subtitle = [drawers, dims].filter(Boolean).join(" | ");
          const swatchValue = preset.CabinetColor ?? cabinetColor;
          const swatch = resolveSwatch(swatchValue);
          const cabinetMaterialSku = resolveCabinetMaterialSku(swatchValue);

          const handleMaterialSku = handleGrooveColorSku || handleGrooveColorSkuByName.get(handleGrooveColor) || null;
          const normalizedPresetName = normalizeCabinetToken(preset.name ?? "");
          const normalizedPresetType = preset.name ? preset.name.replace(/[\s_]+/g, "-") : null;
          const resolvedHandle = (selectedProductConfig?.Handle as string | undefined) || preset.Handle || null;

          let sku: string;
          if (normalizedPresetName.includes("open-shelf") || normalizedPresetName.includes("openshelf")) {
            sku = buildOpenShelfSku({
              width: preset.Width ?? null,
              height: preset.Height ?? null,
              depth: preset.Depth ?? null,
              cabinetMaterialSku: cabinetMaterialSku,
              cabinetColorCode: resolveMaterialColorCode(swatchValue, cabinetMaterialSku),
              grainDirection: grainSku,
            });
          } else if (normalizedPresetName.includes("side-shelf") || normalizedPresetName.includes("sideshelf")) {
            const side: "L" | "R" = index === 0 ? "L" : "R";
            sku = buildOpenSideShelfSku({
              side,
              width: preset.Width ?? null,
              height: preset.Height ?? null,
              depth: preset.Depth ?? null,
              cabinetMaterialSku: cabinetMaterialSku,
              cabinetColorCode: resolveMaterialColorCode(swatchValue, cabinetMaterialSku),
              grainDirection: grainSku,
            });
          } else {
            sku = buildProductSku({
              cabinetType: normalizedPresetType ?? activeCabinetType,
              drawers: preset.Drawers ?? null,
              handle: resolvedHandle,
              pattern: drawerPanelFluting || null,
              width: preset.Width ?? null,
              height: presetHeight ?? null,
              depth: presetDepth ?? null,
              cab: cabinetMaterialSku
                ? {
                    materialSku: cabinetMaterialSku,
                    colorCode: resolveMaterialColorCode(swatchValue, cabinetMaterialSku),
                    grainDirection: grainSku,
                  }
                : null,
              hdl: handleMaterialSku
                ? { materialSku: handleMaterialSku, colorCode: resolveMaterialColorCode(handleGrooveColor, handleMaterialSku) }
                : null,
              msp: null,
              bkpl: null,
            });
          }

          return {
            id: `cabinet-preset-${index}`,
            title: formatCabinetTitleForSummary(preset.name ?? activeCabinetType),
            subtitle,
            sku,
            swatch: {
              label: "Cabinet",
              value: swatch.value,
              color: swatch.color,
              image: swatch.image,
            },
            price: resolveItemPrice(sku),
            copyable: true,
            showInfo: true,
            description: buildCabinetDescription({
              cabinetType: normalizedPresetType ?? activeCabinetType,
              drawers: preset.Drawers ?? null,
              handle: resolvedHandle,
              pattern: drawerPanelFluting || null,
              width: preset.Width ?? null,
              height: presetHeight ?? null,
              depth: presetDepth ?? null,
              cabColor: swatchValue,
              cabMaterialSku: cabinetMaterialSku,
              hdlColor: handleGrooveColor,
              hdlMaterialSku: handleMaterialSku,
            }),
          };
        })
      : [];
    const fallbackCabinetItems: SummaryItem[] = [
      (() => {
        const handleMaterialSku = handleGrooveColorSku || handleGrooveColorSkuByName.get(handleGrooveColor) || null;
        const cabinetMaterialSku = resolveCabinetMaterialSku(cabinetColor);

        const sku = buildProductSku({
          cabinetType: activeCabinetType,
          drawers: typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : null,
          handle: typeof selectedProductConfig?.Handle === "string" ? selectedProductConfig.Handle : null,
          pattern: drawerPanelFluting || null,
          width: selectedDimensions.width,
          height: selectedDimensions.height,
          depth: selectedDimensions.depth,
          cab: cabinetMaterialSku
            ? {
                materialSku: cabinetMaterialSku,
                colorCode: resolveMaterialColorCode(cabinetColor, cabinetMaterialSku),
                grainDirection: grainSku,
              }
            : null,
          hdl: handleMaterialSku
            ? { materialSku: handleMaterialSku, colorCode: resolveMaterialColorCode(handleGrooveColor, handleMaterialSku) }
            : null,
          msp: null,
          bkpl: null,
        });

        return {
          id: "cabinet-1",
          title:
            typeof selectedProductConfig?.name === "string"
              ? formatCabinetTitleForSummary(selectedProductConfig.name)
              : formatCabinetTitleForSummary(activeCabinetType),
          subtitle: [
            formatCabinetDrawersForSummary(selectedProductConfig?.Drawers),
            formatCabinetDimsForSummaryWithFallback(
              selectedDimensions.width,
              selectedDimensions.depth,
              selectedDimensions.height,
            ),
          ]
            .filter(Boolean)
            .join(" | "),
          sku,
          swatch: {
            ...resolveSwatch(cabinetColor),
            label: "Cabinet",
            value: cabinetColor,
          },
          price: resolveItemPrice(sku),
          copyable: true,
          showInfo: true,
          description: buildCabinetDescription({
            cabinetType: activeCabinetType,
            drawers: typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : null,
            handle: typeof selectedProductConfig?.Handle === "string" ? selectedProductConfig.Handle : null,
            pattern: drawerPanelFluting || null,
            width: selectedDimensions.width,
            height: selectedDimensions.height,
            depth: selectedDimensions.depth,
            cabColor: cabinetColor,
            cabMaterialSku: cabinetMaterialSku,
            hdlColor: handleGrooveColor,
            hdlMaterialSku: handleMaterialSku,
          }),
        };
      })(),
    ];
    const cabinetItems = shouldUsePresets
      ? [...presetCabinetItems, ...configCabinetItems]
      : configCabinetItems.length > 0
        ? configCabinetItems
        : fallbackCabinetItems;
    const selectedProductDrawerStyle =
      typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : null;
    const getPlacedDrawerStyle = (id?: string | null) => (id ? (placedCabinetStyles[id] ?? null) : null);
    const getConfigDrawerStyle = (config: NormalizedProductConfigSnapshot) =>
      config.Drawers ??
      getPlacedDrawerStyle(config.id) ??
      getPlacedDrawerStyle(config._productId) ??
      selectedProductDrawerStyle;
    const configToBookMatchingCabinet = (config: NormalizedProductConfigSnapshot): BookMatchingCabinetInput => ({
      name:
        typeof config.ProductType === "string"
          ? config.ProductType
          : typeof config.productType === "string"
            ? config.productType
            : typeof config.entityName === "string"
              ? resolveNameFromRaw(config.entityName)
              : typeof config._productId === "string"
                ? resolveNameFromRaw(config._productId)
                : typeof config.name === "string"
                  ? config.name
                  : null,
      drawers: getConfigDrawerStyle(config),
    });
    const bookMatchingCabinets: BookMatchingCabinetInput[] = shouldUsePresets
      ? [
          ...productsPresets.map((preset) => ({
            name: preset.name,
            drawers: preset.Drawers ?? null,
          })),
          ...sceneProductConfigsInSceneOrder.map(configToBookMatchingCabinet),
        ]
      : sceneProductConfigsInSceneOrder.length > 0
        ? sceneProductConfigsInSceneOrder.map(configToBookMatchingCabinet)
        : [
            {
              name:
                typeof selectedProductConfig?.name === "string"
                  ? selectedProductConfig.name
                  : typeof activeCabinetType === "string"
                    ? activeCabinetType
                    : null,
              drawers: typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : null,
            },
          ];

    // const grooveSwatch = resolveSwatch(handleGrooveColor);
    const firstPreset = productsPresets[0];
    const firstSceneCabinetConfig = cabinetConfigs[0];
    const sceneCountertopColor =
      firstSceneCabinetConfig && typeof firstSceneCabinetConfig.CountertopColor === "string"
        ? firstSceneCabinetConfig.CountertopColor
        : null;
    const sceneSinkType =
      firstSceneCabinetConfig && typeof firstSceneCabinetConfig.sinkType === "string"
        ? firstSceneCabinetConfig.sinkType
        : null;
    const shouldUsePresetCountertopColor =
      countertopColor === DEFAULT_COUNTERTOP_COLOR && Boolean(firstPreset?.CountertopColor);
    const shouldUsePresetSinkType = sinkType === DEFAULT_SINK_TYPE && Boolean(firstPreset?.sinkType);
    const resolvedCountertopColor =
      sceneCountertopColor ??
      (shouldUsePresetCountertopColor ? (firstPreset?.CountertopColor ?? null) : null) ??
      countertopColor;
    const colorDrivenDefaultBasin = resolveDefaultBasinByCountertopColor(resolvedCountertopColor);
    const resolvedSinkType =
      sceneSinkType ??
      (shouldUsePresetSinkType && colorDrivenDefaultBasin
        ? colorDrivenDefaultBasin
        : shouldUsePresetSinkType
          ? (firstPreset?.sinkType ?? null)
          : null) ??
      sinkType;
    const sinkBaseEntries = shouldUsePresets
      ? [
          ...productsPresets
            .filter((preset) => isSinkBaseName(preset.name ?? null))
            .map((preset, index) => ({
              id: `preset-${index}`,
              sinkType: shouldUsePresetSinkType ? (preset.sinkType ?? resolvedSinkType) : resolvedSinkType,
            })),
          ...cabinetConfigs.flatMap((config, index) => {
            const rawName =
              typeof config.ProductType === "string"
                ? config.ProductType
                : typeof config.productType === "string"
                  ? config.productType
                  : typeof config.entityName === "string"
                    ? resolveNameFromRaw(config.entityName)
                    : typeof config._productId === "string"
                      ? resolveNameFromRaw(config._productId)
                      : typeof config.name === "string"
                        ? config.name
                        : null;
            if (!isSinkBaseName(rawName)) return [];
            return [
              {
                id: `config-${index}`,
                sinkType: typeof config.sinkType === "string" ? config.sinkType : resolvedSinkType,
              },
            ];
          }),
        ]
      : cabinetConfigs.length > 0
        ? cabinetConfigs.flatMap((config, index) => {
            const rawName =
              typeof config.ProductType === "string"
                ? config.ProductType
                : typeof config.productType === "string"
                  ? config.productType
                  : typeof config.entityName === "string"
                    ? resolveNameFromRaw(config.entityName)
                    : typeof config._productId === "string"
                      ? resolveNameFromRaw(config._productId)
                      : typeof config.name === "string"
                        ? config.name
                        : null;
            if (!isSinkBaseName(rawName)) return [];
            return [
              {
                id: `config-${index}`,
                sinkType: typeof config.sinkType === "string" ? config.sinkType : resolvedSinkType,
              },
            ];
          })
        : isSinkBaseName(
              typeof selectedProductConfig?.name === "string"
                ? selectedProductConfig.name
                : typeof activeCabinetType === "string"
                  ? activeCabinetType
                  : null,
            )
          ? [{ id: "fallback-0", sinkType: resolvedSinkType }]
          : [];
    const preferredCountertopMaterialTokens = [
      ...getCountertopMaterialTokensBySku(countertopColorSku),
      ...getCountertopMaterialTokensFromBasinType(resolvedSinkType),
    ];
    const resolvedCountertopMaterialSku =
      countertopColorSku ||
      resolveCountertopColorSkuFromCandidates({
        value: resolvedCountertopColor,
        candidatesByValue: countertopColorSkuCandidatesByValue,
        preferredMaterialTokens: preferredCountertopMaterialTokens,
      }) ||
      resolveCountertopColorSkuFromCandidates({
        value: countertopColor,
        candidatesByValue: countertopColorSkuCandidatesByValue,
        preferredMaterialTokens: preferredCountertopMaterialTokens,
      }) ||
      resolveCountertopMaterialSkuFromBasinType(resolvedSinkType) ||
      null;
    const isSyntesiCountertop =
      isSyntesiCountertopMaterialSku(resolvedCountertopMaterialSku) ||
      normalizeMaterialToken(resolvedSinkType ?? "").includes("syntesi");
    const displayCountertopColor = isSyntesiCountertop
      ? (findSyntesiCountertopUiValue(countertopColor) ??
        findSyntesiCountertopUiValue(resolvedCountertopColor) ??
        resolvedCountertopColor)
      : resolvedCountertopColor;
    const displayCountertopLabel = isSyntesiCountertop ? `${SYNTESI_MATERIAL} Countertop` : "Countertop";
    const displayCountertopMaterial = isSyntesiCountertop
      ? SYNTESI_MATERIAL
      : resolvedCountertopMaterialSku
        ? (materialSkuLabelMap[resolvedCountertopMaterialSku] ?? resolvedCountertopMaterialSku)
        : null;
    const resolvedVesselColor = vesselColor;
    const vesselTypeForTokens = resolvedSinkType?.startsWith("Vessel_") ? resolvedSinkType : null;
    const allowedVesselMaterialTokens = vesselTypeForTokens
      ? Array.from(getAllowedVesselMaterialTokens(vesselTypeForTokens) ?? [])
      : [];
    const vesselPreferredMaterialTokens =
      allowedVesselMaterialTokens.length > 0
        ? allowedVesselMaterialTokens
        : [
            ...getCountertopMaterialTokensBySku(resolvedCountertopMaterialSku),
            ...preferredCountertopMaterialTokens,
          ];
    const resolvedVesselColorCode = resolvedVesselColor
      ? resolveCountertopColorCodeFromCandidates({
          value: resolvedVesselColor,
          candidatesByValue: countertopColorSkuCandidatesByValue,
          preferredMaterialTokens: vesselPreferredMaterialTokens,
        })
      : null;
    const resolvedVesselMaterialSku = resolvedVesselColor
      ? resolveCountertopMaterialSkuFromColorCode(resolvedVesselColorCode) ??
        resolveCountertopColorSkuFromCandidates({
          value: resolvedVesselColor,
          candidatesByValue: countertopColorSkuCandidatesByValue,
          preferredMaterialTokens: vesselPreferredMaterialTokens,
        })
      : null;
    const effectiveCountertopColorCode = extractColorCode(displayCountertopColor);
    const effectiveCountertopMaterialSku =
      resolveCountertopMaterialSkuFromColorCode(effectiveCountertopColorCode) ?? resolvedCountertopMaterialSku;
    const isVesselCountertop = (countertopStyle || "").trim().toLowerCase() === "vessel";
    const materialForThicknessRules =
      resolvedCountertopMaterialSku || resolveCountertopMaterialSkuFromBasinType(resolvedSinkType);
    const matrixDefaultThickness = resolveDefaultThicknessFromRules({
      rules: countertopRules,
      activeMaterialTokens: materialForThicknessRules ? [normalizeMaterialToken(materialForThicknessRules)] : [],
      width:
        selectedDimensions.width ??
        (productsPresets.length > 0 ? (productsPresets[0]?.Width ?? null) : null) ??
        (firstSceneCabinetConfig && typeof firstSceneCabinetConfig.Width === "number"
          ? firstSceneCabinetConfig.Width
          : null),
      depth:
        selectedDimensions.depth ??
        (productsPresets.length > 0 ? (productsPresets[0]?.Depth ?? null) : null) ??
        (firstSceneCabinetConfig && typeof firstSceneCabinetConfig.Depth === "number"
          ? firstSceneCabinetConfig.Depth
          : null),
      activeCountertopStyle: countertopStyle || null,
    });
    const resolvedCountertopThickness =
      countertopThickness ||
      (firstSceneCabinetConfig && typeof firstSceneCabinetConfig.Thickness === "string"
        ? firstSceneCabinetConfig.Thickness
        : null) ||
      matrixDefaultThickness;
    const displayCountertopThickness = formatCountertopThicknessLabel(resolvedCountertopThickness);
    const countertopSwatch = resolveSwatch(displayCountertopColor);
    const vesselSwatch = resolvedVesselColor ? resolveSwatch(resolvedVesselColor) : null;
    const displayVesselMaterial = resolvedVesselMaterialSku
      ? (materialSkuLabelMap[resolvedVesselMaterialSku] ?? resolvedVesselMaterialSku)
      : null;

    const bookMatchingInfo = deriveBookMatchingChargeInfo({
      grainDirection,
      bookMatching,
      materialSku: resolveCabinetMaterialSku(cabinetColor),
      cabinets: bookMatchingCabinets,
    });

    const bookMatchingItem: SummaryItem | null =
      bookMatchingInfo.applies && bookMatchingInfo.sku
        ? (() => {
            const unitPrice = priceBySku[bookMatchingInfo.sku] ?? 0;
            return {
              id: "cabinet-option-book-matching",
              title: "Book Matching",
              subtitle: bookMatchingInfo.direction === "H" ? "Horizontal" : "Vertical",
              sku: bookMatchingInfo.sku,
              price: formatPrice(unitPrice * bookMatchingInfo.drawerQty),
              copyable: true,
              description: {
                "Product Category": "Book Matching",
                Direction: bookMatchingInfo.direction === "H" ? "Horizontal" : "Vertical",
                Drawers: bookMatchingInfo.drawerQty,
              },
            };
          })()
        : null;

    const cabinetOptionItems: SummaryItem[] = [
      drawerPanelFluting
        ? {
            id: "cabinet-option-drawer-panel",
            title: "Drawer Panel Fluting",
            subtitle: drawerPanelFluting,
          }
        : null,
      grainDirection
        ? {
            id: "cabinet-option-grain-direction",
            title: "Grain Direction",
            subtitle: grainDirection,
          }
        : null,
      bookMatchingItem,
    ].filter(Boolean) as SummaryItem[];

    // TODO(architecture): productsPresets[*].Width is a frozen snapshot from
    // prebuilt→custom transition; it does NOT reflect user resizes in custom
    // mode. Any aggregate computed from presets can diverge from actual scene
    // widths after resize. Prefer live scene (getConfig per productId) or
    // selectedDimensions. See slice.ts setSelectedDimensions note.
    const cabinetWidthSum = shouldUsePresets
      ? productsPresets.reduce((sum, p) => sum + (p.Width ?? 0), 0) +
          cabinetConfigs.reduce((sum, c) => sum + (typeof c.Width === "number" ? c.Width : 0), 0)
      : cabinetConfigs.length > 0
        ? cabinetConfigs.reduce((sum, c) => sum + (typeof c.Width === "number" ? c.Width : 0), 0)
        : (selectedDimensions.width ?? 0);
    const totalCountertopWidth = calcTotalCountertopWidthCm(cabinetWidthSum, sidePanelLeft, sidePanelRight);

    const countertopSkuLines = buildCountertopSku({
      style: countertopStyle || null,
      width: totalCountertopWidth,
      depth: selectedDimensions.depth,
      thickness: resolvedCountertopThickness,
      basinType: resolvedSinkType || null,
      faucetHolesAmount: faucetHolesAmount || null,
      countertopMaterialSku: effectiveCountertopMaterialSku,
      countertopColorCode: effectiveCountertopColorCode,
    });
    const vesselType = resolvedSinkType?.startsWith("Vessel_") ? resolvedSinkType : null;
    const vesselSku = vesselType
      ? buildVesselSku({
          vesselType,
          width: totalCountertopWidth,
          height: vesselHeightCmMap[vesselType] ?? null,
          depth: selectedDimensions.depth,
          materialSku: resolvedVesselMaterialSku,
          colorCode: resolvedVesselColorCode,
        })
      : null;
    const vesselDimensionTokens = vesselType
      ? resolveVesselDimensionTokens({
          vesselType,
          width: totalCountertopWidth,
          height: vesselHeightCmMap[vesselType] ?? null,
          depth: selectedDimensions.depth,
        })
      : null;
    const basinStyleLabel = formatBasinStyle(resolvedSinkType);

    const basinLabel = isVesselCountertop ? "Vessel Cutout" : "Basin";
    const countertopSkuLabels = ["Countertop", basinLabel, "Faucet Holes", "Hole Cutout"];

    const extraCountertopItems = countertopSkuLines.slice(1).flatMap((line, i) => {
      const lineTitle = countertopSkuLabels[i + 1] ?? "Countertop Element";
      const isBasinLine = lineTitle === basinLabel;
      const isVesselCutoutLine = lineTitle === "Vessel Cutout";
      const isIntegratedBasinLine = lineTitle === "Basin";
      const priceLabel =
        isIntegratedBasinLine && isSyntesiCountertop ? INCLUDED_IN_COUNTERTOP_PRICE_LABEL : undefined;
      const optionSubtitle = isBasinLine
        ? (basinStyleLabel ?? undefined)
        : lineTitle === "Hole Cutout"
          ? basinStyleLabel
            ? `Cutout for ${basinStyleLabel}`
            : "Cutout"
          : undefined;
      if (isIntegratedBasinLine && sinkBaseEntries.length > 0) {
        return sinkBaseEntries.map((entry, index) => {
          const basinLine =
            buildCountertopSku({
              style: countertopStyle || null,
              width: totalCountertopWidth,
              depth: selectedDimensions.depth,
              thickness: resolvedCountertopThickness,
              basinType: entry.sinkType || null,
              faucetHolesAmount: faucetHolesAmount || null,
              countertopMaterialSku: effectiveCountertopMaterialSku,
              countertopColorCode: effectiveCountertopColorCode,
            })[1] ?? line;
          const entryBasinStyleLabel = formatBasinStyle(entry.sinkType);
          return {
            id: `countertop-sku-${i + 1}-${entry.id}-${index}`,
            title: lineTitle,
            subtitle: entryBasinStyleLabel ?? undefined,
            sku: basinLine,
            price: priceLabel ? "$0" : resolveItemPrice(basinLine),
            priceLabel,
            copyable: true,
            showInfo: true,
            description: {
              "Product Category": lineTitle,
              ...(entry.sinkType ? { "Basin Style": entryBasinStyleLabel } : {}),
            },
          };
        });
      }
      const itemCount = lineTitle === "Basin" || isVesselCutoutLine ? sinkBaseCountForHcut : 1;
      const linePrice = priceLabel ? "$0" : resolveItemPrice(line);

      return Array.from({ length: itemCount }, (_, index) => ({
        id: `countertop-sku-${i + 1}-${index}`,
        title: lineTitle,
        subtitle: optionSubtitle,
        sku: line,
        price: linePrice,
        priceLabel,
        copyable: true,
        showInfo: isBasinLine || isVesselCutoutLine,
        description: {
          ...(isVesselCutoutLine ? { Countertop: lineTitle } : { "Product Category": lineTitle }),
          ...(isBasinLine && resolvedSinkType ? { "Basin Style": formatBasinStyle(resolvedSinkType) } : {}),
          ...(isVesselCutoutLine && resolvedSinkType ? { "Basin Style": formatBasinStyle(resolvedSinkType) } : {}),
        },
      }));
    });

    const countertopItems: SummaryItem[] = [
      // Main countertop item with swatch
      {
        id: "countertop-1",
        title: "Countertop",
        subtitle: displayCountertopThickness ?? undefined,
        sku: countertopSkuLines[0],
        swatch: {
          label: displayCountertopLabel,
          value: displayCountertopColor,
          color: countertopSwatch.color,
          image: countertopSwatch.image,
        },
        price: resolveItemPrice(countertopSkuLines[0]),
        copyable: true,
        showInfo: true,
        description: {
          "Product Category": "Countertop",
          Style: countertopStyle || "Plain",
          Width: totalCountertopWidth,
          Thickness: displayCountertopThickness,
          Depth: selectedDimensions.depth,
          Material: displayCountertopMaterial,
          "Color Code": displayCountertopColor,
        },
      },
      countertopStyle
        ? {
            id: "countertop-style",
            title: "Countertop Style",
            subtitle: countertopStyle,
          }
        : null,
      ...extraCountertopItems.filter((item) => item.title !== "Faucet Holes"),
    ].filter(Boolean) as SummaryItem[];

    const typeToStyleMap: Record<string, string> = { A: "Option A", B: "Option B", C: "Option C" };

    const dividerItems: SummaryItem[] = (() => {
      if (placedDividers.length > 0) {
        return placedDividers.map((divider, index) => {
          const style = typeToStyleMap[divider.type];
          const sku = style ? buildDividerSku({ dividerStyle: style }) : null;
          const unitPrice = sku ? (priceBySku[sku] ?? 0) : 0;
          return {
            id: `accessories-dividers-${divider.key}-${index}`,
            title: "Dividers",
            subtitle: style ?? undefined,
            sku: sku ?? undefined,
            price: formatPrice(unitPrice),
            copyable: !!sku,
            showInfo: true,
            description: { "Product Category": "Divider", "Divider Style": style },
          };
        });
      }

      // Fallback: style selected but no individual dividers placed — one per cabinet
      if (dividersStyle && dividersStyle !== "None") {
        const sku = buildDividerSku({ dividerStyle: dividersStyle });
        if (!sku) return [];
        const unitPrice = priceBySku[sku] ?? 0;
        return Array.from({ length: cabinetCount }, (_, index) => ({
          id: `accessories-dividers-style-${index}`,
          title: "Dividers",
          subtitle: dividersStyle,
          sku,
          price: formatPrice(unitPrice),
          copyable: true,
          showInfo: true,
          description: { "Product Category": "Divider", "Divider Style": dividersStyle },
        }));
      }

      return [];
    })();

    // Towel bar full product SKUs
    const towelMaterialSku = "LACM";
    const hasTowel = towelBarOption && towelBarOption !== "None";
    const hasRight = towelBarOption === "Right" || towelBarOption === "Both";
    const hasLeft = towelBarOption === "Left" || towelBarOption === "Both";

    const towelBarRightSku =
      hasTowel && hasRight
        ? buildTowelBarSku({
            side: "R",
            width: TOWEL_BAR_DEFAULTS.width,
            height: TOWEL_BAR_DEFAULTS.height,
            depth: TOWEL_BAR_DEFAULTS.depth,
            materialSku: towelMaterialSku,
            colorCode: towelBarColor || null,
          })
        : null;

    const towelBarLeftSku =
      hasTowel && hasLeft
        ? buildTowelBarSku({
            side: "L",
            width: TOWEL_BAR_DEFAULTS.width,
            height: TOWEL_BAR_DEFAULTS.height,
            depth: TOWEL_BAR_DEFAULTS.depth,
            materialSku: towelMaterialSku,
            colorCode: towelBarColor || null,
          })
        : null;

    // Side panel SKUs — one line item per active side (single-panel pricing)
    const sidePanelSkuItems: SummaryItem[] = [];
    if (sidePanelsOption && sidePanelsOption !== "None") {
      const dims =
        cabinetConfigs.length > 0
          ? {
              height: typeof cabinetConfigs[0].Height === "number" ? cabinetConfigs[0].Height : null,
              depth: typeof cabinetConfigs[0].Depth === "number" ? cabinetConfigs[0].Depth : null,
            }
          : productsPresets.length > 0
            ? { height: productsPresets[0].Height ?? null, depth: productsPresets[0].Depth ?? null }
            : { height: selectedDimensions.height, depth: selectedDimensions.depth };

      const handleMaterialSku = handleGrooveColorSku || handleGrooveColorSkuByName.get(handleGrooveColor) || null;
      const sidePanelCabinetMaterialSku = resolveCabinetMaterialSku();
      const spSku = buildSidePanelSku({
        panelType: sidePanelsOption,
        width: SIDE_PANEL_WIDTH_CM,
        height: dims.height,
        depth: dims.depth,
        cabMaterialSku: sidePanelCabinetMaterialSku,
        cabColorCode: resolveMaterialColorCode(cabinetColor, sidePanelCabinetMaterialSku),
        hdlMaterialSku: handleMaterialSku,
        hdlColorCode: resolveMaterialColorCode(handleGrooveColor, handleMaterialSku),
      });
      const sidePanelMaterialElements = buildSummaryMaterialElements([
        {
          productElement: "Cabinet",
          materialSku: sidePanelCabinetMaterialSku,
          colorCode: cabinetColor,
          materialSkuLabelMap,
        },
        {
          productElement: "Handle",
          materialSku: handleMaterialSku,
          colorCode: handleGrooveColor,
          materialSkuLabelMap,
        },
      ]);
      const sidePanelCabinetSwatch = resolveSwatch(cabinetColor);
      const sidePanelCabinetMaterialLabel = sidePanelCabinetMaterialSku
        ? (materialSkuLabelMap[sidePanelCabinetMaterialSku] ?? sidePanelCabinetMaterialSku)
        : null;
      const sidePanelCabinetMaterialText = [sidePanelCabinetMaterialLabel, cabinetColor]
        .filter(Boolean)
        .join(" | ");

      const activeSides: Array<{ side: "left" | "right"; label: string }> = [];
      if (sidePanelLeft === "active") activeSides.push({ side: "left", label: "Side Panel Left" });
      if (sidePanelRight === "active") activeSides.push({ side: "right", label: "Side Panel Right" });

      activeSides.forEach(({ side, label }) => {
        if (!spSku) return;
        sidePanelSkuItems.push({
          id: `accessories-side-panel-${side}`,
          title: label,
          subtitle: sidePanelLabelMap[sidePanelsOption] ?? sidePanelsOption,
          sku: spSku,
          swatch: sidePanelCabinetMaterialText
            ? {
                label: "Cabinet",
                value: sidePanelCabinetMaterialText,
                color: sidePanelCabinetSwatch.color,
                image: sidePanelCabinetSwatch.image,
              }
            : undefined,
          price: resolveItemPrice(spSku),
          copyable: true,
          showInfo: true,
          description: {
            "Product Category": "Side Panel",
            "Panel Type": sidePanelLabelMap[sidePanelsOption] ?? sidePanelsOption,
            Side: side,
            Width: SIDE_PANEL_WIDTH_CM,
            Height: dims.height,
            Depth: normalizeSidePanelSummaryDepth(dims.depth),
            "Cabinet Color": cabinetColor || null,
            "Groove Color": handleGrooveColor || null,
            elements: sidePanelMaterialElements,
          },
        });
      });
    }

    const accessoriesItems: SummaryItem[] = [
      ...sidePanelSkuItems,
      ...dividerItems,
      towelBarRightSku
        ? {
            id: "accessories-towel-bar-right",
            title: "Towel Bar Right",
            subtitle: towelBarColor || undefined,
            sku: towelBarRightSku,
            price: resolveItemPrice(towelBarRightSku),
            copyable: true,
            showInfo: true,
            description: {
              "Product Category": "Towel Bar",
              Side: "Right",
              Width: TOWEL_BAR_DEFAULTS.width,
              Height: TOWEL_BAR_DEFAULTS.height,
              Depth: TOWEL_BAR_DEFAULTS.depth,
              Material: towelMaterialSku ? (materialSkuLabelMap[towelMaterialSku] ?? towelMaterialSku) : null,
              "Color Code": towelBarColor,
            },
          }
        : null,
      towelBarLeftSku
        ? {
            id: "accessories-towel-bar-left",
            title: "Towel Bar Left",
            subtitle: towelBarColor || undefined,
            sku: towelBarLeftSku,
            price: resolveItemPrice(towelBarLeftSku),
            copyable: true,
            showInfo: true,
            description: {
              "Product Category": "Towel Bar",
              Side: "Left",
              Width: TOWEL_BAR_DEFAULTS.width,
              Height: TOWEL_BAR_DEFAULTS.height,
              Depth: TOWEL_BAR_DEFAULTS.depth,
              Material: towelMaterialSku ? (materialSkuLabelMap[towelMaterialSku] ?? towelMaterialSku) : null,
              "Color Code": towelBarColor,
            },
          }
        : null,
    ].filter(Boolean) as SummaryItem[];

    const faucetHolesSku =
      extraCountertopItems.find((item) => item.title === "Faucet Holes" && item.sku)?.sku ??
      countertopSkuLines.find((sku) => sku.includes("-FAHO/"));

    const faucetItems: SummaryItem[] = [
      faucetHolesAmount
        ? {
            id: "faucet-holes-amount",
            title: "Faucet Holes",
            subtitle: faucetHolesAmount,
            sku: faucetHolesSku,
            price: "$0",
            copyable: Boolean(faucetHolesSku),
          }
        : null,
    ].filter(Boolean) as SummaryItem[];

    return [
      {
        id: "cabinet",
        title: "Cabinet",
        copyLabel: "Copy sku and description",
        items: cabinetItems,
      },
      ...(cabinetOptionItems.length
        ? [
            {
              id: "cabinet-options",
              title: "Cabinet Options",
              items: cabinetOptionItems,
            },
          ]
        : []),
      {
        id: "countertop",
        title: "Countertop",
        items: countertopItems,
      },
      ...(vesselSku
        ? [
            {
              id: "basin",
              title: "Vessel",
              items: Array.from({ length: sinkBaseCountForHcut }, (_, index) => ({
                id: `basin-vessel-sku-${index}`,
                title: "Vessel",
                subtitle: basinStyleLabel ?? "Vessel",
                sku: vesselSku,
                swatch: vesselSwatch
                  ? {
                      label: "Vessel",
                      value: vesselSwatch.value,
                      color: vesselSwatch.color,
                      image: vesselSwatch.image,
                    }
                  : undefined,
                price: resolveItemPrice(vesselSku),
                copyable: true,
                showInfo: true,
                description: {
                  "Product Category": "Vessel",
                  Type: basinStyleLabel ?? resolvedSinkType,
                  Width: formatVesselDimensionLabel(vesselDimensionTokens?.width),
                  Height: formatVesselDimensionLabel(vesselDimensionTokens?.height),
                  Depth: formatVesselDimensionLabel(vesselDimensionTokens?.depth),
                  Material: displayVesselMaterial,
                  "Color Code": resolvedVesselColor,
                },
              })),
            },
          ]
        : []),
      {
        id: "accessories",
        title: "Accessories",
        items: accessoriesItems,
      },
      ...(faucetItems.length
        ? [
            {
              id: "faucet",
              title: "Faucet",
              items: faucetItems,
            },
          ]
        : []),
    ];
  }, [
    activeCabinetType,
    cabinetColor,
    cabinetColorSku,
    countertopColorSku,
    countertopColor,
    vesselColor,
    countertopThickness,
    countertopStyle,
    drawerPanelFluting,
    faucetHolesAmount,
    grainDirection,
    bookMatching,
    handleGrooveColor,
    handleGrooveColorSku,
    hasBootstrappedCabinetBuilder,
    productsPresets,
    selectedProducts,
    productConfigs,
    cabinetColorSkuByName,
    handleGrooveColorSkuByName,
    countertopColorSkuCandidatesByValue,
    countertopRules,
    selectedDimensions.depth,
    selectedDimensions.height,
    selectedDimensions.width,
    selectedProductConfig,
    sidePanelsOption,
    sidePanelLeft,
    sidePanelRight,
    sinkType,
    towelBarColor,
    towelBarOption,
    placedDividers,
    placedCabinetStyles,
    priceBySku,
    resolveSwatch,
    resolveItemPrice,
    buildCabinetDescription,
    dividersStyle,
  ]);

  const fullSkuJson = useMemo(() => {
    return summarySections
      .flatMap((section) => section.items)
      .filter((item) => item.sku && item.copyable)
      .map((item) => ({
        sku: item.sku,
        skuInches: convertSkuToInchesForSummary(item.sku!),
        description: item.description ?? {},
      }));
  }, [summarySections]);

  const summaryTotal = useMemo(
    () =>
      summarySections.reduce(
        (sectionAcc, section) =>
          sectionAcc + section.items.reduce((itemAcc, item) => itemAcc + parsePriceValue(item.price), 0),
        0,
      ),
    [summarySections],
  );

  useEffect(() => {
    setSummarySkuJson(fullSkuJson);
  }, [fullSkuJson]);

  useEffect(() => {
    setSummaryTotal(summaryTotal);
  }, [summaryTotal]);

  useEffect(
    () => () => {
      setSummarySkuJson([]);
      setSummaryTotal(null);
    },
    [],
  );

  useEffect(() => {
    const configIdFromUrl = new URLSearchParams(location.search).get("configId");
    if (configIdFromUrl) return;

    let isCancelled = false;

    const run = async () => {
      const ids = getOrderedProductIds();
      if (!ids.length) return;

      try {
        const configs = await Promise.all(ids.map((id) => getConfig(id)));
        const configuration = ids.reduce<Record<string, unknown>>((acc, id, index) => {
          acc[id] = configs[index];
          return acc;
        }, {});

        const metadata = buildConfigurationMetadata({
          path: location.pathname,
          orderedProductIds: ids,
          uiState: {
            CabinetColor: cabinetColor,
            HandleGrooveColor: handleGrooveColor,
            sinkType,
            CountertopColor: countertopColor,
            CountertopColorSku: countertopColorSku,
            Thickness: countertopThickness,
            DrawerPanelFluting: drawerPanelFluting,
            GrainDirection: grainDirection,
            CountertopStyle: countertopStyle,
            SidePanels: sidePanelsOption,
            SidePanelLeft: sidePanelLeft,
            SidePanelRight: sidePanelRight,
            LedOption: ledOption,
            DividersOption: dividersOption,
            DividersStyle: dividersStyle,
            TowelBarOption: towelBarOption,
            TowelBarColor: towelBarColor,
            FaucetHolesAmount: faucetHolesAmount,
          },
          swatchOrder: {
            selectedMaterials,
            manualSelectedMaterials,
            isAutofillEnabled,
            hasSubmittedCart,
          },
        });

        const snapshotHash = JSON.stringify({ configuration, metadata });
        if (lastSavedHashRef.current === snapshotHash) return;

        const result = await saveConfiguration({ configuration, metadata }).unwrap();
        if (isCancelled) return;
        lastSavedHashRef.current = snapshotHash;
        const nextConfigId = result?.id;
        if (nextConfigId !== undefined && nextConfigId !== null) {
          setGeneratedConfigId(String(nextConfigId));
        }
      } catch (error) {
        console.error("[Summary Share] Failed to generate configuration link", error);
      }
    };

    run();

    return () => {
      isCancelled = true;
    };
  }, [
    cabinetColor,
    countertopColor,
    countertopStyle,
    countertopThickness,
    dividersOption,
    dividersStyle,
    drawerPanelFluting,
    faucetHolesAmount,
    grainDirection,
    handleGrooveColor,
    ledOption,
    location.pathname,
    location.search,
    saveConfiguration,
    sidePanelsOption,
    sinkType,
    towelBarColor,
    towelBarOption,
    sidePanelLeft,
    sidePanelRight,
    countertopColorSku,
    selectedMaterials,
    manualSelectedMaterials,
    isAutofillEnabled,
    hasSubmittedCart,
  ]);

  const quoteModelName = "Urban Standard Height";

  const swatchOrderData = useMemo(
    () => adaptThreekitConfig(cabinetColors, { countertopRules }),
    [cabinetColors, countertopRules],
  );
  const summaryAutofillValues = useMemo(() => {
    const values = summarySections.flatMap((section) => section.items.map((item) => item.swatch?.value));
    values.push(handleGrooveColor, towelBarColor, vesselColor);
    return values;
  }, [summarySections, handleGrooveColor, towelBarColor, vesselColor]);
  const autofillMaterials = useMemo(
    () =>
      deriveAutofillMaterials({
        allMaterialValues: swatchOrderData.allMaterialValues,
        values: summaryAutofillValues,
      }),
    [swatchOrderData.allMaterialValues, summaryAutofillValues],
  );
  const mergedSummaryMaterials = useMemo(
    () =>
      mergeAutofillWithSelectedMaterials({
        autofillMaterials,
        selectedMaterials: manualSelectedMaterials,
      }),
    [autofillMaterials, manualSelectedMaterials],
  );
  const effectiveSummaryMaterials = isAutofillEnabled ? mergedSummaryMaterials : selectedMaterials;
  const swatchesListPreview = useMemo(
    () => effectiveSummaryMaterials.map(toSwatchPreview),
    [effectiveSummaryMaterials],
  );
  const swatchesSummaryState = useMemo(
    () =>
      resolveSwatchesSummaryState({
        items: swatchesListPreview,
        autofillItemsCount: autofillMaterials.length,
        isAutofillEnabled,
        isEnabledInSummary: isSwatchesEnabledInSummary,
      }),
    [autofillMaterials.length, isAutofillEnabled, isSwatchesEnabledInSummary, swatchesListPreview],
  );
  const hasSummarySwatches = swatchesSummaryState.hasItems;
  const isSwatchesBlockVisible = swatchesSummaryState.isBlockVisible;
  const isSwatchesEnabledForSummary = swatchesSummaryState.isAutofillChecked;
  const displayedSwatchesListPreview = swatchesSummaryState.displayedItems;
  const canEnableSwatchesForSummary = swatchesSummaryState.canEnableAutofill;

  useEffect(() => {
    if (!swatchOrderData.allMaterialValues.length) return;
    if (!hasSummarySwatches && isSwatchesEnabledInSummary) {
      dispatch(setSwatchesEnabledInSummary(false));
    }
  }, [dispatch, swatchOrderData.allMaterialValues.length, hasSummarySwatches, isSwatchesEnabledInSummary]);

  const handleSwatchesEnabledChange = useCallback(
    (checked: boolean) => {
      dispatch(setAutofillEnabled(checked));

      if (checked && mergedSummaryMaterials.length > 0) {
        dispatch(setCartMaterials(mergedSummaryMaterials));
      }

      dispatch(setSwatchesEnabledInSummary(checked));
    },
    [dispatch, mergedSummaryMaterials],
  );

  const quoteGeneratedDate = useMemo(() => formatQuoteGeneratedDate(), []);
  const configurationLink = useMemo(() => {
    const configId = new URLSearchParams(location.search).get("configId") || generatedConfigId;
    if (configId) {
      return `${window.location.origin}/custom/cabinet-builder?configId=${encodeURIComponent(configId)}`;
    }
    return `${window.location.origin}${location.pathname}${location.search}`;
  }, [generatedConfigId, location.pathname, location.search]);

  // Prices are fetched reactively by usePriceCalculation hook in ConfiguratorSidebar.
  // This page only reads from the store.

  return (
    <>
      <div id="summary-content" className={s.summaryPage}>
        {summarySections.map((section) => (
          <div key={section.id} className={s.section}>
            <div className={s.sectionHeader}>
              <div className={s.sectionTitle}>{section.title}</div>
              <div className={s.sectionAction} ref={section.id === "cabinet" ? editMenuRef : null}>
                <button
                  type="button"
                  className={s.editButton}
                  aria-label={`Edit ${section.title}`}
                  aria-expanded={section.id === "cabinet" ? openEditMenuSectionId === section.id : undefined}
                  aria-haspopup={section.id === "cabinet" ? "menu" : undefined}
                  onClick={() => handleEditSection(section.id)}
                >
                  <EditPenIcon />
                </button>
                {section.id === "cabinet" && openEditMenuSectionId === section.id && (
                  <NestedDropdown items={cabinetEditMenuItems} className={s.summaryEditDropdown} />
                )}
              </div>
            </div>

            <div className={s.sectionList}>
              {section.items.map((item) => {
                const isShelfItem = /shelf/i.test(item.title ?? "");
                const description = item.description;
                const cabinetHandleSubtitle =
                  section.id === "cabinet" && !isShelfItem && typeof description?.["Handle Style"] === "string"
                    ? description["Handle Style"]
                    : null;
                return (
                  <div key={item.id} className={`${s.itemRow} ${!item.swatch ? s.noSwatch : ""}`}>
                    <div className={s.itemInfo}>
                      <span className={s.bullet}>{/* <img src={base_img} alt="#" /> */}</span>

                      <div className={s.itemTexts}>
                        <div className={s.itemTitle}>
                          {item.title}
                          {item.showInfo && description && (
                            <span className={`${s.infoIcon} ${s.infoTooltip}`}>
                              <InformationIcon />
                              <span className={s.infoTooltipContent}>
                                {buildInfoTooltip(description)}
                                <button
                                  className={`${s.infoTooltipCopy} ${copiedId === `${item.id}-desc` ? s.infoTooltipCopied : ""}`}
                                  onClick={() => handleCopy(buildInfoTooltip(description), `${item.id}-desc`)}
                                  aria-label="Copy description"
                                >
                                  <span className={s.copyIcon} />
                                </button>
                              </span>
                            </span>
                          )}
                        </div>
                        {item.subtitle && <div className={s.itemSubtitle}>{item.subtitle}</div>}
                        {cabinetHandleSubtitle && <div className={s.itemSubtitle}>{cabinetHandleSubtitle}</div>}
                      </div>

                      {item.copyable && item.sku && (
                        <Hint className={s.copyHint} content={"Copy SKU"}>
                          <button
                            className={`${s.copyButton} ${copiedId === item.id ? s.copied : ""}`}
                            onClick={() => handleCopy(item.sku!, item.id)}
                            aria-label="Copy SKU"
                          >
                            <span className={s.copyIcon} />
                          </button>
                        </Hint>
                      )}
                    </div>

                    {item.swatch && (
                      <div className={s.swatch}>
                        <span
                          className={s.swatchColor}
                          style={{
                            backgroundColor: item.swatch.color,
                            backgroundImage: item.swatch.image ? `url(${item.swatch.image})` : undefined,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        />
                        <div>
                          <div className={s.swatchLabel}>{item.swatch.label}</div>
                          <div className={s.swatchValue}>{item.swatch.value}</div>
                        </div>
                      </div>
                    )}

                    <div className={s.price}>
                      {!item.priceLabel && item.sku && isPriceLoading && !(item.sku in priceBySku) ? (
                        <span className={s.priceSpinner} />
                      ) : item.priceLabel ? (
                        item.priceLabel
                      ) : item.price !== "$0" ? (
                        item.price
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {isSwatchesBlockVisible && (
          <div className={s.section} data-summary-section="swatches">
            <div className={s.sectionHeader}>
              <div className={s.sectionTitle}>Swatches</div>
              <button
                type="button"
                className={s.editButton}
                aria-label="Edit Swatches"
                onClick={() => handleEditSection("swatches")}
              >
                <EditPenIcon />
              </button>
            </div>

            {/* <p className={s.sectionHint}>We will add to your swatch cart with your selected finishes</p> */}

            <label className={s.addSwatches}>
              <input
                type="checkbox"
                checked={isSwatchesEnabledForSummary}
                disabled={!canEnableSwatchesForSummary}
                onChange={(event) => handleSwatchesEnabledChange(event.target.checked)}
              />
              <span className={s.addLabel}>Autofill My Swatches</span>
            </label>

            <p className={s.sectionHint}>Let us fill your swatch cart with your selected finishes</p>

            <div className={s.swatchesListHeader}>Swatches list</div>

            <div className={s.swatchesList}>
              {Array.from({ length: MAX_SWATCHES }).map((_, index) => {
                const swatch = displayedSwatchesListPreview[index];
                if (!swatch) {
                  return (
                    <div key={`empty-${index}`} className={s.swatchTile}>
                      <span className={`${s.tileColor} ${s.tileEmpty}`} />
                    </div>
                  );
                }

                return (
                  <div key={swatch.value} className={s.swatchTile}>
                    <span
                      className={s.tileColor}
                      style={{
                        backgroundColor: swatch.color,
                        backgroundImage: swatch.image ? `url(${swatch.image})` : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                      tabIndex={0}
                      aria-label={swatch.label}
                      aria-describedby={`summary-swatch-tooltip-${index}`}
                    />
                    <span id={`summary-swatch-tooltip-${index}`} className={s.tileTooltip} role="tooltip">
                      {swatch.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <QuotePrintDocument
        summarySections={summarySections}
        previewImage={quotePreviewImage}
        modelName={quoteModelName}
        generatedDate={quoteGeneratedDate}
        configurationLink={configurationLink}
      />
    </>
  );
};
