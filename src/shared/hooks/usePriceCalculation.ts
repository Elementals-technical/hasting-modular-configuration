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
  getActiveCountertopThickness,
  getCountertopStyle,
  getSinkType,
  getDrawerPanelFluting,
  getProductsPresets,
  getTowelBarOption,
  getTowelBarColor,
  getFaucetHolesAmount,
  getFaucetHolesSpacing,
  getSidePanelsOption,
  getDividersStyle,
  getCabinetCatalog,
} from "@/entities/product/model/store/selectors";
import {
  buildProductSku,
  buildCountertopSku,
  buildTowelBarSku,
  buildSidePanelSku,
  buildDividerSku,
  TOWEL_BAR_DEFAULTS,
  SIDE_PANEL_WIDTH_CM,
  extractColorCode,
} from "@/shared/lib/sku";
import { useGetConfiguratorQuery } from "@/entities";
import { useLazyGetProductPriceBySkuQuery } from "@/entities/product/api";
import { setActiveSkus, setPriceLoading, setSkuPrices } from "@/entities/product/model/store/priceStore";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";

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
  Drawers: string | null;
  Handle: string | null;
  CabinetColor: string | null;
};

// ── Hook ────────────────────────────────────────────────

const DEBOUNCE_MS = 300;
const LOG_PREFIX = "[SKU/Price]";

