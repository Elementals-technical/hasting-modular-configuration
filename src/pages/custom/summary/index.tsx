import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { setSummarySkuJson, setSummaryTotal } from "@/shared/lib/summarySkuStore";
import { buildInfoTooltip } from "@/shared/lib/buildInfoTooltip";

import { Hint } from "@/shared/ui/Hint/Hint";
import { EditPenIcon } from "@/shared/assets/images/svg/EditPenIcon";
import { InformationIcon } from "@/shared/assets/images/svg/InformationIcon";
import base_img from "../../../shared/assets/images/png/descr_image.png";
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
  getDividersStyle,
  getDrawerPanelFluting,
  getFaucetHolesAmount,
  getFaucetHolesSpacing,
  getGrainDirection,
  getBookMatching,
  getHandleGrooveColor,
  getHandleGrooveColorSku,
  getPriceBySku,
  getPriceLoading,
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
  buildBookMatchingSku,
  buildOpenShelfSku,
  buildOpenSideShelfSku,
  extractColorCode,
  resolveDefaultBasinByCountertopColor,
} from "@/shared/lib/sku";
import { useGetConfiguratorQuery, useSaveConfigurationMutation } from "@/entities";
import { useGetCountertopDatatableQuery } from "@/entities/countertop";
import {
  normalizeMaterialToken,
  parseCountertopMatrix,
  resolveDefaultThicknessFromRules,
} from "@/features/configurator-rule-core/countertop";
import { getIsSwatchesEnabledInSummary, getSelectedSwatches } from "@/features/swatchSidebar/model/store/selectors";
import { setSwatchesEnabledInSummary } from "@/features/swatchSidebar/model/store/slice";
import { captureScreenshotWithOptions } from "@/utils/functions/playcanvas/captureScreenshot";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { QuotePrintDocument } from "@/features/quotePrint/ui/QuotePrintDocument";

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

/** SKU prefixes whose dimension values are stored in centimeters */
const CM_SKU_PREFIXES = ["VAN-URSTD-", "VAN-URTWLBR-", "VAN-URSP-"];

const formatInches = (cm: number): string => {
  const inches = Math.round((cm / 2.54) * 10) / 10;
  if (Number.isInteger(inches)) return String(inches);
  const str = inches.toFixed(1);
  return str.startsWith("0.") ? str.slice(1) : str;
};

const normalizeCountertopThicknessForDisplay = (value: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return trimmed;
  return Math.abs(parsed - 2.5) < 0.001 ? "2.4" : trimmed;
};

const formatBasinStyle = (value: string | null): string | null => {
  if (!value) return null;
  const cleaned = value
    .replace(/^Top_/, "")
    .replace(/^Vessel_/, "")
    .trim();
  if (!cleaned) return null;

  const parts = cleaned
    .split("_")
    .map((part) => part.trim())
    .filter(Boolean);

  const materialPrefixes = new Set([
    "Tekorlux",
    "Tekormud",
    "Tekorund",
    "Ocritech",
    "Mineralmarmo",
    "Porcelain",
    "HPL",
    "Fenix",
  ]);
  const normalizedParts = parts.length > 1 && materialPrefixes.has(parts[0]) ? parts.slice(1) : parts;

  return normalizedParts.join(" ").trim() || null;
};

/** Converts dimension values (W/H/D) from cm to inches for SKUs that store cm.
 *  SKUs that already use inches (CT-, VES-) are returned unchanged. */
