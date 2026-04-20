import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { setSummarySkuJson, setSummaryTotal } from "@/shared/lib/summarySkuStore";
import { buildInfoTooltip } from "@/shared/lib/buildInfoTooltip";
import { formatBasinStyle } from "@/shared/lib/formatBasinStyle";

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
  getPlacedDividers,
} from "@/entities/product/model/store/selectors";
// import { dividersMockData } from "@/pages/prebuilt/accessories/constants";
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
  resolveCabinetPricingMaterialSku,
} from "@/shared/lib/sku";
import { useGetConfiguratorQuery, useSaveConfigurationMutation } from "@/entities";
import { calcTotalCountertopWidthCm } from "@/entities/countertop";
import { buildConfigurationMetadata } from "@/features/saveConfiguration";
import {
  normalizeMaterialToken,
  resolveDefaultThicknessFromRules,
  useCountertopRules,
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
  setAutofillEnabled,
  setCartMaterials,
  setSwatchesEnabledInSummary,
  toSwatchPreview,
  MAX_SLOTS as MAX_SWATCHES,
  openSwatchOrder,
} from "@/features/swatchOrder";
import { captureScreenshotWithOptions } from "@/utils/functions/playcanvas/captureScreenshot";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { QuotePrintDocument } from "@/features/quotePrint/ui/QuotePrintDocument";
import { printQuote } from "@/features/quotePrint/lib/printQuote";
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

const inferMaterialSkuFromBasinType = (basinType: string | null): string | null => {
  const basin = basinType?.trim() ?? "";
  if (!basin) return null;
  if (basin.startsWith("Top_Tekorlux_")) return "SSTKR";
  if (basin.startsWith("Top_Tekormud_") || basin.startsWith("Top_Tekorund_")) return "SSTM";
  if (basin.startsWith("Top_Ocritech_")) return "SSOCR";
  if (basin.startsWith("Top_Mineralmarmo_")) return "SSMMO";
  if (basin.startsWith("Top_Porcelain_")) return "POR";
  if (basin.startsWith("Top_HPL/Fenix_") || basin === "Fenix_Strip_Gres") return "FX";
  if (basin.startsWith("Top_HPL")) return "HPL";
  return null;
};

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