export function usePriceCalculation() {
  const dispatch = useAppDispatch();
  const [triggerPriceBySku] = useLazyGetProductPriceBySkuQuery();

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
  const countertopThickness = useAppSelector(getActiveCountertopThickness);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const sinkType = useAppSelector(getSinkType);

  const productsPresets = useAppSelector(getProductsPresets);

  const drawerPanelFluting = useAppSelector(getDrawerPanelFluting);

  const towelBarOption = useAppSelector(getTowelBarOption);
  const towelBarColor = useAppSelector(getTowelBarColor);

  const faucetHolesAmount = useAppSelector(getFaucetHolesAmount);
  const faucetHolesSpacing = useAppSelector(getFaucetHolesSpacing);

  const sidePanelsOption = useAppSelector(getSidePanelsOption);
  const dividersStyle = useAppSelector(getDividersStyle);

  const cabinetCatalog = useAppSelector(getCabinetCatalog);

  /** Resolve a PlayCanvas product name (e.g. "SinkBase60") → catalog code ("Sink-Base") */
  const resolveCabinetType = useCallback(
    (productName: string | null): string | null => {
      if (!productName) return null;
      const normalized = productName.toLowerCase();
      const match = cabinetCatalog.typeCabinetRules.find((rule) => normalized.includes(rule.code.toLowerCase()));
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

    if (productsPresets.length > 0 || productIds.length === 0) {
      console.log(
        LOG_PREFIX,
        "fetchSceneConfigs skipped:",
        productsPresets.length > 0 ? "has presets" : "no productIds",
      );
      setSceneConfigs([]);
      return;
    }

    const configs: ProductConfigSnapshot[] = [];

    for (const id of productIds) {
      try {
        console.log(LOG_PREFIX, `Calling getConfig("${id}")...`);
        const raw = await getConfig(id);
        console.log(LOG_PREFIX, `getConfig("${id}") returned:`, raw);
        if (!raw) continue;

        const cfg = raw as Record<string, unknown>;
        configs.push({
          id,
          name:
            (typeof cfg.ProductType === "string" && cfg.ProductType) ||
            (typeof cfg.productType === "string" && cfg.productType) ||
            (typeof cfg.type === "string" && cfg.type) ||
            (typeof cfg.name === "string" && cfg.name) ||
            null,
          Width: typeof cfg.Width === "number" ? cfg.Width : null,
          Height: typeof cfg.Height === "number" ? cfg.Height : null,
          Depth: typeof cfg.Depth === "number" ? cfg.Depth : null,
          Drawers: typeof cfg.Drawers === "string" ? cfg.Drawers : null,
          Handle: typeof cfg.Handle === "string" ? cfg.Handle : null,
          CabinetColor: typeof cfg.CabinetColor === "string" ? cfg.CabinetColor : null,
        });
      } catch (err) {
        console.warn(LOG_PREFIX, "Failed to get config for product", id, err);
      }
    }

    console.log(LOG_PREFIX, "Scene configs fetched:", configs.length, configs);
    setSceneConfigs(configs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIdsKey, productsPresets.length]);

  useEffect(() => {
    fetchSceneConfigs();
  }, [fetchSceneConfigs]);

  // ── colorSkuByName from configurator API (cached by RTK Query) ─

  const { data: cabinetColors } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });

  const colorSkuByName = useMemo(() => {
    const map = new Map<string, string>();
    const groups = cabinetColors?.availableOptions ?? [];

    groups.forEach((group) => {
      group.options.forEach((option) => {
        option.variants?.forEach((variant) => {
          if (!variant.enabled) return;
          const meta = (variant.metadata ?? {}) as Record<string, unknown>;
          const value = (meta.value as string) || variant.name;
          const sku = (meta.sku as string) || "";
          if (value && sku) {
            map.set(value, sku);
          }
        });
      });
    });

    return map;
  }, [cabinetColors]);

  // ── Guard: minimum data required ──────────────────────

  const hasPresets = productsPresets.length > 0;
  const hasSceneConfigs = sceneConfigs.length > 0;
  const canCalculate = hasPresets
    ? cabinetColorSku !== ""
    : hasSceneConfigs
      ? cabinetColorSku !== ""
      : selectedDimensions.width !== null && cabinetColorSku !== "";

  console.log(LOG_PREFIX, "canCalculate:", canCalculate, {
    hasPresets,
    hasSceneConfigs,
    cabinetColorSku,
    selectedDimensionsWidth: selectedDimensions.width,
    productIdsCount: productIds.length,
  });

  // ── Build all current SKUs ────────────────────────────

  const currentSkus = useMemo(() => {
    if (!canCalculate) return [];

    const skus: string[] = [];
    const handleMaterialSku = handleGrooveColorSku || colorSkuByName.get(handleGrooveColor) || null;

    console.log(
      LOG_PREFIX,
      "Building SKUs — path:",
      hasPresets ? "PRESETS" : sceneConfigs.length > 0 ? `SCENE_CONFIGS (${sceneConfigs.length})` : "FALLBACK",
      {
        presetsCount: productsPresets.length,
        sceneConfigsCount: sceneConfigs.length,
        productIds,
      },
    );

    // 1) Cabinet SKU(s) — Resolver 1
    if (hasPresets) {
      // Prebuilt path: iterate presets
      productsPresets.forEach((preset) => {
        const resolvedType = resolveCabinetType(preset.name ?? null) ?? activeCabinetType;
        console.log(LOG_PREFIX, `Resolving cabinet type for preset "${preset.name}" → "${resolvedType}"`);
        const swatchValue = preset.CabinetColor ?? cabinetColor;
        const sku = buildProductSku({
          cabinetType: resolvedType,
          drawers: preset.Drawers ?? null,
          handle: preset.Handle ?? null,
          pattern: drawerPanelFluting || null,
          width: preset.Width ?? null,
          height: preset.Height ?? null,
          depth: preset.Depth ?? null,
          cab: cabinetColorSku ? { materialSku: cabinetColorSku, colorCode: extractColorCode(swatchValue) } : null,
          hdl: handleMaterialSku
            ? { materialSku: handleMaterialSku, colorCode: extractColorCode(handleGrooveColor) }
            : null,
          msp: null,
          bkpl: null,
        });
        console.log(LOG_PREFIX, "Resolver 1 (Cabinet preset):", sku);
        skus.push(sku);
      });
    } else if (sceneConfigs.length > 0) {
      // Custom path: iterate all products from PlayCanvas
      // Color is global (same for all products on scene) → always use Redux cabinetColor
      sceneConfigs.forEach((cfg) => {
        const resolvedType = resolveCabinetType(cfg.name) ?? resolveCabinetType(cfg.id) ?? activeCabinetType;
        console.log(LOG_PREFIX, `Resolving cabinet type for "${cfg.name}" (id: ${cfg.id}) → "${resolvedType}"`);
        const sku = buildProductSku({
          cabinetType: resolvedType,
          drawers: cfg.Drawers,
          handle: cfg.Handle,
          pattern: drawerPanelFluting || null,
          width: cfg.Width,
          height: cfg.Height,
          depth: cfg.Depth,
          cab: cabinetColorSku ? { materialSku: cabinetColorSku, colorCode: extractColorCode(cabinetColor) } : null,
          hdl: handleMaterialSku
            ? { materialSku: handleMaterialSku, colorCode: extractColorCode(handleGrooveColor) }
            : null,
          msp: null,
          bkpl: null,
        });
        console.log(LOG_PREFIX, `Resolver 1 (Cabinet ${cfg.id}):`, sku);
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
        cab: cabinetColorSku ? { materialSku: cabinetColorSku, colorCode: extractColorCode(cabinetColor) } : null,
        hdl: handleMaterialSku
          ? { materialSku: handleMaterialSku, colorCode: extractColorCode(handleGrooveColor) }
          : null,
        msp: null,
        bkpl: null,
      });
      console.log(LOG_PREFIX, "Resolver 1 (Cabinet fallback):", cabinetSku);
      skus.push(cabinetSku);
    }

    // 2) Countertop SKUs — Resolver 2
    const countertopSkuLines = buildCountertopSku({
      style: countertopStyle || null,
      width: selectedDimensions.width,
      depth: selectedDimensions.depth,
      thickness: countertopThickness || null,
      basinType: sinkType || null,
      faucetHolesAmount: faucetHolesAmount || null,
      faucetHolesSpacing: faucetHolesSpacing || null,
      countertopMaterialSku: countertopColorSku || null,
      countertopColorCode: extractColorCode(countertopColor),
    });
    countertopSkuLines.forEach((line) => console.log(LOG_PREFIX, "Resolver 2 (Countertop):", line));
    skus.push(...countertopSkuLines);

    // 3) Towel bar SKUs — Resolver 3
    const towelMaterialSku = colorSkuByName.get(towelBarColor) || null;
    const towelColorCode = extractColorCode(towelBarColor);
    const hasTowel = towelBarOption && towelBarOption !== "None";
    const hasRight = towelBarOption === "Right" || towelBarOption === "Both";
    const hasLeft = towelBarOption === "Left" || towelBarOption === "Both";

    if (hasTowel && hasRight && towelMaterialSku) {
      const sku = buildTowelBarSku({
        side: "R",
        width: TOWEL_BAR_DEFAULTS.width,
        height: TOWEL_BAR_DEFAULTS.height,
        depth: TOWEL_BAR_DEFAULTS.depth,
        materialSku: towelMaterialSku,
        colorCode: towelColorCode,
      });
      if (sku) {
        console.log(LOG_PREFIX, "Resolver 3 (TowelBar R):", sku);
        skus.push(sku);
      }
    }

    if (hasTowel && hasLeft && towelMaterialSku) {
      const sku = buildTowelBarSku({
        side: "L",
        width: TOWEL_BAR_DEFAULTS.width,
        height: TOWEL_BAR_DEFAULTS.height,
        depth: TOWEL_BAR_DEFAULTS.depth,
        materialSku: towelMaterialSku,
        colorCode: towelColorCode,
      });
      if (sku) {
        console.log(LOG_PREFIX, "Resolver 3 (TowelBar L):", sku);
        skus.push(sku);
      }
    }

    // 4) Accessories SKUs — Resolver 4 (Side panels + Dividers)

    // Side panels
    if (sidePanelsOption && sidePanelsOption !== "" && sidePanelsOption !== "None") {
      const spSku = buildSidePanelSku({
        panelType: sidePanelsOption,
        width: SIDE_PANEL_WIDTH_CM,
        height: selectedDimensions.height,
        depth: selectedDimensions.depth,
        handleMaterialSku: handleMaterialSku,
        handleColorCode: extractColorCode(handleGrooveColor),
      });
      if (spSku) {
        console.log(LOG_PREFIX, "Resolver 4 (SidePanel):", spSku);
        skus.push(spSku);
      }
    }

    // Dividers
    if (dividersStyle && dividersStyle !== "" && dividersStyle !== "None") {
      const divSku = buildDividerSku({ dividerStyle: dividersStyle });
      if (divSku) {
        console.log(LOG_PREFIX, "Resolver 4 (Divider):", divSku);
        skus.push(divSku);
      }
    }

    console.log(LOG_PREFIX, "All SKUs:", skus);
    return skus;
  }, [
    canCalculate,
    hasPresets,
    productsPresets,
    sceneConfigs,
    activeCabinetType,
    selectedDimensions.width,
    selectedDimensions.height,
    selectedDimensions.depth,
    selectedProductConfig,
    productIds,
    cabinetColor,
    cabinetColorSku,
    handleGrooveColor,
    handleGrooveColorSku,
    countertopColor,
    countertopColorSku,
    countertopThickness,
    countertopStyle,
    sinkType,
    drawerPanelFluting,
    towelBarOption,
    towelBarColor,
    faucetHolesAmount,
    faucetHolesSpacing,
    sidePanelsOption,
    dividersStyle,
    colorSkuByName,
    resolveCabinetType,
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
            pending.map(async (sku) => {
              try {
                console.log(LOG_PREFIX, "Fetching price for:", sku);
                const data = await triggerPriceBySku(sku).unwrap();
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
  }, [skuKey, canCalculate, dispatch, triggerPriceBySku]);

  // ── Re-fetch scene configs when product options change ─
  // (user changed color, handle, etc. → configs on PlayCanvas are updated)

  useEffect(() => {
    if (hasPresets || productIds.length === 0) return;

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
    drawerPanelFluting,
    selectedDimensions.width,
    selectedDimensions.height,
    selectedDimensions.depth,
  ]);
}