const convertSkuToInches = (sku: string): string => {
  if (!CM_SKU_PREFIXES.some((prefix) => sku.startsWith(prefix))) return sku;
  return sku.replace(/-(\d+(?:\.\d+)?)(W|H|D)(?=-|$)/g, (_, value, unit) => {
    return `-${formatInches(parseFloat(value))}${unit}`;
  });
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
  "1DWID": "1 Wide Drawer",
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
  SSTM: "Teckormud",
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

export const CustomSummaryPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [quotePreviewImage, setQuotePreviewImage] = useState<string>("");
  const editPathBySectionId: Record<string, string> = {
    cabinet: "/custom/cabinet-colors",
    "cabinet-options": "/custom/cabinet-colors",
    countertop: "/custom/countertop",
    basin: "/custom/countertop",
    accessories: "/custom/accessories",
    faucet: "/custom/faucet-holes",
    swatches: "/custom/cabinet-colors",
  };

  const priceBySku = useAppSelector(getPriceBySku);
  const isPriceLoading = useAppSelector(getPriceLoading);
  const productsPresets = useAppSelector(getProductsPresets);
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
  const dividersStyle = useAppSelector(getDividersStyle);
  const towelBarColor = useAppSelector(getTowelBarColor);
  const towelBarOption = useAppSelector(getTowelBarOption);
  const faucetHolesAmount = useAppSelector(getFaucetHolesAmount);
  const faucetHolesSpacing = useAppSelector(getFaucetHolesSpacing);
  const selectedSwatches = useAppSelector(getSelectedSwatches);
  const isSwatchesEnabledInSummary = useAppSelector(getIsSwatchesEnabledInSummary);
  const hasSelectedSwatches = selectedSwatches.length > 0;
  const isSwatchesEnabledForSummary = isSwatchesEnabledInSummary && hasSelectedSwatches;

  const [productConfigs, setProductConfigs] = useState<Array<Record<string, unknown>>>([]);
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
      const path = editPathBySectionId[sectionId];
      if (path) navigate(path);
    },
    [navigate, editPathBySectionId],
  );

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
  const swatchesListPreview = useMemo(
    () => selectedSwatches.slice(0, 6).map((value) => resolveSwatch(value)),
    [selectedSwatches, resolveSwatch],
  );

  const { data: cabinetColors } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });
  const { data: countertopMatrixData } = useGetCountertopDatatableQuery(438);
  const countertopRules = useMemo(() => parseCountertopMatrix(countertopMatrixData), [countertopMatrixData]);

  const { cabinetColorSkuByName, handleGrooveColorSkuByName, countertopColorSkuByName } = useMemo(() => {
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
              const value = (meta.value as string) || variant.name;
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
      countertopColorSkuByName: buildMapForProxy("Countertop Color"),
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
          return config ? { _productId: id, ...config } : null;
        }),
      );
      const cleaned = configs.filter((config): config is Record<string, unknown> => Boolean(config));
      if (isMounted) setProductConfigs(cleaned);
    };

    loadConfigs();

    return () => {
      isMounted = false;
    };
  }, [selectedProducts]);

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
      const elements: Record<string, string>[] = [];
      if (opts.cabMaterialSku) {
        elements.push({
          "Product Elements": "Cabinet",
          Material: materialSkuLabelMap[opts.cabMaterialSku] ?? opts.cabMaterialSku,
          "Color Code": opts.cabColor,
        });
      }
      if (opts.hdlMaterialSku) {
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
        "Cabinet Style": opts.drawers ? (drawerLabelMap[opts.drawers] ?? opts.drawers) : "Unknown",
        "Handle Style": opts.handle ? (handleLabelMap[opts.handle] ?? opts.handle) : "Unknown",
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
    const resolveCabinetMaterialSku = (swatchValue?: string | null) =>
      (swatchValue ? cabinetColorSkuByName.get(swatchValue) : null) ||
      cabinetColorSku ||
      cabinetColorSkuByName.get(cabinetColor) ||
      null;
    const cabinetConfigs = productConfigs.filter((config) => config.category === "cabinets");
    const cabinetCount =
      cabinetConfigs.length > 0 ? cabinetConfigs.length : productsPresets.length > 0 ? productsPresets.length : 1;
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
    const cabinetItems =
      cabinetConfigs.length > 0
        ? cabinetConfigs.map((config, index) => {
            const width = typeof config.Width === "number" ? config.Width : undefined;
            const depth = typeof config.Depth === "number" ? config.Depth : undefined;
            const height = typeof config.Height === "number" ? config.Height : undefined;
            const drawers = typeof config.Drawers === "string" ? config.Drawers : "";

            const dims = [width, depth, height].every((v) => v !== undefined) ? `${width}x${depth}x${height}` : "";
            const subtitle = [drawers, dims].filter(Boolean).join(" | ");
            const name =
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
                        : undefined;
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
                handle: typeof config.Handle === "string" ? config.Handle : null,
                pattern:
                  typeof config.DrawerPanelFluting === "string"
                    ? config.DrawerPanelFluting
                    : drawerPanelFluting || null,
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
              id: `cabinet-${index}`,
              title: (name ?? activeCabinetType)?.replace(/-/g, " ") ?? "Cabinet",
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
                pattern:
                  typeof config.DrawerPanelFluting === "string"
                    ? config.DrawerPanelFluting
                    : drawerPanelFluting || null,
                width: width ?? null,
                height: height ?? null,
                depth: depth ?? null,
                cabColor: swatchValue,
                cabMaterialSku: cabinetMaterialSku,
                hdlColor: handleGrooveColor,
                hdlMaterialSku: handleGrooveColorSku || handleGrooveColorSkuByName.get(handleGrooveColor) || null,
              }),
            };
          })
        : productsPresets.length > 0
          ? productsPresets.map((preset, index) => {
              const drawers = preset.Drawers ? `${preset.Drawers}` : "";
              const dims = [preset.Width, preset.Depth, preset.Height].every((v) => v !== undefined)
                ? `${preset.Width}x${preset.Depth}x${preset.Height}`
                : "";
              const subtitle = [drawers, dims].filter(Boolean).join(" | ");
              const swatchValue = preset.CabinetColor ?? cabinetColor;
              const swatch = resolveSwatch(swatchValue);
              const cabinetMaterialSku = resolveCabinetMaterialSku(swatchValue);

              const handleMaterialSku =
                handleGrooveColorSku || handleGrooveColorSkuByName.get(handleGrooveColor) || null;
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
                  height: preset.Height ?? null,
                  depth: preset.Depth ?? null,
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
                title: preset.name ?? activeCabinetType?.replace(/-/g, " ") ?? "Cabinet",
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
                  height: preset.Height ?? null,
                  depth: preset.Depth ?? null,
                  cabColor: swatchValue,
                  cabMaterialSku: cabinetMaterialSku,
                  hdlColor: handleGrooveColor,
                  hdlMaterialSku: handleMaterialSku,
                }),
              };
            })
          : [
              (() => {
                const handleMaterialSku =
                  handleGrooveColorSku || handleGrooveColorSkuByName.get(handleGrooveColor) || null;
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
                      ? selectedProductConfig.name
                      : (activeCabinetType?.replace(/-/g, " ") ?? "Cabinet"),
                  subtitle: `${typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : ""} | ${selectedDimensions.width ?? "-"}x${selectedDimensions.depth ?? "-"}x${selectedDimensions.height ?? "-"}`,
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
    const resolvedCountertopMaterialSku =
      countertopColorSku ||
      countertopColorSkuByName.get(resolvedCountertopColor) ||
      countertopColorSkuByName.get(countertopColor) ||
      null;
    const resolvedVesselColor = vesselColor || resolvedCountertopColor;
    const resolvedVesselMaterialSku =
      countertopColorSkuByName.get(resolvedVesselColor) || resolvedCountertopMaterialSku;
    const useVesselMaterialForCountertopSku = (countertopStyle || "").trim().toLowerCase() === "vessel";
    const effectiveCountertopMaterialSku = useVesselMaterialForCountertopSku
      ? resolvedVesselMaterialSku
      : resolvedCountertopMaterialSku;
    const effectiveCountertopColorCode = extractColorCode(
      useVesselMaterialForCountertopSku ? resolvedVesselColor : resolvedCountertopColor,
    );
    const materialForThicknessRules = resolvedCountertopMaterialSku || inferMaterialSkuFromBasinType(resolvedSinkType);
    const matrixDefaultThickness = resolveDefaultThicknessFromRules({
      rules: countertopRules,
      activeMaterialTokens: materialForThicknessRules ? [normalizeMaterialToken(materialForThicknessRules)] : [],
      depth:
        selectedDimensions.depth ??
        (productsPresets.length > 0 ? (productsPresets[0]?.Depth ?? null) : null) ??
        (firstSceneCabinetConfig && typeof firstSceneCabinetConfig.Depth === "number"
          ? firstSceneCabinetConfig.Depth
          : null),
    });
    const resolvedCountertopThickness =
      (firstSceneCabinetConfig && typeof firstSceneCabinetConfig.Thickness === "string"
        ? firstSceneCabinetConfig.Thickness
        : null) ??
      countertopThickness ??
      matrixDefaultThickness;
    const displayCountertopThickness = normalizeCountertopThicknessForDisplay(resolvedCountertopThickness);
    const countertopSwatch = resolveSwatch(resolvedCountertopColor);

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
    ].filter(Boolean) as SummaryItem[];

    const totalCountertopWidth =
      cabinetConfigs.length > 0
        ? cabinetConfigs.reduce((sum, c) => sum + (typeof c.Width === "number" ? c.Width : 0), 0) || null
        : productsPresets.length > 0
          ? productsPresets.reduce((sum, p) => sum + (p.Width ?? 0), 0) || null
          : selectedDimensions.width;

    const countertopSkuLines = buildCountertopSku({
      style: countertopStyle || null,
      width: totalCountertopWidth,
      depth: selectedDimensions.depth,
      thickness: resolvedCountertopThickness,
      basinType: resolvedSinkType || null,
      faucetHolesAmount: faucetHolesAmount || null,
      faucetHolesSpacing: faucetHolesSpacing || null,
      countertopMaterialSku: effectiveCountertopMaterialSku,
      countertopColorCode: effectiveCountertopColorCode,
    });
    const hcutPricingSku = countertopSkuLines.find((line) => line.endsWith("-HCUT")) ?? "CT-URHPL-HCUT";
    const hcutUnitPrice = priceBySku[hcutPricingSku] ?? 0;
    const hcutTotalPrice = formatPrice(hcutUnitPrice * sinkBaseCountForHcut);

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

    const countertopSkuLabels = ["Countertop", "Basin", "Faucet Holes", "Faucet Hole Spacing", "Hole Cutout"];

    const extraCountertopItems = countertopSkuLines.slice(1).map((line, i) => {
      const lineTitle = countertopSkuLabels[i + 1] ?? "Countertop Element";
      return {
        id: `countertop-sku-${i + 1}`,
        title: lineTitle,
        subtitle: line,
        sku: line,
        price: resolveItemPrice(line),
        copyable: true,
        showInfo: lineTitle === "Basin",
        description: {
          "Product Category": lineTitle,
          ...(lineTitle === "Basin" && resolvedSinkType ? { "Basin Style": formatBasinStyle(resolvedSinkType) } : {}),
        },
      };
    });

    const countertopItems: SummaryItem[] = [
      // Main countertop item with swatch
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
      ...extraCountertopItems.filter((item) => item.title !== "Faucet Holes" && item.title !== "Faucet Hole Spacing"),
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
            subtitle: sku ?? undefined,
            sku: sku ?? undefined,
            price: formatPrice(unitPrice),
            copyable: !!sku,
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
          subtitle: sku,
          sku,
          price: formatPrice(unitPrice),
          copyable: true,
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
          ? { height: typeof cabinetConfigs[0].Height === "number" ? cabinetConfigs[0].Height : null, depth: typeof cabinetConfigs[0].Depth === "number" ? cabinetConfigs[0].Depth : null }
          : productsPresets.length > 0
            ? { height: productsPresets[0].Height ?? null, depth: productsPresets[0].Depth ?? null }
            : { height: selectedDimensions.height, depth: selectedDimensions.depth };

      const handleMaterialSku = handleGrooveColorSku || handleGrooveColorSkuByName.get(handleGrooveColor) || null;
      const spSku = buildSidePanelSku({
        panelType: sidePanelsOption,
        width: SIDE_PANEL_WIDTH_CM,
        height: dims.height,
        depth: dims.depth,
        cabMaterialSku: resolveCabinetMaterialSku(),
        cabColorCode: extractColorCode(cabinetColor),
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
          subtitle: spSku,
          sku: spSku,
          price: resolveItemPrice(spSku),
          copyable: true,
          description: {
            "Product Category": "Side Panel",
            "Panel Type": sidePanelLabelMap[sidePanelsOption] ?? sidePanelsOption,
            Side: side,
            Width: SIDE_PANEL_WIDTH_CM,
            Height: dims.height,
            Depth: dims.depth,
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
            subtitle: towelBarRightSku,
            sku: towelBarRightSku,
            price: resolveItemPrice(towelBarRightSku),
            copyable: true,
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
            subtitle: towelBarLeftSku,
            sku: towelBarLeftSku,
            price: resolveItemPrice(towelBarLeftSku),
            copyable: true,
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
      bookMatching === "enabled" && grainSku && (grainSku !== "H" || cabinetCount >= 2)
        ? (() => {
            const bmSku = buildBookMatchingSku({
              direction: grainSku,
              materialSku: resolveCabinetMaterialSku(cabinetColor),
            });
            return {
              id: "accessories-book-matching",
              title: "Book Matching",
              subtitle: bmSku,
              sku: bmSku,
              price: resolveItemPrice(bmSku),
              copyable: true,
              description: {
                "Product Category": "Book Matching",
                Direction: grainSku === "H" ? "Horizontal" : "Vertical",
              },
            };
          })()
        : null,
    ].filter(Boolean) as SummaryItem[];

    const faucetHolesSku =
      extraCountertopItems.find((item) => item.title === "Faucet Holes" && item.sku)?.sku ??
      countertopSkuLines.find((sku) => sku.includes("-FAHO/"));
    const faucetHoleSpacingSku =
      extraCountertopItems.find((item) => item.title === "Faucet Hole Spacing" && item.sku)?.sku ??
      countertopSkuLines.find((sku) => sku.includes("-FAHOS/"));

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
      faucetHolesSpacing
        ? {
            id: "faucet-holes-spacing",
            title: "Faucet Hole Spacing",
            subtitle: faucetHolesSpacing,
            sku: faucetHoleSpacingSku,
            price: "$0",
            copyable: Boolean(faucetHoleSpacingSku),
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
              items: [
                {
                  id: "basin-vessel-sku",
                  title: "Vessel",
                  subtitle: vesselSku,
                  sku: vesselSku,
                  price: resolveItemPrice(vesselSku),
                  copyable: true,
                  description: { "Product Category": "Vessel", Type: resolvedSinkType },
                },
                {
                  id: "basin-hcut-sku",
                  title: "HCUT - Basin",
                  subtitle: hcutPricingSku,
                  sku: hcutPricingSku,
                  price: hcutTotalPrice,
                  copyable: true,
                  description: {
                    "Product Category": "HCUT - Basin",
                    Type: "Vessel",
                    Quantity: sinkBaseCountForHcut,
                    "Pricing SKU": hcutPricingSku,
                  },
                },
              ],
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
    faucetHolesSpacing,
    grainDirection,
    bookMatching,
    handleGrooveColor,
    handleGrooveColorSku,
    productsPresets,
    productConfigs,
    cabinetColorSkuByName,
    handleGrooveColorSkuByName,
    countertopColorSkuByName,
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
        skuInches: convertSkuToInches(item.sku!),
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
    if (!hasSelectedSwatches && isSwatchesEnabledInSummary) {
      dispatch(setSwatchesEnabledInSummary(false));
    }
  }, [dispatch, hasSelectedSwatches, isSwatchesEnabledInSummary]);

  useEffect(() => {
    const configIdFromUrl = new URLSearchParams(location.search).get("configId");
    if (configIdFromUrl || generatedConfigId) return;

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

        const metadata = {
          path: location.pathname,
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
            DividersStyle: dividersStyle,
            TowelBarOption: towelBarOption,
            TowelBarColor: towelBarColor,
            FaucetHolesAmount: faucetHolesAmount,
            FaucetHolesSpacing: faucetHolesSpacing,
          },
        };

        const result = await saveConfiguration({ configuration, metadata }).unwrap();
        const nextConfigId = result?.id;
        if (!isCancelled && nextConfigId !== undefined && nextConfigId !== null) {
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
    dividersStyle,
    drawerPanelFluting,
    faucetHolesAmount,
    faucetHolesSpacing,
    generatedConfigId,
    grainDirection,
    handleGrooveColor,
    location.pathname,
    location.search,
    saveConfiguration,
    sidePanelsOption,
    sinkType,
    towelBarColor,
    towelBarOption,
  ]);

  const quoteModelName = useMemo(() => {
    const firstCabinetTitle = summarySections.find((section) => section.id === "cabinet")?.items[0]?.title;
    const normalized = (firstCabinetTitle ?? "Urban Standard").toUpperCase();
    const widthLabel = selectedDimensions.width ? ` - ${selectedDimensions.width}` : "";
    return `${normalized}${widthLabel}`;
  }, [summarySections, selectedDimensions.width]);

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
              <button
                type="button"
                className={s.editButton}
                aria-label={`Edit ${section.title}`}
                onClick={() => handleEditSection(section.id)}
              >
                <EditPenIcon />
              </button>
            </div>

            <div className={s.sectionList}>
              {section.items.map((item) => {
                return (
                  <div key={item.id} className={`${s.itemRow} ${!item.swatch ? s.noSwatch : ""}`}>
                    <div className={s.itemInfo}>
                      <span className={s.bullet}>
                        <img src={base_img} alt="#" />
                      </span>

                      <div className={s.itemTexts}>
                        <div className={s.itemTitle}>
                          {item.title}
                          {item.showInfo && item.description && (
                            <span
                              className={`${s.infoIcon} ${s.infoTooltip}`}
                              data-tooltip={buildInfoTooltip(item.description)}
                            >
                              <InformationIcon />
                            </span>
                          )}
                        </div>
                        {item.subtitle && <div className={s.itemSubtitle}>{item.subtitle}</div>}
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

          <p className={s.sectionHint}>We will add to your swatch cart with your selected finishes</p>

          <label className={s.addSwatches}>
            <input
              type="checkbox"
              checked={isSwatchesEnabledForSummary}
              disabled={!hasSelectedSwatches}
              onChange={(event) => dispatch(setSwatchesEnabledInSummary(event.target.checked))}
            />
            <span className={s.addLabel}>Add free swatches</span>
          </label>

          <div className={`${s.swatchesListHeader} ${!isSwatchesEnabledForSummary ? s.swatchesMuted : ""}`}>
            Swatches list
          </div>

          <div className={`${s.swatchesList} ${!isSwatchesEnabledForSummary ? s.swatchesMuted : ""}`}>
            {Array.from({ length: 6 }).map((_, index) => {
              const swatch = swatchesListPreview[index];
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
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <QuotePrintDocument
        summarySections={summarySections}
        previewImage={quotePreviewImage}
        modelName={quoteModelName}
        generatedDate={quoteGeneratedDate}
        configurationLink={configurationLink}
        isSwatchesEnabled={isSwatchesEnabledForSummary}
        swatchesPreview={swatchesListPreview}
      />
    </>
  );
};