const normalizeCountertopThicknessForDisplay = (value: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return trimmed;
  return Math.abs(parsed - 2.5) < 0.001 ? "2.4" : trimmed;
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

/** Human-readable labels for handle types */
const handleLabelMap: Record<string, string> = {
  handle_urban_topcut: "Upper Groove",
  handle_urban_botcut: "Central Groove",
  handle_pto: "Push to Open",
};

/** Human-readable labels for drawer configs */
const drawerLabelMap: Record<string, string> = {
  "1D": "1 Drawer",
  "2D": "2 Drawer",
  "1DWID": "1 Drawer with inner drawer",
};

/** Human-readable labels for material SKU codes */
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

/** Human-readable labels for side panel groove types */
const sidePanelLabelMap: Record<string, string> = {
  NoG: "No Groove",
  UpperG: "Upper Groove",
  CenterG: "Center Groove",
  DoubleG: "Double Groove",
};

export const SummaryPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [quotePreviewImage, setQuotePreviewImage] = useState<string>("");
  const [openEditMenuSectionId, setOpenEditMenuSectionId] = useState<string | null>(null);
  const editMenuRef = useRef<HTMLDivElement | null>(null);
  const lastSavedHashRef = useRef<string | null>(null);
  const editPathBySectionId: Record<string, string> = {
    cabinet: "/prebuilt/color",
    "cabinet-options": "/prebuilt/color",
    countertop: "/prebuilt/countertop",
    basin: "/prebuilt/countertop",
    accessories: "/prebuilt/accessories",
    faucet: "/prebuilt/faucet-holes",
  };

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
  const towelBarColor = useAppSelector(getTowelBarColor);

  const sinkType = useAppSelector(getSinkType);
  const drawerPanelFluting = useAppSelector(getDrawerPanelFluting);
  const grainDirection = useAppSelector(getGrainDirection);
  const bookMatching = useAppSelector(getBookMatching);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const sidePanelsOption = useAppSelector(getSidePanelsOption);
  const sidePanelLeft = useAppSelector(getSidePanelLeftStatus);
  const sidePanelRight = useAppSelector(getSidePanelRightStatus);
  const placedDividers = useAppSelector(getPlacedDividers);
  const dividersStyle = useAppSelector(getDividersStyle);
  const dividersOption = useAppSelector(getDividersOption);
  const ledOption = useAppSelector(getLedOption);
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
        id: "model-selection",
        label: "Model Selection",
        trailing: <ArrowTopRight color="#333" />,
        onClick: () => handleCabinetEditMenuNavigate("/prebuilt/model"),
      },
      {
        id: "color",
        label: "Color",
        trailing: <ArrowTopRight color="#333" />,
        onClick: () => handleCabinetEditMenuNavigate("/prebuilt/color"),
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
    const values = (dataMaterial as { materials?: any[] }).materials ?? [];
    const map = new Map<string, { hex?: string; image?: string; label?: string }>();
    const scoreEntry = (entry?: { hex?: string; image?: string; label?: string }) => {
      if (!entry) return 0;
      return (entry.image ? 2 : 0) + (entry.hex ? 1 : 0) + (entry.label ? 1 : 0);
    };

    values.forEach((option) => {
      (option.valuesArray ?? []).forEach((entry: any) => {
        const key = entry.metadata?.value ?? entry.value;
        if (!key) return;
        const next = { hex: entry.metadata?.hex, image: entry.metadata?.image, label: entry.label };
        const existing = map.get(key);
        if (!existing || scoreEntry(next) > scoreEntry(existing)) {
          map.set(key, next);
        }
      });
    });

    map.set(SPECIAL_VARIANT_DISPLAY_VALUE, {
      image: SPECIAL_VARIANT_DISPLAY_IMAGE,
      label: SPECIAL_VARIANT_DISPLAY_VALUE,
    });

    return map;
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
  const countertopRules = useCountertopRules();

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

    captureScreenshotWithOptions({ includeLogo: false }).then((image) => {
      if (!isMounted || !image) return;
      setQuotePreviewImage(image);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!quotePreviewImage) return;
    const params = new URLSearchParams(location.search);
    if (params.get("print") !== "1") return;

    const timer = window.setTimeout(() => {
      printQuote();
      params.delete("print");
      navigate(
        { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : "" },
        { replace: true },
      );
    }, 300);

    return () => window.clearTimeout(timer);
  }, [quotePreviewImage, location.search, location.pathname, navigate]);

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
      const elements: Record<string, string>[] = [];
      if (opts.cabMaterialSku) {
        elements.push({
          "Product Elements": "Cabinet",
          Material: materialSkuLabelMap[opts.cabMaterialSku] ?? opts.cabMaterialSku,
          "Color Code": opts.cabColor,
        });
      }
      if (!isShelfCabinet && opts.hdlMaterialSku) {
        elements.push({
          "Product Elements": "Handle",
          Material: materialSkuLabelMap[opts.hdlMaterialSku] ?? opts.hdlMaterialSku,
          "Color Code": opts.hdlColor,
        });
      }
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
    const shouldUsePresets = shouldUsePresetProducts({
      productsPresetsCount: productsPresets.length,
      productIdsCount: selectedProducts.length,
      sceneConfigsCount: productConfigs.length,
      hasBootstrappedCabinetBuilder,
    });
    const sceneProductConfigs = shouldUsePresets ? productConfigs.slice(productsPresets.length) : productConfigs;
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
              cabinetColorCode: extractColorCode(swatchValue),
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
              cabinetColorCode: extractColorCode(swatchValue),
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
                    colorCode: extractColorCode(swatchValue),
                    grainDirection: grainSku,
                  }
                : null,
              hdl: handleMaterialSku
                ? { materialSku: handleMaterialSku, colorCode: extractColorCode(handleGrooveColor) }
                : null,
              msp: null,
              bkpl: null,
            });
          }

          return {
            id: `cabinet-${index}`,
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
          cabinetColorCode: extractColorCode(swatchValue),
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
          cabinetColorCode: extractColorCode(swatchValue),
          grainDirection: grainSku,
        });
      } else {
        sku = buildProductSku({
          cabinetType: productCabinetType ? productCabinetType.replace(/[\s_]+/g, "-") : productCabinetType,
          drawers: typeof config.Drawers === "string" ? config.Drawers : null,
          handle: (selectedProductConfig?.Handle as string | undefined) || config.Handle || null,
          pattern: drawerPanelFluting || null,
          width: width ?? null,
          height: height ?? null,
          depth: depth ?? null,
          cab: cabinetMaterialSku
            ? {
                materialSku: cabinetMaterialSku,
                colorCode: extractColorCode(swatchValue),
                grainDirection: grainSku,
              }
            : null,
          hdl: handleMaterialSku
            ? { materialSku: handleMaterialSku, colorCode: extractColorCode(handleGrooveColor) }
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
          handle: (selectedProductConfig?.Handle as string | undefined) || config.Handle || null,
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
                colorCode: extractColorCode(cabinetColor),
                grainDirection: grainSku,
              }
            : null,
          hdl: handleMaterialSku
            ? { materialSku: handleMaterialSku, colorCode: extractColorCode(handleGrooveColor) }
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
    const bookMatchingCabinets: BookMatchingCabinetInput[] = shouldUsePresets
      ? [
          ...productsPresets.map((preset) => ({
            name: preset.name,
            drawers: preset.Drawers ?? null,
          })),
          ...cabinetConfigs.map((config) => ({
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
            drawers: config.Drawers,
          })),
        ]
      : cabinetConfigs.length > 0
        ? cabinetConfigs.map((config) => ({
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
            drawers: config.Drawers,
          }))
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
      inferMaterialSkuFromBasinType(resolvedSinkType) ||
      null;
    const resolvedVesselColor = vesselColor || resolvedCountertopColor;
    const resolvedVesselMaterialSku =
      resolveCountertopColorSkuFromCandidates({
        value: resolvedVesselColor,
        candidatesByValue: countertopColorSkuCandidatesByValue,
        preferredMaterialTokens: [
          ...getCountertopMaterialTokensBySku(resolvedCountertopMaterialSku),
          ...preferredCountertopMaterialTokens,
        ],
      }) || resolvedCountertopMaterialSku;
    const isVesselCountertop = (countertopStyle || "").trim().toLowerCase() === "vessel";
    const effectiveCountertopMaterialSku = resolvedCountertopMaterialSku;
    const effectiveCountertopColorCode = extractColorCode(resolvedCountertopColor);
    const materialForThicknessRules = resolvedCountertopMaterialSku || inferMaterialSkuFromBasinType(resolvedSinkType);
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
    });
    const resolvedCountertopThickness =
      countertopThickness ??
      (firstSceneCabinetConfig && typeof firstSceneCabinetConfig.Thickness === "string"
        ? firstSceneCabinetConfig.Thickness
        : null) ??
      matrixDefaultThickness;
    const displayCountertopThickness = normalizeCountertopThicknessForDisplay(resolvedCountertopThickness);
    const countertopSwatch = resolveSwatch(resolvedCountertopColor);

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

    const cabinetWidthSum =
      cabinetConfigs.length > 0
        ? cabinetConfigs.reduce((sum, c) => sum + (typeof c.Width === "number" ? c.Width : 0), 0)
        : productsPresets.length > 0
          ? productsPresets.reduce((sum, p) => sum + (p.Width ?? 0), 0)
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
          colorCode: extractColorCode(resolvedVesselColor),
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
            price: resolveItemPrice(basinLine),
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
      const linePrice = resolveItemPrice(line);

      return Array.from({ length: itemCount }, (_, index) => ({
        id: `countertop-sku-${i + 1}-${index}`,
        title: lineTitle,
        subtitle: optionSubtitle,
        sku: line,
        price: linePrice,
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
      {
        id: "countertop-1",
        title: "Countertop",
        subtitle: displayCountertopThickness ?? undefined,
        sku: countertopSkuLines[0],
        swatch: {
          label: "Countertop",
          value: resolvedCountertopColor,
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
          Material: resolvedCountertopMaterialSku
            ? (materialSkuLabelMap[resolvedCountertopMaterialSku] ?? resolvedCountertopMaterialSku)
            : null,
          "Color Code": resolvedCountertopColor,
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
      const inferSidePanelMaterialSku = (colorValue?: string | null): string | null => {
        if (!colorValue) return null;
        const upper = colorValue.trim().toUpperCase();
        if (!upper) return null;
        if (/\bTK[A-Z0-9]+\b/.test(upper)) return "HPL";
        if (/\b(10B|10F|10G|10N|1PE|1A[1-5])\b/.test(upper)) return "3D";
        if (/\bGL\b/.test(upper)) return "LACG";
        if (/\bMT\b/.test(upper)) return "LACM";
        return null;
      };
      const sidePanelCabinetColor =
        (cabinetConfigs.find((c) => typeof c.CabinetColor === "string" && c.CabinetColor)?.CabinetColor as
          | string
          | undefined) ??
        productsPresets.find((p) => typeof p.CabinetColor === "string" && p.CabinetColor)?.CabinetColor ??
        cabinetColor;
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
      const spSku = buildSidePanelSku({
        panelType: sidePanelsOption,
        width: SIDE_PANEL_WIDTH_CM,
        height: dims.height,
        depth: dims.depth,
        cabMaterialSku:
          resolveCabinetMaterialSku(sidePanelCabinetColor) || inferSidePanelMaterialSku(sidePanelCabinetColor),
        cabColorCode: extractColorCode(sidePanelCabinetColor),
        hdlMaterialSku: handleMaterialSku,
        hdlColorCode: extractColorCode(handleGrooveColor),
      });

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
          price: resolveItemPrice(spSku),
          copyable: true,
          showInfo: true,
          description: {
            "Product Category": "Side Panel",
            "Panel Type": sidePanelLabelMap[sidePanelsOption] ?? sidePanelsOption,
            Side: side,
            Width: SIDE_PANEL_WIDTH_CM,
            Height: dims.height,
            Depth: dims.depth,
            "Cabinet Color": cabinetColor || null,
            "Groove Color": handleGrooveColor || null,
          },
        });
      });
    }

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
              title: "Basin",
              items: Array.from({ length: sinkBaseCountForHcut }, (_, index) => ({
                id: `basin-vessel-sku-${index}`,
                title: "Vessel",
                subtitle: basinStyleLabel ?? "Vessel",
                sku: vesselSku,
                price: resolveItemPrice(vesselSku),
                copyable: true,
                description: { "Product Category": "Vessel", Type: resolvedSinkType },
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

  const quoteModelName = useMemo(() => {
    const firstCabinetTitle = summarySections.find((section) => section.id === "cabinet")?.items[0]?.title;
    const normalized = (firstCabinetTitle ?? "Urban Standard").toUpperCase();
    const widthLabel = selectedDimensions.width ? ` - ${selectedDimensions.width}` : "";
    return `${normalized}${widthLabel}`;
  }, [summarySections, selectedDimensions.width]);

  const swatchOrderData = useMemo(() => adaptThreekitConfig(cabinetColors), [cabinetColors]);
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
  const hasSummarySwatches = effectiveSummaryMaterials.length > 0;
  const isSwatchesBlockVisible = hasSummarySwatches || autofillMaterials.length > 0;
  const isSwatchesEnabledForSummary = isSwatchesEnabledInSummary && hasSummarySwatches;
  const displayedSwatchesListPreview = isSwatchesEnabledForSummary ? swatchesListPreview : [];
  const canEnableSwatchesForSummary = hasSummarySwatches || autofillMaterials.length > 0;

  useEffect(() => {
    if (!swatchOrderData.allMaterialValues.length) return;
    if (!hasSummarySwatches && isSwatchesEnabledInSummary) {
      dispatch(setSwatchesEnabledInSummary(false));
    }
  }, [dispatch, swatchOrderData.allMaterialValues.length, hasSummarySwatches, isSwatchesEnabledInSummary]);

  const handleSwatchesEnabledChange = useCallback(
    (checked: boolean) => {
      if (checked && selectedMaterials.length === 0 && autofillMaterials.length > 0) {
        dispatch(setAutofillEnabled(true));
        dispatch(setCartMaterials(mergedSummaryMaterials));
      }

      dispatch(setSwatchesEnabledInSummary(checked));
    },
    [dispatch, selectedMaterials.length, autofillMaterials.length, mergedSummaryMaterials],
  );

  const quoteGeneratedDate = useMemo(() => new Date().toLocaleDateString("en-US"), []);
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
                      {item.sku && isPriceLoading && !(item.sku in priceBySku) ? (
                        <span className={s.priceSpinner} />
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
        isSwatchesEnabled={isSwatchesBlockVisible && isSwatchesEnabledForSummary}
        swatchesPreview={displayedSwatchesListPreview}
      />
    </>
  );
};
