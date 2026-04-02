import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  getActiveCabinetType,
  getSelectedDimensions,
  getSelectedProductConfig,
  getSelectedProducts,
  getCabinetColor,
  getCabinetColorSku,
  getHandleGrooveColor,
  getHandleGrooveColorSku,
  getActiveCountertopColor,
  getCountertopColorSku,
  getVesselColor,
  getActiveCountertopThickness,
  getCountertopStyle,
  getSinkType,
  getDrawerPanelFluting,
  getGrainDirection,
  getBookMatching,
  getProductsPresets,
  getTowelBarOption,
  getTowelBarColor,
  getFaucetHolesAmount,
  getFaucetHolesSpacing,
  getSidePanelsOption,
  getDividersStyle,
  getCabinetCatalog,
  getPlacedDividers,
} from "@/entities/product/model/store/selectors";
import {
  buildProductSku,
  buildCountertopSku,
  buildVesselSku,
  vesselHeightCmMap,
  buildTowelBarSku,
  buildSidePanelSku,
  buildDividerSku,
  buildOpenShelfSku,
  buildOpenSideShelfSku,
  buildBookMatchingSku,
  TOWEL_BAR_DEFAULTS,
  SIDE_PANEL_WIDTH_CM,
  extractColorCode,
  resolveDefaultBasinByCountertopColor,
} from "@/shared/lib/sku";
import { useGetConfiguratorQuery } from "@/entities";
import { useGetCountertopDatatableQuery } from "@/entities/countertop";
import { normalizeMaterialToken, parseCountertopMatrix, resolveDefaultThicknessFromRules } from "@/features/configurator-rule-core/countertop";
import {
  useLazyGetProductPriceBySkuQuery,
  useLazyGetProductPriceBySkuV2ResolveQuery,
} from "@/entities/product/api";
import { setActiveSkus, setPriceLoading, setSkuPrices } from "@/entities/product/model/store/priceStore";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { getDimensionTool } from "@/utils/functions/playcanvas/getDimensionTool";

// ── Price response helpers ──────────────────────────────

