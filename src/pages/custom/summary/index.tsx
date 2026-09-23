import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { setSummarySkuJson } from "@/shared/lib/summarySkuStore";
import { buildInfoTooltip } from "@/shared/lib/buildInfoTooltip";
import { formatBasinStyle } from "@/shared/lib/formatBasinStyle";
import { buildMaterialLookup } from "@/shared/lib/buildMaterialLookup";
import { buildSummaryMaterialElements, materialSkuLabelMap } from "@/shared/lib/summaryMaterialElements";
import { copyTextToClipboard } from "@/shared/lib/copyTextToClipboard";

import { Hint } from "@/shared/ui/Hint/Hint";
import { EditPenIcon } from "@/shared/assets/images/svg/EditPenIcon";
import { InformationIcon } from "@/shared/assets/images/svg/InformationIcon";
import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight";
import { NestedDropdown, type DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { replacePlacedDividersForCabinet } from "@/entities/product/model/store/slice";
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
import { resolveCabinetDimensions } from "@/entities/configuration/model/identity";
import {
  getActiveProductProfile,
  getCabinetEntries,
  getDimensionsByCabinet,
} from "@/entities/configuration/model/store/selectors";
import dataMaterial from "@/shared/constants/DataMaterial.json";
import {
  SPECIAL_VARIANT_DISPLAY_IMAGE,
  SPECIAL_VARIANT_DISPLAY_VALUE,
  getConfiguratorVariantOverrides,
} from "@/entities/configurator/lib/getConfiguratorVariantOverrides";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import {
  resolveVesselDimensionTokens,
  formatVesselDimensionLabel,
  vesselHeightCmMap,
  TOWEL_BAR_DEFAULTS,
  SIDE_PANEL_WIDTH_CM,
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
import { useSaveConfigurationMutation } from "@/entities";
import { useActiveCollection } from "@/entities/collection";
import { useOptionLabel } from "@/features/collectionCustomization";
import { usePriceResult } from "@/shared/hooks/usePriceResult";
import { useSkuBuilders } from "@/shared/hooks/useSkuBuilders";
import {
  appendUncoveredLines,
  resolveSummaryLinePrice,
  type PricingLine,
  type SummaryPriceState,
} from "@/shared/lib/pricing";
import {
  calcTotalCountertopWidthCm,
  formatCountertopThicknessLabel,
} from "@/entities/countertop";
import { buildConfigurationShareUrl } from "@/features/saveConfiguration";
import { hashConfigurationRequest, useBuildConfigurationRequest } from "@/features/saveConfiguration";
import { trackModularOrderFreeSwatchesClick } from "@/shared/lib/analytics/modularKeyEvents";
import {
  findSyntesiCountertopUiValue,
  getAllowedVesselMaterialTokens,
  isSyntesiCountertopMaterialSku,
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
  resolveSwatchesSummaryState,
  setAutofillEnabled,
  setCartMaterials,
  setSwatchesEnabledInSummary,
  toSwatchPreview,
  MAX_SLOTS as MAX_SWATCHES,
  openSwatchOrder,
  type AutofillValueRequest,
} from "@/features/swatchOrder";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { collectPlacedDividersFromConfig } from "@/utils/functions/playcanvas/dividers";
import { QuotePrintDocument } from "@/features/quotePrint/ui/QuotePrintDocument";
import { printQuote } from "@/features/quotePrint/lib/printQuote";
import { captureQuotePreviewImage } from "@/features/quotePrint/lib/captureQuotePreviewImage";
import { formatQuoteGeneratedDate } from "@/features/quotePrint/lib/formatQuoteGeneratedDate";
import {
  resolveQuoteConfigurationId,
  type QuoteConfigurationLinkStatus,
} from "@/features/quotePrint/lib/quoteConfiguration";
import {
  convertSkuToInchesForSummary,
  formatCabinetSubtitleForSummary,
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
import { useCollectionNavigate, useStepPathById } from "@/features/collectionCustomization";

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

const INCLUDED_IN_COUNTERTOP_PRICE_LABEL = "Included in Countertop";

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
    materialSku?: string | null;
  };
  price: string;
  priceLabel?: string;
  priceState?: SummaryPriceState;
  /** Order lines the item shows (D02). */
  lineIds?: string[];
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

const SIDE_PANEL_SUMMARY_DEPTH_MAP: Record<number, number> = {
  46: 45.5,
  50.5: 50,
};

// Maps a summary `section.id` to the Threekit parent group name the section's
// swatch values originate from. Used to disambiguate variants that share the
// same `value` across multiple Threekit groups (e.g. "Aragosta 77 MT" present
// in both Cabinet Color and Countertop Color groups).
const inferSummarySectionParentName = (sectionId: string): string | undefined => {
  if (sectionId === "color" || sectionId.startsWith("cabinet")) return "Cabinet Color";
  if (sectionId.startsWith("countertop")) return "Countertop Color";
  if (sectionId.startsWith("basin")) return "Vessels";
  if (sectionId.startsWith("accessories-side-panel")) return "Cabinet Color";
  if (sectionId.startsWith("accessories-towel-bar")) return "Towel Bar Color";
  return undefined;
};

const getSummarySwatchPreferredMaterialTokens = (
  preferredParentName: string | undefined,
  materialSku?: string | null,
): string[] | undefined => {
  if (preferredParentName !== "Countertop Color" && preferredParentName !== "Vessels") return undefined;
  const tokens = getCountertopMaterialTokensBySku(materialSku);
  return tokens.length ? tokens : undefined;
};

const normalizeSidePanelSummaryDepth = (value: number | null): number | null => {
  if (value === null) return null;
  const rounded = Math.round(value * 10) / 10;
  return SIDE_PANEL_SUMMARY_DEPTH_MAP[rounded] ?? value;
};

export const CustomSummaryPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useCollectionNavigate();
  const location = useLocation();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [quotePreviewImage, setQuotePreviewImage] = useState<string>("");
  const [openEditMenuSectionId, setOpenEditMenuSectionId] = useState<string | null>(null);
  const editMenuRef = useRef<HTMLDivElement | null>(null);
  const lastSavedHashRef = useRef<string | null>(null);
  const stepPathById = useStepPathById("custom");
  const editPathBySectionId = useMemo<Record<string, string>>(() => {
    const entries: Array<[string, string | undefined]> = [
      ["cabinet", stepPathById["cabinet-colors"]],
      ["cabinet-options", stepPathById["cabinet-colors"]],
      ["countertop", stepPathById["countertop-custom"]],
      ["basin", stepPathById["countertop-custom"]],
      ["accessories", stepPathById["accessories-custom"]],
      ["faucet", stepPathById["faucet-holes"]],
    ];
    return Object.fromEntries(entries.filter((entry): entry is [string, string] => Boolean(entry[1])));
  }, [stepPathById]);

  const buildConfigurationRequest = useBuildConfigurationRequest();
  const priceResult = usePriceResult();
  const productsPresets = useAppSelector(getProductsPresets);
  const hasBootstrappedCabinetBuilder = useAppSelector(getHasBootstrappedCabinetBuilder);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const cabinetEntries = useAppSelector(getCabinetEntries);
  const dimensionsByCabinet = useAppSelector(getDimensionsByCabinet);

  const selectedProductConfig = useAppSelector(getSelectedProductConfig);

  const activeCabinetType = useAppSelector(getActiveCabinetType);
  const cabinetColor = useAppSelector(getCabinetColor);
  const activeProfile = useAppSelector(getActiveProductProfile);
  const labelOf = useOptionLabel();
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
  const activePlacedDividers = placedDividers;
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
  const [configurationLinkStatus, setConfigurationLinkStatus] =
    useState<QuoteConfigurationLinkStatus>("idle");
  const [saveConfiguration] = useSaveConfigurationMutation();
  const quoteConfigurationId = useMemo(
    () => resolveQuoteConfigurationId(location.search, generatedConfigId),
    [generatedConfigId, location.search],
  );

  const handleCopy = async (text: string, id: string) => {
    const isCopied = await copyTextToClipboard(text);
    if (!isCopied) return;

    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1500);
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
  const handleOrderSummarySwatches = useCallback(() => {
    trackModularOrderFreeSwatchesClick({
      cta_location: "summary_view",
      configurator_flow: "custom",
      product_element: "Swatches",
    });
    handleEditSection("swatches");
  }, [handleEditSection]);

  const handleCabinetEditMenuNavigate = useCallback(
    (path: string) => {
      setOpenEditMenuSectionId(null);
      navigate(path);
    },
    [navigate],
  );

  const cabinetEditMenuItems = useMemo<DropdownItem[]>(() => {
    const items: Array<{ id: string; label: string; path: string | undefined }> = [
      { id: "cabinet-builder", label: "Cabinet Builder", path: stepPathById["cabinet-builder"] },
      { id: "color", label: "Color", path: stepPathById["cabinet-colors"] },
    ];

    return items.flatMap(({ id, label, path }) =>
      path
        ? [{ id, label, trailing: <ArrowTopRight color="#333" />, onClick: () => handleCabinetEditMenuNavigate(path) }]
        : [],
    );
  }, [handleCabinetEditMenuNavigate, stepPathById]);

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

  const configuratorGroups = useActiveCollection((collection) => collection.catalog.configurator.groups);
  const countertopRules = useCountertopRules();

  const { cabinetColorSkuByName, handleGrooveColorSkuByName, countertopColorSkuCandidatesByValue } = useMemo(() => {
    const groups = configuratorGroups;
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
  }, [configuratorGroups]);

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
          if (config) {
            const dividers = collectPlacedDividersFromConfig(id, config);
            dispatch(
              replacePlacedDividersForCabinet({
                cabinetId: id,
                dividers,
              }),
            );
          }

          return config
            ? normalizeProductConfigSnapshot({
                id,
                raw: config as Record<string, unknown>,
                recordedDimensions: resolveCabinetDimensions(cabinetEntries, dimensionsByCabinet, id),
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
  }, [dispatch, selectedDimensions, selectedProducts, cabinetEntries, dimensionsByCabinet]);

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
    if (!quoteConfigurationId && configurationLinkStatus !== "settled") return;
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
  }, [configurationLinkStatus, location.search, location.pathname, navigate, quoteConfigurationId]);

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
        },
        {
          productElement: "Handle",
          materialSku: isShelfCabinet ? null : opts.hdlMaterialSku,
          colorCode: opts.hdlColor,
        },
      ]);
      return {
        "Product Category": "Vanity",
        Products: "Urban Standard",
        "Cabinet Type": opts.cabinetType ? labelOf("CabinetType", opts.cabinetType) : "Unknown",
        "Cabinet Style": isShelfCabinet ? null : opts.drawers ? labelOf("Drawers", opts.drawers) : "Unknown",
        "Handle Style": isShelfCabinet ? null : opts.handle ? labelOf("Handle", opts.handle) : "Unknown",
        "Drawer Panel Fluting": opts.pattern || "None",
        Width: opts.width,
        Height: opts.height,
        Depth: opts.depth,
        elements,
      };
    },
    [labelOf],
  );

  const skuBuilders = useSkuBuilders();
  const summarySections: SummarySection[] = useMemo(() => {
    const { lines: pricingLines, lineById, priceOf } = priceResult;
    // SKU and price come from the order lines (D02); `pieces` is how many of the line one item stands for.
    const priceOfLines = (itemLines: ReadonlyArray<PricingLine | null>, pieces = 1) =>
      resolveSummaryLinePrice(itemLines.flatMap((line) => (line ? [{ line, entry: priceOf(line.sku), pieces }] : [])));
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
    // Every priced scene product, open shelves included — the same products the order lines have.
    const configCabinetItems = sceneProductConfigs.map((config, index) => {
      const width = typeof config.Width === "number" ? config.Width : undefined;
      const depth = typeof config.Depth === "number" ? config.Depth : undefined;
      const height = typeof config.Height === "number" ? config.Height : undefined;
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
      const subtitle = formatCabinetSubtitleForSummary({
        cabinetType: productCabinetType,
        drawers: config.Drawers,
        width,
        depth,
        height,
      });
      const cabinetMaterialSku = resolveCabinetMaterialSku(swatchValue);

      return {
        id: `cabinet-config-${index}`,
        title: formatCabinetTitleForSummary(name ?? activeCabinetType),
        subtitle,
        ...priceOfLines([lineById(`cabinet:${config.id}`)]),
        swatch: {
          label: "Cabinet",
          value: swatch.value,
          color: swatch.color,
          image: swatch.image,
          materialSku: cabinetMaterialSku,
        },
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
          const recordedDimensions = resolveCabinetDimensions(cabinetEntries, dimensionsByCabinet, selectedProducts[index]);
          const presetHeight = recordedDimensions?.height ?? preset.Height ?? undefined;
          const presetDepth = recordedDimensions?.depth ?? preset.Depth ?? undefined;
          const swatchValue = preset.CabinetColor ?? cabinetColor;
          const swatch = resolveSwatch(swatchValue);
          const cabinetMaterialSku = resolveCabinetMaterialSku(swatchValue);

          const handleMaterialSku = handleGrooveColorSku || handleGrooveColorSkuByName.get(handleGrooveColor) || null;
          const normalizedPresetType = preset.name ? preset.name.replace(/[\s_]+/g, "-") : null;
          const subtitle = formatCabinetSubtitleForSummary({
            cabinetType: normalizedPresetType ?? activeCabinetType,
            drawers: preset.Drawers,
            width: preset.Width,
            depth: presetDepth,
            height: presetHeight,
          });
          const resolvedHandle = (selectedProductConfig?.Handle as string | undefined) || preset.Handle || null;

          return {
            id: `cabinet-preset-${index}`,
            title: formatCabinetTitleForSummary(preset.name ?? activeCabinetType),
            subtitle,
            ...priceOfLines([lineById(`cabinet:preset-${index}`)]),
            swatch: {
              label: "Cabinet",
              value: swatch.value,
              color: swatch.color,
              image: swatch.image,
              materialSku: cabinetMaterialSku,
            },
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

        const fallbackCabinetType =
          typeof selectedProductConfig?.name === "string" ? selectedProductConfig.name : activeCabinetType;

        return {
          id: "cabinet-1",
          title: formatCabinetTitleForSummary(fallbackCabinetType),
          subtitle: formatCabinetSubtitleForSummary({
            cabinetType: fallbackCabinetType,
            drawers: selectedProductConfig?.Drawers,
            width: selectedDimensions.width,
            depth: selectedDimensions.depth,
            height: selectedDimensions.height,
            withFallback: true,
          }),
          ...priceOfLines([lineById("cabinet:selected")]),
          swatch: {
            ...resolveSwatch(cabinetColor),
            label: "Cabinet",
            value: cabinetColor,
            materialSku: cabinetMaterialSku,
          },
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
          ...sceneProductConfigs.flatMap((config, index) => {
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
      : sceneProductConfigs.length > 0
        ? sceneProductConfigs.flatMap((config, index) => {
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
    const syntesiMaterial = activeProfile?.ruleData.syntesi?.material ?? null;
    const isSyntesiCountertop =
      syntesiMaterial !== null &&
      (isSyntesiCountertopMaterialSku(resolvedCountertopMaterialSku, activeProfile) ||
        normalizeMaterialToken(resolvedSinkType ?? "").includes(normalizeMaterialToken(syntesiMaterial)));
    const displayCountertopColor = isSyntesiCountertop
      ? (findSyntesiCountertopUiValue(countertopColor, activeProfile) ??
        findSyntesiCountertopUiValue(resolvedCountertopColor, activeProfile) ??
        resolvedCountertopColor)
      : resolvedCountertopColor;
    const displayCountertopLabel = isSyntesiCountertop ? `${syntesiMaterial} Countertop` : "Countertop";
    const displayCountertopMaterial = isSyntesiCountertop
      ? syntesiMaterial
      : resolvedCountertopMaterialSku
        ? (materialSkuLabelMap[resolvedCountertopMaterialSku] ?? resolvedCountertopMaterialSku)
        : null;
    const resolvedVesselColor = vesselColor;
    const vesselTypeForTokens = resolvedSinkType?.startsWith("Vessel_") ? resolvedSinkType : null;
    const allowedVesselMaterialTokens = vesselTypeForTokens
      ? Array.from(getAllowedVesselMaterialTokens(vesselTypeForTokens, activeProfile) ?? [])
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
      profile: activeProfile,
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
      profile: activeProfile,
      skuProfile: skuBuilders.profile,
    });

    const bookMatchingLine = lineById("bookMatching");
    const bookMatchingItem: SummaryItem | null =
      bookMatchingInfo.applies && bookMatchingInfo.sku
        ? (() => {
            return {
              id: "cabinet-option-book-matching",
              title: "Book Matching",
              subtitle: bookMatchingInfo.direction === "H" ? "Horizontal" : "Vertical",
              ...priceOfLines([bookMatchingLine], bookMatchingLine?.quantity),
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
    // The top is priced for the width of the whole composition, open shelves included.
    const countertopTopLine = lineById("countertop:0");
    const totalCountertopWidth =
      countertopTopLine?.widthCm ?? calcTotalCountertopWidthCm(cabinetWidthSum, sidePanelLeft, sidePanelRight);

    const vesselType = resolvedSinkType?.startsWith("Vessel_") ? resolvedSinkType : null;
    const vesselLine = lineById("vessel");
    const vesselDimensionTokens = vesselType
      ? resolveVesselDimensionTokens({
          vesselType,
          width: totalCountertopWidth,
          height: vesselHeightCmMap[vesselType] ?? null,
          depth: selectedDimensions.depth,
        })
      : null;
    const basinStyleLabel = formatBasinStyle(resolvedSinkType);

    const basinItem = (id: string, basinType: string | null) => ({
      id,
      title: "Basin",
      subtitle: formatBasinStyle(basinType) ?? undefined,
      copyable: true,
      showInfo: true,
      description: {
        "Product Category": "Basin",
        ...(basinType ? { "Basin Style": formatBasinStyle(basinType) } : {}),
      },
    });
    // A basin per sink base, as ordered; each line names the sink base entry it belongs to.
    const basinItems: SummaryItem[] = pricingLines
      .filter(({ group }) => group === "basin")
      .flatMap((line) => {
        const entryId = line.id.startsWith("countertop:basin:") ? line.id.slice("countertop:basin:".length) : null;
        const basinType = (entryId ? sinkBaseEntries.find(({ id }) => id === entryId)?.sinkType : null) ?? resolvedSinkType;
        return Array.from({ length: line.quantity }, (_, index) => ({
          ...basinItem(`countertop-${line.id}-${index}`, basinType),
          ...priceOfLines([line]),
        }));
      });
    // A Syntesi basin is part of the countertop price: shown, but not an order line.
    const syntesiBasinItems: SummaryItem[] =
      isSyntesiCountertop && !isVesselCountertop
        ? sinkBaseEntries.flatMap((entry, index) => {
            const sku = skuBuilders.buildCountertopSkuIfComplete({
              style: countertopStyle || null,
              width: totalCountertopWidth,
              depth: selectedDimensions.depth,
              thickness: resolvedCountertopThickness,
              basinType: entry.sinkType || null,
              faucetHolesAmount: faucetHolesAmount || null,
              countertopMaterialSku: effectiveCountertopMaterialSku,
              countertopColorCode: effectiveCountertopColorCode,
            })[1];
            return sku
              ? [
                  {
                    ...basinItem(`countertop-basin-${entry.id}-${index}`, entry.sinkType),
                    sku,
                    price: "$0",
                    priceLabel: INCLUDED_IN_COUNTERTOP_PRICE_LABEL,
                  },
                ]
              : [];
          })
        : [];
    const vesselCutoutItems: SummaryItem[] = pricingLines
      .filter(({ group }) => group === "holeCut")
      .flatMap((line) =>
        Array.from({ length: line.quantity }, (_, index) => ({
          id: `countertop-${line.id}-${index}`,
          title: "Vessel Cutout",
          subtitle: basinStyleLabel ?? undefined,
          ...priceOfLines([line]),
          copyable: true,
          showInfo: true,
          description: {
            Countertop: "Vessel Cutout",
            ...(resolvedSinkType ? { "Basin Style": basinStyleLabel } : {}),
          },
        })),
      );

    const countertopItems: SummaryItem[] = [
      // Main countertop item with swatch
      {
        id: "countertop-1",
        title: "Countertop",
        subtitle: displayCountertopThickness ?? undefined,
        ...priceOfLines([countertopTopLine]),
        swatch: {
          label: displayCountertopLabel,
          value: displayCountertopColor,
          color: countertopSwatch.color,
          image: countertopSwatch.image,
          materialSku: effectiveCountertopMaterialSku,
        },
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
      ...basinItems,
      ...syntesiBasinItems,
      ...vesselCutoutItems,
    ].filter(Boolean) as SummaryItem[];

    const dividerItems: SummaryItem[] = (() => {
      if (activePlacedDividers.length > 0) {
        return activePlacedDividers.map((divider, index) => {
          const style = labelOf("DividersStyle", divider.type);
          const line = lineById(`divider:${divider.cabinetId}:${index}`);
          return {
            id: `accessories-dividers-${divider.key}-${index}`,
            title: "Dividers",
            subtitle: style ?? undefined,
            ...priceOfLines([line]),
            copyable: Boolean(line),
            showInfo: true,
            description: { "Product Category": "Divider", "Divider Style": style },
          };
        });
      }

      return [];
    })();

    // Towel bar full product SKUs
    const towelMaterialSku = "LACM";
    const towelBarRightLine = lineById("towelBar:right");
    const towelBarLeftLine = lineById("towelBar:left");

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
      // One line for all active sides; each side is one piece of it.
      const sidePanelLine = lineById("sidePanel");
      const sidePanelMaterialElements = buildSummaryMaterialElements([
        {
          productElement: "Cabinet",
          materialSku: sidePanelCabinetMaterialSku,
          colorCode: cabinetColor,
        },
        {
          productElement: "Handle",
          materialSku: handleMaterialSku,
          colorCode: handleGrooveColor,
        },
      ]);
      const sidePanelCabinetSwatch = resolveSwatch(cabinetColor);

      const activeSides: Array<{ side: "left" | "right"; label: string }> = [];
      if (sidePanelLeft === "active") activeSides.push({ side: "left", label: "Side Panel Left" });
      if (sidePanelRight === "active") activeSides.push({ side: "right", label: "Side Panel Right" });

      activeSides.forEach(({ side, label }) => {
        if (!sidePanelLine) return;
        sidePanelSkuItems.push({
          id: `accessories-side-panel-${side}`,
          title: label,
          subtitle: labelOf("SidePanels", sidePanelsOption),
          ...priceOfLines([sidePanelLine]),
          swatch: cabinetColor
            ? {
                label: "Cabinet",
                value: cabinetColor,
                color: sidePanelCabinetSwatch.color,
                image: sidePanelCabinetSwatch.image,
                materialSku: sidePanelCabinetMaterialSku,
              }
            : undefined,
          copyable: true,
          showInfo: true,
          description: {
            "Product Category": "Side Panel",
            "Panel Type": labelOf("SidePanels", sidePanelsOption),
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
      towelBarRightLine
        ? {
            id: "accessories-towel-bar-right",
            title: "Towel Bar Right",
            subtitle: towelBarColor || undefined,
            ...priceOfLines([towelBarRightLine]),
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
      towelBarLeftLine
        ? {
            id: "accessories-towel-bar-left",
            title: "Towel Bar Left",
            subtitle: towelBarColor || undefined,
            ...priceOfLines([towelBarLeftLine]),
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

    // Faucet holes are priced like any other line: one item for all of their lines.
    const faucetLines = pricingLines.filter(({ group }) => group === "faucetHoles");
    const faucetItems: SummaryItem[] =
      faucetHolesAmount || faucetLines.length > 0
        ? [
            {
              id: "faucet-holes-amount",
              title: "Faucet Holes",
              subtitle: faucetHolesAmount || "0",
              ...priceOfLines(faucetLines),
              copyable: faucetLines.length > 0,
            },
          ]
        : [];

    const sections: SummarySection[] = [
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
      ...(vesselLine
        ? [
            {
              id: "basin",
              title: "Vessel",
              items: Array.from({ length: vesselLine.quantity }, (_, index) => ({
                id: `basin-vessel-sku-${index}`,
                title: "Vessel",
                subtitle: basinStyleLabel ?? "Vessel",
                ...priceOfLines([vesselLine]),
                swatch: vesselSwatch
                  ? {
                      label: "Vessel",
                      value: vesselSwatch.value,
                      color: vesselSwatch.color,
                      image: vesselSwatch.image,
                      materialSku: resolvedVesselMaterialSku,
                    }
                  : undefined,
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

    appendUncoveredLines(sections, pricingLines, priceOf);
    return sections;
  }, [
    labelOf,
    skuBuilders,
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
    cabinetEntries,
    dimensionsByCabinet,
    selectedProductConfig,
    sidePanelsOption,
    sidePanelLeft,
    sidePanelRight,
    sinkType,
    towelBarColor,
    activePlacedDividers,
    placedCabinetStyles,
    priceResult,
    resolveSwatch,
    buildCabinetDescription,
    activeProfile,
  ]);

  const fullSkuJson = useMemo(() => {
    return summarySections
      .flatMap((section) => section.items)
      .filter((item) => item.sku && item.copyable)
      .map((item) => ({
        sku: item.sku,
        skuInches: convertSkuToInchesForSummary(item.sku!, skuBuilders.profile),
        description: item.description ?? {},
      }));
  }, [skuBuilders.profile, summarySections]);

  useEffect(() => {
    setSummarySkuJson(fullSkuJson);
  }, [fullSkuJson]);

  useEffect(
    () => () => {
      setSummarySkuJson([]);
    },
    [],
  );

  useEffect(() => {
    const configIdFromUrl = resolveQuoteConfigurationId(location.search, null);
    if (configIdFromUrl) {
      setConfigurationLinkStatus("settled");
      return;
    }

    let isCancelled = false;

    const run = async () => {
      setConfigurationLinkStatus("pending");

      try {
        const request = await buildConfigurationRequest();

        if (!request) {
          if (!isCancelled) {
            setConfigurationLinkStatus("settled");
          }
          return;
        }

        // Hashing ignores `savedAt`; including it made the guard never match, so the
        // same configuration was saved again on every run of this effect.
        const snapshotHash = hashConfigurationRequest(request);
        if (lastSavedHashRef.current === snapshotHash) return;

        const result = await saveConfiguration(request).unwrap();
        if (isCancelled) return;
        lastSavedHashRef.current = snapshotHash;
        const nextConfigId = result?.id;
        if (nextConfigId !== undefined && nextConfigId !== null) {
          setGeneratedConfigId(String(nextConfigId));
        }
      } catch (error) {
        console.error("[Summary Share] Failed to generate configuration link", error);
      } finally {
        if (!isCancelled) {
          setConfigurationLinkStatus("settled");
        }
      }
    };

    run();

    return () => {
      isCancelled = true;
    };
  }, [
    buildConfigurationRequest,
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
    vesselColor,
    bookMatching,
    selectedMaterials,
    manualSelectedMaterials,
    isAutofillEnabled,
    hasSubmittedCart,
  ]);

  const quoteModelName = useActiveCollection((collection) => collection.manifest.label);

  const swatchOrderData = useMemo(
    () => adaptThreekitConfig(configuratorGroups, { countertopRules, profile: activeProfile }),
    [configuratorGroups, countertopRules, activeProfile],
  );
  const summaryAutofillValues = useMemo<AutofillValueRequest[]>(() => {
    const requests: AutofillValueRequest[] = [];
    summarySections.forEach((section) => {
      const preferredParentName = inferSummarySectionParentName(section.id);
      section.items.forEach((item) => {
        if (item.swatch?.value) {
          requests.push({
            value: item.swatch.value,
            preferredParentName,
            preferredMaterialTokens: getSummarySwatchPreferredMaterialTokens(
              preferredParentName,
              item.swatch.materialSku,
            ),
          });
        }
      });
    });
    requests.push(
      { value: handleGrooveColor, preferredParentName: "Handle Groove Color" },
      { value: towelBarColor, preferredParentName: "Towel Bar Color" },
      { value: vesselColor, preferredParentName: "Vessels" },
    );
    return requests;
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
    if (quoteConfigurationId) {
      return buildConfigurationShareUrl(quoteConfigurationId);
    }
    return `${window.location.origin}${location.pathname}${location.search}`;
  }, [location.pathname, location.search, quoteConfigurationId]);

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
                          <div className={s.swatchValue}>
                            {item.swatch.materialSku
                              ? `${item.swatch.materialSku} | ${item.swatch.value}`
                              : item.swatch.value}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className={s.price}>
                      {item.priceLabel ? (
                        item.priceLabel
                      ) : item.priceState === "loading" ? (
                        <span className={s.priceSpinner} />
                      ) : item.priceState === "missing" ? (
                        <span title="Price not available">—</span>
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

            <div className={s.swatchesListHeader}>
              <span>Swatches list</span>
              <span className={s.swatchesListFree}>Free</span>
            </div>

            <div className={s.swatchesListRow}>
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

                  const tooltipLabel = swatch.materialLabel
                    ? `${swatch.label} ${swatch.materialLabel}`
                    : swatch.label;

                  return (
                    <div key={swatch.identity} className={s.swatchTile}>
                      <span
                        className={s.tileColor}
                        style={{
                          backgroundColor: swatch.color,
                          backgroundImage: swatch.image ? `url(${swatch.image})` : undefined,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                        tabIndex={0}
                        aria-label={tooltipLabel}
                        aria-describedby={`summary-swatch-tooltip-${index}`}
                      />
                      <span id={`summary-swatch-tooltip-${index}`} className={s.tileTooltip} role="tooltip">
                        <span>{swatch.label}</span>
                        {swatch.materialLabel && <span className={s.tileTooltipAcronym}>{swatch.materialLabel}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>

              <button type="button" className={s.orderSwatchesButton} onClick={handleOrderSummarySwatches}>
                Order Swatches
              </button>
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
        configurationId={quoteConfigurationId}
        totalPrice={priceResult.total}
      />
    </>
  );
};
