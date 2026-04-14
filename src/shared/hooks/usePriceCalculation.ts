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
  getHasBootstrappedCabinetBuilder,
  getProductsPresets,
  getTowelBarOption,
  getTowelBarColor,
  getFaucetHolesAmount,
  getSidePanelsOption,
  getSidePanelLeftStatus,
  getSidePanelRightStatus,
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
  TOWEL_BAR_DEFAULTS,
  SIDE_PANEL_WIDTH_CM,
  extractColorCode,
  getCountertopMaterialTokensBySku,
  getCountertopMaterialTokensFromBasinType,
  buildCountertopColorSkuCandidates,
  resolveDefaultBasinByCountertopColor,
  resolveCountertopColorSkuFromCandidates,
} from "@/shared/lib/sku";
import { useGetConfiguratorQuery } from "@/entities";
import { useGetCountertopDatatableQuery } from "@/entities/countertop";
import {
  normalizeMaterialToken,
  parseCountertopMatrix,
  resolveDefaultThicknessFromRules,
} from "@/features/configurator-rule-core/countertop";
import { useLazyGetProductPriceBySkuQuery, useLazyGetProductPriceBySkuV2ResolveQuery } from "@/entities/product/api";
import { setActiveSkus, setPriceLoading, setSkuPrices } from "@/entities/product/model/store/priceStore";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import {
  normalizeProductConfigSnapshot,
  type NormalizedProductConfigSnapshot,
} from "@/shared/lib/normalizeProductConfigSnapshot";
import { shouldUsePresetProducts } from "@/shared/lib/shouldUsePresetProducts";
import { deriveBookMatchingChargeInfo, type BookMatchingCabinetInput } from "@/shared/lib/bookMatching";

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
  const hasBootstrappedCabinetBuilder = useAppSelector(getHasBootstrappedCabinetBuilder);

  const drawerPanelFluting = useAppSelector(getDrawerPanelFluting);

  const grainDirection = useAppSelector(getGrainDirection);
  const grainSku = grainDirection === "GrainHorizontal" ? "H" : grainDirection === "GrainVertical" ? "V" : null;
  const bookMatching = useAppSelector(getBookMatching);

  const towelBarOption = useAppSelector(getTowelBarOption);
  const towelBarColor = useAppSelector(getTowelBarColor);

  const faucetHolesAmount = useAppSelector(getFaucetHolesAmount);

  const sidePanelsOption = useAppSelector(getSidePanelsOption);
  const sidePanelLeft = useAppSelector(getSidePanelLeftStatus);
  const sidePanelRight = useAppSelector(getSidePanelRightStatus);
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

  const [sceneConfigs, setSceneConfigs] = useState<NormalizedProductConfigSnapshot[]>([]);
  const productIdsKey = productIds.join("|");

  const fetchSceneConfigs = useCallback(async () => {
    console.log(LOG_PREFIX, "fetchSceneConfigs called", {
      productIds,
      presetsCount: productsPresets.length,
      hasBootstrappedCabinetBuilder,
    });

    // When presets exist the bootstrap phase calls addProductId for each preset product first.
    // Only products whose index is >= presetsCount are truly "extra" (added via sidebar).
    // Special cases:
    //  - On the prebuilt page productIds is empty (no bootstrap yet) — keep preset path.
    //  - In Custom Mode, once productIds has been populated by bootstrap and then drops
    //    below presetsCount (user deleted a preset product), fall back to fetching ALL
    //    productIds — the preset-based slicing assumption no longer holds.
    const presetsDesynced =
      productsPresets.length > 0 && productIds.length > 0 && productIds.length < productsPresets.length;
    const idsToFetch = hasBootstrappedCabinetBuilder
      ? productIds
      : presetsDesynced || productsPresets.length === 0
        ? productIds
        : productIds.slice(productsPresets.length);

    if (idsToFetch.length === 0) {
      console.log(
        LOG_PREFIX,
        "fetchSceneConfigs skipped:",
        productsPresets.length > 0 && !hasBootstrappedCabinetBuilder
          ? "using presets, no extra products"
          : "no productIds",
      );
      setSceneConfigs([]);
      return;
    }

    const configs: NormalizedProductConfigSnapshot[] = [];

    for (const id of idsToFetch) {
      try {
        const raw = await getConfig(id);

        if (!raw) continue;

        configs.push(
          normalizeProductConfigSnapshot({
            id,
            raw: raw as Record<string, unknown>,
            selectedDimensions,
          }),
        );
      } catch (err) {
        console.warn(LOG_PREFIX, "Failed to get config for product", id, err);
      }
    }

    setSceneConfigs(configs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    productIdsKey,
    productsPresets.length,
    hasBootstrappedCabinetBuilder,
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
      countertopColorSkuCandidatesByValue: buildCountertopColorSkuCandidates(groups),
    };
  }, [cabinetColors]);

  // ── Guard: minimum data required ──────────────────────

  const hasSceneConfigs = sceneConfigs.length > 0;
  const shouldUsePresets = shouldUsePresetProducts({
    productsPresetsCount: productsPresets.length,
    productIdsCount: productIds.length,
    sceneConfigsCount: sceneConfigs.length,
    hasBootstrappedCabinetBuilder,
  });

  const canCalculate = shouldUsePresets
    ? true
    : hasSceneConfigs
      ? true
      : productIds.length === 0 && selectedDimensions.width !== null;

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
    const colorDrivenDefaultBasin = resolveDefaultBasinByCountertopColor(resolvedCountertopColor);
    const resolvedSinkType =
      shouldUsePresetSinkType && colorDrivenDefaultBasin
        ? colorDrivenDefaultBasin
        : shouldUsePresetSinkType
          ? (firstPreset?.sinkType as string)
          : sinkType || null;
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
    const useVesselMaterialForCountertopSku = (countertopStyle || "").trim().toLowerCase() === "vessel";
    const effectiveCountertopMaterialSku = useVesselMaterialForCountertopSku
      ? resolvedVesselMaterialSku
      : resolvedCountertopMaterialSku;
    const effectiveCountertopColorCode = extractColorCode(
      useVesselMaterialForCountertopSku ? resolvedVesselColor : resolvedCountertopColor,
    );
    const resolveNameFromRaw = (value: string) => {
      const lastDash = value.lastIndexOf("-");
      if (lastDash > 0 && value.slice(lastDash + 1).length >= 6) return value.slice(0, lastDash);
      return value;
    };
    const isSinkBaseName = (value: string | null | undefined) => {
      if (!value) return false;
      const normalized = normalizeCabinetToken(value);
      return normalized.includes("sink-base") || normalized.includes("sinkbase");
    };
    const sinkBaseCountForPricing = Math.max(
      1,
      shouldUsePresets
        ? productsPresets.filter((preset) => isSinkBaseName(preset.name ?? null)).length +
            sceneConfigs.filter((cfg) =>
              isSinkBaseName(
                cfg.ProductType ??
                  cfg.productType ??
                  (cfg.entityName ? resolveNameFromRaw(cfg.entityName) : null) ??
                  (cfg._productId ? resolveNameFromRaw(cfg._productId) : null) ??
                  cfg.name,
              ),
            ).length
        : sceneConfigs.length > 0
          ? sceneConfigs.filter((cfg) =>
              isSinkBaseName(
                cfg.ProductType ??
                  cfg.productType ??
                  (cfg.entityName ? resolveNameFromRaw(cfg.entityName) : null) ??
                  (cfg._productId ? resolveNameFromRaw(cfg._productId) : null) ??
                  cfg.name,
              ),
            ).length
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
    const sinkBaseEntriesForPricing = shouldUsePresets
      ? [
          ...productsPresets
            .filter((preset) => isSinkBaseName(preset.name ?? null))
            .map((preset, index) => ({
              id: `preset-${index}`,
              sinkType: shouldUsePresetSinkType ? (preset.sinkType ?? resolvedSinkType) : resolvedSinkType,
            })),
          ...sceneConfigs.flatMap((cfg, index) => {
            const rawName =
              cfg.ProductType ??
              cfg.productType ??
              (cfg.entityName ? resolveNameFromRaw(cfg.entityName) : null) ??
              (cfg._productId ? resolveNameFromRaw(cfg._productId) : null) ??
              cfg.name;
            if (!isSinkBaseName(rawName)) return [];
            return [
              {
                id: `config-${index}`,
                sinkType: cfg.sinkType ?? resolvedSinkType,
              },
            ];
          }),
        ]
      : sceneConfigs.length > 0
        ? sceneConfigs.flatMap((cfg, index) => {
            const rawName =
              cfg.ProductType ??
              cfg.productType ??
              (cfg.entityName ? resolveNameFromRaw(cfg.entityName) : null) ??
              (cfg._productId ? resolveNameFromRaw(cfg._productId) : null) ??
              cfg.name;
            if (!isSinkBaseName(rawName)) return [];
            return [
              {
                id: `config-${index}`,
                sinkType: cfg.sinkType ?? resolvedSinkType,
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
    const materialForThicknessRules = resolvedCountertopMaterialSku || inferMaterialSkuFromBasinType(resolvedSinkType);
    const matrixDefaultThickness = resolveDefaultThicknessFromRules({
      rules: countertopRules,
      activeMaterialTokens: materialForThicknessRules ? [normalizeMaterialToken(materialForThicknessRules)] : [],
      width:
        selectedDimensions.width ??
        (productsPresets.length > 0 ? (productsPresets[0]?.Width ?? null) : null) ??
        sceneConfigs[0]?.Width ??
        null,
      depth:
        selectedDimensions.depth ??
        (productsPresets.length > 0 ? (productsPresets[0]?.Depth ?? null) : null) ??
        sceneConfigs[0]?.Depth ??
        null,
    });
    const resolvedCountertopThickness =
      countertopThickness || sceneConfigs[0]?.Thickness || matrixDefaultThickness || null;

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
    let bookMatchingCabinets: BookMatchingCabinetInput[];

    if (shouldUsePresets) {
      productDimsList = [
        ...productsPresets.map((p) => ({
          width: p.Width ?? null,
          height: p.Height ?? null,
          depth: p.Depth ?? null,
          sinkType: shouldUsePresetSinkType ? (p.sinkType ?? resolvedSinkType) : resolvedSinkType,
        })),
        ...sceneConfigs.map((cfg) => ({
          width: cfg.Width,
          height: cfg.Height,
          depth: cfg.Depth,
          sinkType: resolvedSinkType,
        })),
      ];
      bookMatchingCabinets = [
        ...productsPresets.map((preset) => ({
          name: preset.name,
          drawers: preset.Drawers ?? null,
        })),
        ...sceneConfigs.map((cfg) => ({
          name:
            cfg.ProductType ??
            cfg.productType ??
            (cfg.entityName ? resolveNameFromRaw(cfg.entityName) : null) ??
            (cfg._productId ? resolveNameFromRaw(cfg._productId) : null) ??
            cfg.name,
          drawers: cfg.Drawers,
        })),
      ];
    } else if (sceneConfigs.length > 0) {
      productDimsList = sceneConfigs.map((cfg) => ({
        width: cfg.Width,
        height: cfg.Height,
        depth: cfg.Depth,
        sinkType: resolvedSinkType,
      }));
      bookMatchingCabinets = sceneConfigs.map((cfg) => ({
        name:
          cfg.ProductType ??
          cfg.productType ??
          (cfg.entityName ? resolveNameFromRaw(cfg.entityName) : null) ??
          (cfg._productId ? resolveNameFromRaw(cfg._productId) : null) ??
          cfg.name,
        drawers: cfg.Drawers,
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
      bookMatchingCabinets = [
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
    }

    // 2) Countertop SKUs — Resolver 2
    // Add aggregate (full composition) countertop SKU so Summary line has a matching price key.
    const totalCountertopWidth = productDimsList.reduce((sum, dims) => sum + (dims.width ?? 0), 0) || null;
    const aggregateCountertopLines = buildCountertopSku({
      style: countertopStyle || null,
      width: totalCountertopWidth,
      depth: selectedDimensions.depth,
      thickness: resolvedCountertopThickness,
      basinType: resolvedSinkType,
      faucetHolesAmount: faucetHolesAmount || null,
      countertopMaterialSku: effectiveCountertopMaterialSku,
      countertopColorCode: effectiveCountertopColorCode,
    });
    const aggregateCountertopSkuSet = new Set(aggregateCountertopLines);
    aggregateCountertopLines.forEach((line, index) => {
      if (index === 1 && !useVesselMaterialForCountertopSku && sinkBaseEntriesForPricing.length > 0) {
        sinkBaseEntriesForPricing.forEach((entry) => {
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
          skus.push(basinLine);
        });
        return;
      }
      const repeatCount = index === 1 && resolvedSinkType ? sinkBaseCountForPricing : 1;
      for (let i = 0; i < repeatCount; i++) {
        skus.push(line);
      }
    });

    // Always keep a default faucet-holes pricing SKU in the pool (including "0"),
    // with dynamic material resolved from basin/material context.
    const faucetHolesQty = (faucetHolesAmount ?? "").trim() || "0";
    const faucetMaterialSku =
      inferMaterialSkuFromBasinType(resolvedSinkType) ?? effectiveCountertopMaterialSku ?? "HPL";
    const defaultFaucetSku = `CT-UR${faucetMaterialSku}-FAHO/${faucetHolesQty}`;
    if (!aggregateCountertopSkuSet.has(defaultFaucetSku)) {
      skus.push(defaultFaucetSku);
    }

    // Do not add per-product countertop lines to active pricing SKUs.
    // They duplicate the aggregate countertop pricing line and inflate totals
    // (e.g. counting both CT-UR...INTG-70.9W and CT-UR...INTG-23.6W).

    // 2b) Vessel basin SKU — Resolver 2b (when sinkType is a vessel type)
    const vesselType = resolvedSinkType?.startsWith("Vessel_") ? resolvedSinkType : null;
    if (vesselType) {
      const vesselSku = buildVesselSku({
        vesselType,
        width: totalCountertopWidth,
        height: vesselHeightCmMap[vesselType] ?? null,
        depth: selectedDimensions.depth,
        materialSku: resolvedVesselMaterialSku,
        colorCode: extractColorCode(resolvedVesselColor),
      });
      for (let i = 0; i < sinkBaseCountForPricing; i++) {
        console.log(LOG_PREFIX, `Resolver 2b (Vessel #${i + 1}):`, vesselSku);
        skus.push(vesselSku);
      }
    }

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

    // Side panels — one SKU per active side (single-panel pricing)
    if (sidePanelsOption && sidePanelsOption !== "" && sidePanelsOption !== "None") {
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
      const sidePanelCabinetColor = shouldUsePresets
        ? (productsPresets.find((preset) => typeof preset.CabinetColor === "string" && preset.CabinetColor)
            ?.CabinetColor ??
          sceneConfigs.find((cfg) => typeof cfg.CabinetColor === "string" && cfg.CabinetColor)?.CabinetColor ??
          cabinetColor)
        : (sceneConfigs.find((cfg) => typeof cfg.CabinetColor === "string" && cfg.CabinetColor)?.CabinetColor ??
          cabinetColor);
      const activeSides = [sidePanelLeft === "active", sidePanelRight === "active"];
      const activeSideCount = activeSides.filter(Boolean).length;
      if (activeSideCount > 0) {
        const dims = productDimsList[0] ?? { height: null, depth: null };
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
        if (spSku) {
          for (let i = 0; i < activeSideCount; i++) {
            skus.push(spSku);
          }
        }
      }
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

    // 5) Book matching SKU — pricing modifier (per drawer)
    const bookMatchingInfo = deriveBookMatchingChargeInfo({
      grainDirection,
      bookMatching,
      materialSku: resolveCabinetMaterialSku(cabinetColor),
      cabinets: bookMatchingCabinets,
    });

    if (bookMatchingInfo.applies && bookMatchingInfo.sku) {
      console.log(
        LOG_PREFIX,
        "Resolver 5 (Book Matching):",
        bookMatchingInfo.sku,
        "× drawers:",
        bookMatchingInfo.drawerQty,
        {
          eligibleCabinetCount: bookMatchingInfo.eligibleCabinetCount,
        },
      );
      for (let i = 0; i < bookMatchingInfo.drawerQty; i++) {
        skus.push(bookMatchingInfo.sku);
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
    sidePanelsOption,
    sidePanelLeft,
    sidePanelRight,
    dividersStyle,
    placedDividers,
    cabinetColorSkuByName,
    handleGrooveColorSkuByName,
    countertopColorSkuCandidatesByValue,
    resolveCabinetType,
    countertopRules,
    grainDirection,
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
                const isBookMatchingSku = sku.startsWith("VAN-URBMG-");
                const data =
                  isCountertopV2ResolveSku || isLegacyVesselSku || isBookMatchingSku
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
    countertopColor,
    countertopColorSku,
    countertopStyle,
    countertopThickness,
    vesselColor,
    sinkType,
    faucetHolesAmount,
    selectedProductConfig?.Handle,
    selectedProductConfig?.Drawers,
    drawerPanelFluting,
    selectedDimensions.width,
    selectedDimensions.height,
    selectedDimensions.depth,
  ]);
}