const parsePriceValue = (value: string | number) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = value.replace(/[^0-9.-]+/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolvePriceFromResponse = (data?: Record<string, unknown>) => {
  if (!data) return null;

  const candidates = ["price", "Price", "total", "Total", "amount", "Amount", "value", "Value"];

  for (const key of candidates) {
    const value = data[key];
    if (typeof value === "number") return parsePriceValue(value);
    if (typeof value === "string" && value.trim()) return parsePriceValue(value);
  }
  return null;
};

// ── Types ────────────────────────────────────────────────

type ProductConfigSnapshot = {
  id: string;
  name: string | null;
  Width: number | null;
  Height: number | null;
  Depth: number | null;
  Thickness: string | null;
  Drawers: string | null;
  Handle: string | null;
  CabinetColor: string | null;
};

// ── Hook ────────────────────────────────────────────────

const DEBOUNCE_MS = 300;
const LOG_PREFIX = "[SKU/Price]";
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

export function usePriceCalculation() {
  const dispatch = useAppDispatch();
  const [triggerPriceBySku] = useLazyGetProductPriceBySkuQuery();
  const [triggerPriceBySkuV2Resolve] = useLazyGetProductPriceBySkuV2ResolveQuery();

  // ── Read all relevant state ───────────────────────────

  const activeCabinetType = useAppSelector(getActiveCabinetType);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const productIds = useAppSelector(getSelectedProducts);

  const cabinetColor = useAppSelector(getCabinetColor);
  const cabinetColorSku = useAppSelector(getCabinetColorSku);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const handleGrooveColorSku = useAppSelector(getHandleGrooveColorSku);

  const countertopColor = useAppSelector(getActiveCountertopColor);
  const countertopColorSku = useAppSelector(getCountertopColorSku);
  const vesselColor = useAppSelector(getVesselColor);
  const countertopThickness = useAppSelector(getActiveCountertopThickness);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const sinkType = useAppSelector(getSinkType);

  const productsPresets = useAppSelector(getProductsPresets);

  const drawerPanelFluting = useAppSelector(getDrawerPanelFluting);

  const grainDirection = useAppSelector(getGrainDirection);
  const grainSku = grainDirection === "GrainHorizontal" ? "H" : grainDirection === "GrainVertical" ? "V" : null;
  const bookMatching = useAppSelector(getBookMatching);

  const towelBarOption = useAppSelector(getTowelBarOption);
  const towelBarColor = useAppSelector(getTowelBarColor);

  const faucetHolesAmount = useAppSelector(getFaucetHolesAmount);
  const faucetHolesSpacing = useAppSelector(getFaucetHolesSpacing);

  const sidePanelsOption = useAppSelector(getSidePanelsOption);
  const dividersStyle = useAppSelector(getDividersStyle);
  const placedDividers = useAppSelector(getPlacedDividers);

  const cabinetCatalog = useAppSelector(getCabinetCatalog);

  /** Resolve a PlayCanvas product name (e.g. "SinkBase60") → catalog code ("Sink-Base") */
  const resolveCabinetType = useCallback(
    (productName: string | null): string | null => {
      if (!productName) return null;
      const normalized = normalizeCabinetToken(productName);
      const match = cabinetCatalog.typeCabinetRules.find((rule) =>
        normalized.includes(normalizeCabinetToken(rule.code)),
      );
      return match?.code ?? null;
    },
    [cabinetCatalog.typeCabinetRules],
  );

  // ── Fetch configs for all products on scene (custom path) ─

  const [sceneConfigs, setSceneConfigs] = useState<ProductConfigSnapshot[]>([]);
  const productIdsKey = productIds.join("|");

  const fetchSceneConfigs = useCallback(async () => {
    console.log(LOG_PREFIX, "fetchSceneConfigs called", {
      productIds,
      presetsCount: productsPresets.length,
    });

    // When presets exist the bootstrap phase calls addProductId for each preset product first.
    // Only products whose index is >= presetsCount are truly "extra" (added via sidebar).
    const idsToFetch = productsPresets.length > 0 ? productIds.slice(productsPresets.length) : productIds;

    if (idsToFetch.length === 0) {
      console.log(
        LOG_PREFIX,
        "fetchSceneConfigs skipped:",
        productsPresets.length > 0 ? "using presets, no extra products" : "no productIds",
      );
      setSceneConfigs([]);
      return;
    }

    const configs: ProductConfigSnapshot[] = [];
    const dimensionTool = getDimensionTool();
    const readDimValue = (map?: Record<string, string>) => {
      if (!map) return null;
      const [key] = Object.keys(map);
      if (!key) return null;
      const value = Number(key);
      return Number.isFinite(value) ? value : null;
    };

    for (const id of idsToFetch) {
      try {
        const raw = await getConfig(id);

        if (!raw) continue;

        const cfg = raw as Record<string, unknown>;
        const dimensionData = dimensionTool?.getDimensionData?.(id) ?? null;
        const toolWidth = readDimValue(dimensionData?.Width as Record<string, string> | undefined);
        const toolHeight = readDimValue(dimensionData?.Height as Record<string, string> | undefined);
        const toolDepth = readDimValue(dimensionData?.Depth as Record<string, string> | undefined);

        configs.push({
          id,
          name:
            (typeof cfg.ProductType === "string" && cfg.ProductType) ||
            (typeof cfg.productType === "string" && cfg.productType) ||
            (typeof cfg.type === "string" && cfg.type) ||
            (typeof cfg.name === "string" && cfg.name) ||
            null,
          Width: (typeof cfg.Width === "number" ? cfg.Width : null) ?? toolWidth,
          Height: selectedDimensions.height ?? toolHeight ?? (typeof cfg.Height === "number" ? cfg.Height : null),
          Depth: selectedDimensions.depth ?? toolDepth ?? (typeof cfg.Depth === "number" ? cfg.Depth : null),
          Thickness: typeof cfg.Thickness === "string" ? cfg.Thickness : null,
          Drawers: typeof cfg.Drawers === "string" ? cfg.Drawers : null,
          Handle: typeof cfg.Handle === "string" ? cfg.Handle : null,
          CabinetColor: typeof cfg.CabinetColor === "string" ? cfg.CabinetColor : null,
        });
      } catch (err) {
        console.warn(LOG_PREFIX, "Failed to get config for product", id, err);
      }
    }

    setSceneConfigs(configs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    productIdsKey,
    productsPresets.length,
    selectedDimensions.width,
    selectedDimensions.height,
    selectedDimensions.depth,
  ]);

  useEffect(() => {
    fetchSceneConfigs();
  }, [fetchSceneConfigs]);

  // ── colorSkuByName from configurator API (cached by RTK Query) ─

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

  // ── Guard: minimum data required ──────────────────────

  const hasPresets = productsPresets.length > 0;
  const hasSceneConfigs = sceneConfigs.length > 0;
  const shouldUsePresets = hasPresets;
  const canCalculate = shouldUsePresets ? true : hasSceneConfigs ? true : selectedDimensions.width !== null;

  // ── Build all current SKUs ────────────────────────────

  const currentSkus = useMemo(() => {
    if (!canCalculate) return [];

    const skus: string[] = [];
    const handleMaterialSku = handleGrooveColorSku || handleGrooveColorSkuByName.get(handleGrooveColor) || null;
    const firstPreset = productsPresets[0];
    const resolveCabinetMaterialSku = (swatchValue?: string | null) =>
      (swatchValue ? cabinetColorSkuByName.get(swatchValue) : null) ||
      cabinetColorSku ||
      cabinetColorSkuByName.get(cabinetColor) ||
      null;
    const shouldUsePresetCountertopColor =
      shouldUsePresets && countertopColor === DEFAULT_COUNTERTOP_COLOR && Boolean(firstPreset?.CountertopColor);
    const shouldUsePresetSinkType =
      shouldUsePresets && sinkType === DEFAULT_SINK_TYPE && Boolean(firstPreset?.sinkType);
    const resolvedCountertopColor = shouldUsePresetCountertopColor
      ? (firstPreset?.CountertopColor as string)
      : countertopColor;
    const resolvedCountertopMaterialSku =
      countertopColorSku ||
      (resolvedCountertopColor ? countertopColorSkuByName.get(resolvedCountertopColor) : null) ||
      countertopColorSkuByName.get(countertopColor) ||
      null;
    const resolvedVesselColor = vesselColor || resolvedCountertopColor;
    const resolvedVesselMaterialSku =
      (resolvedVesselColor ? countertopColorSkuByName.get(resolvedVesselColor) : null) || resolvedCountertopMaterialSku;
    const useVesselMaterialForCountertopSku = (countertopStyle || "").trim().toLowerCase() === "vessel";
    const effectiveCountertopMaterialSku = useVesselMaterialForCountertopSku
      ? resolvedVesselMaterialSku
      : resolvedCountertopMaterialSku;
    const effectiveCountertopColorCode = extractColorCode(
      useVesselMaterialForCountertopSku ? resolvedVesselColor : resolvedCountertopColor,
    );
    const colorDrivenDefaultBasin = resolveDefaultBasinByCountertopColor(resolvedCountertopColor);
    const resolvedSinkType =
      shouldUsePresetSinkType && colorDrivenDefaultBasin
        ? colorDrivenDefaultBasin
        : shouldUsePresetSinkType
          ? (firstPreset?.sinkType as string)
          : sinkType || null;
    const materialForThicknessRules = resolvedCountertopMaterialSku || inferMaterialSkuFromBasinType(resolvedSinkType);
    const matrixDefaultThickness = resolveDefaultThicknessFromRules({
      rules: countertopRules,
      activeMaterialTokens: materialForThicknessRules ? [normalizeMaterialToken(materialForThicknessRules)] : [],
      depth:
        selectedDimensions.depth ??
        (productsPresets.length > 0 ? (productsPresets[0]?.Depth ?? null) : null) ??
        (sceneConfigs[0]?.Depth ?? null),
    });
    const resolvedCountertopThickness = sceneConfigs[0]?.Thickness || countertopThickness || matrixDefaultThickness || null;

    // 1) Product SKU(s) — Resolver 1
    if (shouldUsePresets) {
      // Prebuilt path: iterate presets
      productsPresets.forEach((preset, idx) => {
        const name = preset.name ?? "";
        const normalizedPresetName = normalizeCabinetToken(name);
        const normalizedPresetType = name ? name.replace(/[\s_]+/g, "-") : "";

        // Open Shelf → VAN-UROS-2S-{W}W-{H}H-{D}D-CAB-{mat}-{color}
        if (normalizedPresetName.includes("open-shelf") || normalizedPresetName.includes("openshelf")) {
          const swatchValue = preset.CabinetColor ?? cabinetColor;
          const sku = buildOpenShelfSku({
            width: preset.Width ?? null,
            height: preset.Height ?? null,
            depth: preset.Depth ?? null,
            cabinetMaterialSku: resolveCabinetMaterialSku(swatchValue),
            cabinetColorCode: extractColorCode(swatchValue),
            grainDirection: grainSku,
          });

          skus.push(sku);
          return;
        }

        // Open Side Shelf → VAN-UROSS-{L|R}-{W}W-{H}H-{D}D-CAB-{mat}-{color}
        if (normalizedPresetName.includes("side-shelf") || normalizedPresetName.includes("sideshelf")) {
          // Determine side: if it's before the main cabinet → L, after → R
          const side: "L" | "R" = idx === 0 ? "L" : "R";
          const swatchValue = preset.CabinetColor ?? cabinetColor;
          const sku = buildOpenSideShelfSku({
            side,
            width: preset.Width ?? null,
            height: preset.Height ?? null,
            depth: preset.Depth ?? null,
            cabinetMaterialSku: resolveCabinetMaterialSku(swatchValue),
            cabinetColorCode: extractColorCode(swatchValue),
            grainDirection: grainSku,
          });

          skus.push(sku);
          return;
        }

        // Standard cabinet → VAN-URSTD-{type}/...
        // preset.name is already a catalog key ("Sink-Base", "Side-Cabinet", etc.)
        const resolvedType = normalizedPresetType || resolveCabinetType(name || null) || activeCabinetType;

        const swatchValue = preset.CabinetColor ?? cabinetColor;
        const cabMaterialSku = resolveCabinetMaterialSku(swatchValue);
        const sku = buildProductSku({
          cabinetType: resolvedType,
          drawers: preset.Drawers ?? null,
          handle: (selectedProductConfig?.Handle as string | undefined) || preset.Handle || null,
          pattern: drawerPanelFluting || null,
          width: preset.Width ?? null,
          height: selectedDimensions.height ?? preset.Height ?? null,
          depth: selectedDimensions.depth ?? preset.Depth ?? null,
          cab: cabMaterialSku
            ? { materialSku: cabMaterialSku, colorCode: extractColorCode(swatchValue), grainDirection: grainSku }
            : null,
          hdl: handleMaterialSku
            ? { materialSku: handleMaterialSku, colorCode: extractColorCode(handleGrooveColor) }
            : null,
          msp: null,
          bkpl: null,
        });

        skus.push(sku);
      });

      // Extra products added on top of presets (e.g. via sidebar in prebuilt mode)
      sceneConfigs.forEach((cfg, idx) => {
        const resolvedType = resolveCabinetType(cfg.name) ?? resolveCabinetType(cfg.id) ?? activeCabinetType;
        const normalizedName = normalizeCabinetToken(cfg.name ?? cfg.id ?? "");

        if (normalizedName.includes("open-shelf") || normalizedName.includes("openshelf")) {
          const swatchValue = cfg.CabinetColor ?? cabinetColor;
          skus.push(
            buildOpenShelfSku({
              width: cfg.Width,
              height: cfg.Height,
              depth: cfg.Depth,
              cabinetMaterialSku: resolveCabinetMaterialSku(swatchValue),
              cabinetColorCode: extractColorCode(swatchValue),
              grainDirection: grainSku,
            }),
          );
          return;
        }

        if (normalizedName.includes("side-shelf") || normalizedName.includes("sideshelf")) {
          const side: "L" | "R" = idx === 0 ? "L" : "R";
          const swatchValue = cfg.CabinetColor ?? cabinetColor;
          skus.push(
            buildOpenSideShelfSku({
              side,
              width: cfg.Width,
              height: cfg.Height,
              depth: cfg.Depth,
              cabinetMaterialSku: resolveCabinetMaterialSku(swatchValue),
              cabinetColorCode: extractColorCode(swatchValue),
              grainDirection: grainSku,
            }),
          );
          return;
        }

        const swatchValue = cfg.CabinetColor ?? cabinetColor;
        const cabMaterialSku = resolveCabinetMaterialSku(swatchValue);
        const sku = buildProductSku({
          cabinetType: resolvedType,
          drawers: cfg.Drawers,
          handle: (selectedProductConfig?.Handle as string | undefined) || cfg.Handle || null,
          pattern: drawerPanelFluting || null,
          width: cfg.Width,
          height: cfg.Height,
          depth: cfg.Depth,
          cab: cabMaterialSku
            ? { materialSku: cabMaterialSku, colorCode: extractColorCode(swatchValue), grainDirection: grainSku }
            : null,
          hdl: handleMaterialSku
            ? { materialSku: handleMaterialSku, colorCode: extractColorCode(handleGrooveColor) }
            : null,
          msp: null,
          bkpl: null,
        });
        skus.push(sku);
      });
    } else if (sceneConfigs.length > 0) {
      // Custom path: iterate all products from PlayCanvas
      sceneConfigs.forEach((cfg, idx) => {
        const resolvedType = resolveCabinetType(cfg.name) ?? resolveCabinetType(cfg.id) ?? activeCabinetType;
        const normalizedName = normalizeCabinetToken(cfg.name ?? cfg.id ?? "");
        const swatchValue = cfg.CabinetColor ?? cabinetColor;

        // Open Shelf → VAN-UROS-2S-{W}W-{H}H-{D}D-CAB-{mat}-{color}
        if (normalizedName.includes("open-shelf") || normalizedName.includes("openshelf")) {
          const sku = buildOpenShelfSku({
            width: cfg.Width,
            height: cfg.Height,
            depth: cfg.Depth,
            cabinetMaterialSku: resolveCabinetMaterialSku(swatchValue),
            cabinetColorCode: extractColorCode(swatchValue),
            grainDirection: grainSku,
          });

          skus.push(sku);
          return;
        }

        // Open Side Shelf → VAN-UROSS-{L|R}-{W}W-{H}H-{D}D
        if (normalizedName.includes("side-shelf") || normalizedName.includes("sideshelf")) {
          const side: "L" | "R" = idx === 0 ? "L" : "R";
          const sku = buildOpenSideShelfSku({
            side,
            width: cfg.Width,
            height: cfg.Height,
            depth: cfg.Depth,
            cabinetMaterialSku: resolveCabinetMaterialSku(swatchValue),
            cabinetColorCode: extractColorCode(swatchValue),
            grainDirection: grainSku,
          });

          skus.push(sku);
          return;
        }

        const cabMaterialSku = resolveCabinetMaterialSku(swatchValue);
        const sku = buildProductSku({
          cabinetType: resolvedType,
          drawers: cfg.Drawers,
          handle: cfg.Handle,
          pattern: drawerPanelFluting || null,
          width: cfg.Width,
          height: cfg.Height,
          depth: cfg.Depth,
          cab: cabMaterialSku
            ? { materialSku: cabMaterialSku, colorCode: extractColorCode(swatchValue), grainDirection: grainSku }
            : null,
          hdl: handleMaterialSku
            ? { materialSku: handleMaterialSku, colorCode: extractColorCode(handleGrooveColor) }
            : null,
          msp: null,
          bkpl: null,
        });

        skus.push(sku);
      });
    } else {
      // Fallback: single product from selectedProductConfig
      const cabinetSku = buildProductSku({
        cabinetType: activeCabinetType,
        drawers: typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : null,
        handle: typeof selectedProductConfig?.Handle === "string" ? selectedProductConfig.Handle : null,
        pattern: drawerPanelFluting || null,
        width: selectedDimensions.width,
        height: selectedDimensions.height,
        depth: selectedDimensions.depth,
        cab: cabinetColorSku
          ? { materialSku: cabinetColorSku, colorCode: extractColorCode(cabinetColor), grainDirection: grainSku }
          : null,
        hdl: handleMaterialSku
          ? { materialSku: handleMaterialSku, colorCode: extractColorCode(handleGrooveColor) }
          : null,
        msp: null,
        bkpl: null,
      });

      skus.push(cabinetSku);
    }

    // ── Collect per-product dimension sets for resolvers 2-4 ──
    // Prebuilt: each preset has its own W/H/D + sinkType
    // Custom:   each sceneConfig has its own W/H/D (sinkType global)
    // Fallback: single selectedDimensions
    type ProductDims = { width: number | null; height: number | null; depth: number | null; sinkType: string | null };
    let productDimsList: ProductDims[];
    const cabinetCount = shouldUsePresets
      ? productsPresets.length + sceneConfigs.length
      : sceneConfigs.length > 0
        ? sceneConfigs.length
        : 1;

    if (shouldUsePresets) {
      productDimsList = [
        ...productsPresets.map((p) => ({
          width: p.Width ?? null,
          height: p.Height ?? null,
          depth: p.Depth ?? null,
          sinkType: shouldUsePresetSinkType ? p.sinkType ?? resolvedSinkType : resolvedSinkType,
        })),
        ...sceneConfigs.map((cfg) => ({
          width: cfg.Width,
          height: cfg.Height,
          depth: cfg.Depth,
          sinkType: resolvedSinkType,
        })),
      ];
    } else if (sceneConfigs.length > 0) {
      productDimsList = sceneConfigs.map((cfg) => ({
        width: cfg.Width,
        height: cfg.Height,
        depth: cfg.Depth,
        sinkType: resolvedSinkType,
      }));
    } else {
      productDimsList = [
        {
          width: selectedDimensions.width,
          height: selectedDimensions.height,
          depth: selectedDimensions.depth,
          sinkType: resolvedSinkType,
        },
      ];
    }

    // 2) Countertop SKUs — Resolver 2
    // Add aggregate (full composition) countertop SKU so Summary line has a matching price key.
    const seenCountertopSkus = new Set<string>();
    const totalCountertopWidth = productDimsList.reduce((sum, dims) => sum + (dims.width ?? 0), 0) || null;
    const aggregateCountertopLines = buildCountertopSku({
      style: countertopStyle || null,
      width: totalCountertopWidth,
      depth: selectedDimensions.depth,
      thickness: resolvedCountertopThickness,
      basinType: resolvedSinkType,
      faucetHolesAmount: faucetHolesAmount || null,
      faucetHolesSpacing: faucetHolesSpacing || null,
      countertopMaterialSku: effectiveCountertopMaterialSku,
      countertopColorCode: effectiveCountertopColorCode,
    });
    aggregateCountertopLines.forEach((line) => {
      if (!seenCountertopSkus.has(line)) {
        seenCountertopSkus.add(line);
        skus.push(line);
      }
    });

    // Always keep a default faucet-holes pricing SKU in the pool (including "0"),
    // with dynamic material resolved from basin/material context.
    const faucetHolesQty = (faucetHolesAmount ?? "").trim() || "0";
    const faucetMaterialSku = inferMaterialSkuFromBasinType(resolvedSinkType) ?? effectiveCountertopMaterialSku ?? "HPL";
    const defaultFaucetSku = `CT-UR${faucetMaterialSku}-FAHO/${faucetHolesQty}`;
    if (!seenCountertopSkus.has(defaultFaucetSku)) {
      seenCountertopSkus.add(defaultFaucetSku);
      skus.push(defaultFaucetSku);
    }

    // Do not add per-product countertop lines to active pricing SKUs.
    // They duplicate the aggregate countertop pricing line and inflate totals
    // (e.g. counting both CT-UR...INTG-70.9W and CT-UR...INTG-23.6W).

    // 2b) Vessel basin SKU — Resolver 2b (when sinkType is a vessel type)
    const seenVesselSkus = new Set<string>();
    productDimsList.forEach((dims, idx) => {
      const vesselType = dims.sinkType?.startsWith("Vessel_") ? dims.sinkType : null;
      if (!vesselType) return;
      const vesselSku = buildVesselSku({
        vesselType,
        width: dims.width,
        height: vesselHeightCmMap[vesselType] ?? null,
        depth: dims.depth,
        materialSku: resolvedVesselMaterialSku,
        colorCode: extractColorCode(resolvedVesselColor),
      });
      if (!seenVesselSkus.has(vesselSku)) {
        seenVesselSkus.add(vesselSku);
        console.log(LOG_PREFIX, `Resolver 2b (Vessel #${idx}):`, vesselSku);
        skus.push(vesselSku);
      }
    });

    // 3) Towel bar SKUs — Resolver 3 (global, same for all products)
    const hasTowel = towelBarOption && towelBarOption !== "None";
    const hasRight = towelBarOption === "Right" || towelBarOption === "Both";
    const hasLeft = towelBarOption === "Left" || towelBarOption === "Both";

    if (hasTowel && hasRight) {
      const sku = buildTowelBarSku({
        side: "R",
        width: TOWEL_BAR_DEFAULTS.width,
        height: TOWEL_BAR_DEFAULTS.height,
        depth: TOWEL_BAR_DEFAULTS.depth,
        materialSku: "LACM",
        colorCode: towelBarColor || null,
      });
      if (sku) {
        skus.push(sku);
      }
    }

    if (hasTowel && hasLeft) {
      const sku = buildTowelBarSku({
        side: "L",
        width: TOWEL_BAR_DEFAULTS.width,
        height: TOWEL_BAR_DEFAULTS.height,
        depth: TOWEL_BAR_DEFAULTS.depth,
        materialSku: "LACM",
        colorCode: towelBarColor || null,
      });
      if (sku) {
        skus.push(sku);
      }
    }

    // 4) Accessories SKUs — Resolver 4 (Side panels per product + Dividers global)

    // Side panels — use per-product height/depth
    if (sidePanelsOption && sidePanelsOption !== "" && sidePanelsOption !== "None") {
      const seenSpSkus = new Set<string>();
      productDimsList.forEach((dims, idx) => {
        const spSku = buildSidePanelSku({
          panelType: sidePanelsOption,
          width: SIDE_PANEL_WIDTH_CM,
          height: dims.height,
          depth: dims.depth,
          materialSku: resolveCabinetMaterialSku(),
          colorCode: extractColorCode(cabinetColor),
        });
        if (spSku && !seenSpSkus.has(spSku)) {
          seenSpSkus.add(spSku);
          console.log(LOG_PREFIX, `Resolver 4 (SidePanel #${idx}):`, spSku);
          skus.push(spSku);
        }
      });
    }

    // Dividers — prefer per-slot placed types (A/B/C). Fallback to selected style per cabinet.
    if (placedDividers.length > 0) {
      const typeToStyle: Record<"A" | "B" | "C", "Option A" | "Option B" | "Option C"> = {
        A: "Option A",
        B: "Option B",
        C: "Option C",
      };

      placedDividers.forEach((divider, index) => {
        const style = typeToStyle[divider.type];
        const divSku = style ? buildDividerSku({ dividerStyle: style }) : null;
        if (!divSku) return;
        console.log(LOG_PREFIX, `Resolver 4 (Divider #${index + 1}):`, divSku, divider);
        skus.push(divSku);
      });
    } else if (dividersStyle && dividersStyle !== "" && dividersStyle !== "None") {
      const divSku = buildDividerSku({ dividerStyle: dividersStyle });
      if (divSku) {
        for (let i = 0; i < cabinetCount; i++) {
          console.log(LOG_PREFIX, `Resolver 4 (Divider #${i + 1}):`, divSku);
          skus.push(divSku);
        }
      }
    }

    // 5) Book matching SKU — pricing modifier (global)
    if (bookMatching === "enabled" && grainSku) {
      const isHorizontal = grainSku === "H";
      if (!isHorizontal || cabinetCount >= 2) {
        const bmSku = buildBookMatchingSku({ direction: grainSku });
        console.log(LOG_PREFIX, "Resolver 5 (Book Matching):", bmSku);
        skus.push(bmSku);
      }
    }

    console.log(LOG_PREFIX, "All SKUs:", skus);
    return skus;
  }, [
    canCalculate,
    shouldUsePresets,
    productsPresets,
    sceneConfigs,
    activeCabinetType,
    selectedDimensions.width,
    selectedDimensions.height,
    selectedDimensions.depth,
    selectedProductConfig,
    cabinetColor,
    cabinetColorSku,
    handleGrooveColor,
    handleGrooveColorSku,
    countertopColor,
    countertopColorSku,
    vesselColor,
    countertopThickness,
    countertopStyle,
    grainSku,
    bookMatching,
    sinkType,
    drawerPanelFluting,
    towelBarOption,
    towelBarColor,
    faucetHolesAmount,
    faucetHolesSpacing,
    sidePanelsOption,
    dividersStyle,
    placedDividers,
    cabinetColorSkuByName,
    handleGrooveColorSkuByName,
    countertopColorSkuByName,
    resolveCabinetType,
    countertopRules,
  ]);

  // ── Stable key for the SKU list (avoid effect re-runs on same content) ─

  const skuKey = currentSkus.join("|");

  // ── Fetch prices for new/changed SKUs ─────────────────

  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!canCalculate || !currentSkus.length) {
      dispatch(setActiveSkus([]));
      dispatch(setPriceLoading(false));
      return;
    }

    dispatch(setActiveSkus(currentSkus));

    const pending = currentSkus.filter((sku) => !fetchedRef.current.has(sku));
    if (!pending.length) {
      dispatch(setPriceLoading(false));
      return;
    }
    dispatch(setPriceLoading(true));

    const timer = setTimeout(() => {
      let cancelled = false;

      // Mark immediately to prevent duplicate fetches
      pending.forEach((sku) => fetchedRef.current.add(sku));

      const loadPrices = async () => {
        const next: Record<string, number> = {};

        try {
          await Promise.all(
            [...new Set(pending)].map(async (sku) => {
              try {
                console.log(LOG_PREFIX, "Fetching price for:", sku);

                const isCountertopV2ResolveSku = /^CT-UR[^-]+-(?:INTG|VES)(?:-|$)/.test(sku);
                const isLegacyVesselSku = sku.startsWith("VES-");
                const data = isCountertopV2ResolveSku || isLegacyVesselSku
                    ? await triggerPriceBySkuV2Resolve(sku).unwrap()
                    : await triggerPriceBySku(sku).unwrap();

                console.log(LOG_PREFIX, "Response for", sku, "→", data);

                const price = resolvePriceFromResponse(data);
                if (typeof price === "number") next[sku] = price;
              } catch (err) {
                console.warn(LOG_PREFIX, "Price fetch failed for", sku, err);
              }
            }),
          );
        } finally {
          if (!cancelled) dispatch(setPriceLoading(false));
        }

        if (!cancelled && Object.keys(next).length) {
          console.log(LOG_PREFIX, "Resolved prices:", next);
          dispatch(setSkuPrices(next));
        }
      };

      loadPrices();

      return () => {
        cancelled = true;
      };
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuKey, canCalculate, dispatch, triggerPriceBySku, triggerPriceBySkuV2Resolve]);

  // ── Re-fetch scene configs when product options change ─
  // (user changed color, handle, etc. → configs on PlayCanvas are updated)

  useEffect(() => {
    const hasExtraProducts = shouldUsePresets ? productIds.length > productsPresets.length : productIds.length > 0;
    if (!hasExtraProducts) return;

    const timer = setTimeout(() => {
      // Clear price cache so new SKUs get fetched
      fetchedRef.current.clear();
      fetchSceneConfigs();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cabinetColor,
    cabinetColorSku,
    handleGrooveColor,
    handleGrooveColorSku,
    selectedProductConfig?.Handle,
    selectedProductConfig?.Drawers,
    drawerPanelFluting,
    selectedDimensions.width,
    selectedDimensions.height,
    selectedDimensions.depth,
  ]);
}
