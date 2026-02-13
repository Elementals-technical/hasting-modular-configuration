import { useEffect, useMemo, useRef } from "react";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  getActiveCabinetType,
  getSelectedDimensions,
  getSelectedProductConfig,
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
  getGrainDirection,
  getProductsPresets,
  getTowelBarOption,
  getTowelBarColor,
  getFaucetHolesAmount,
  getFaucetHolesSpacing,
} from "@/entities/product/model/store/selectors";
import {
  buildProductSku,
  buildCountertopSku,
  buildTowelBarSku,
  TOWEL_BAR_DEFAULTS,
  extractColorCode,
} from "@/shared/lib/sku";
import { useGetConfiguratorQuery } from "@/entities";
import { useLazyGetProductPriceBySkuQuery } from "@/entities/product/api";
import { setActiveSkus, setSkuPrices } from "@/entities/product/model/store/priceStore";

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

// ── Hook ────────────────────────────────────────────────

const DEBOUNCE_MS = 300;

export function usePriceCalculation() {
  const dispatch = useAppDispatch();
  const [triggerPriceBySku] = useLazyGetProductPriceBySkuQuery();

  // ── Read all relevant state ───────────────────────────

  const activeCabinetType = useAppSelector(getActiveCabinetType);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const selectedProductConfig = useAppSelector(getSelectedProductConfig);

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
  const grainDirection = useAppSelector(getGrainDirection);

  const towelBarOption = useAppSelector(getTowelBarOption);
  const towelBarColor = useAppSelector(getTowelBarColor);

  const faucetHolesAmount = useAppSelector(getFaucetHolesAmount);
  const faucetHolesSpacing = useAppSelector(getFaucetHolesSpacing);

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
  const canCalculate = hasPresets
    ? cabinetColorSku !== ""
    : selectedDimensions.width !== null && cabinetColorSku !== "";

  // ── Build all current SKUs ────────────────────────────

  const currentSkus = useMemo(() => {
    if (!canCalculate) return [];

    const skus: string[] = [];
    const handleMaterialSku = handleGrooveColorSku || colorSkuByName.get(handleGrooveColor) || null;

    // 1) Cabinet SKU(s) — from presets (prebuilt) or single config (custom)
    if (hasPresets) {
      productsPresets.forEach((preset) => {
        const swatchValue = preset.CabinetColor ?? cabinetColor;
        const sku = buildProductSku({
          cabinetType: preset.name ?? activeCabinetType,
          drawers: preset.Drawers ?? null,
          handle: preset.Handle ?? null,
          pattern: drawerPanelFluting || null,
          width: preset.Width ?? null,
          height: preset.Height ?? null,
          depth: preset.Depth ?? null,
          grainDirection: grainDirection || null,
          cab: cabinetColorSku ? { materialSku: cabinetColorSku, colorCode: extractColorCode(swatchValue) } : null,
          hdl: handleMaterialSku
            ? { materialSku: handleMaterialSku, colorCode: extractColorCode(handleGrooveColor) }
            : null,
          msp: null,
          bkpl: null,
        });
        skus.push(sku);
      });
    } else {
      const cabinetSku = buildProductSku({
        cabinetType: activeCabinetType,
        drawers: typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : null,
        handle: typeof selectedProductConfig?.Handle === "string" ? selectedProductConfig.Handle : null,
        pattern: drawerPanelFluting || null,
        width: selectedDimensions.width,
        height: selectedDimensions.height,
        depth: selectedDimensions.depth,
        grainDirection: grainDirection || null,
        cab: cabinetColorSku ? { materialSku: cabinetColorSku, colorCode: extractColorCode(cabinetColor) } : null,
        hdl: handleMaterialSku
          ? { materialSku: handleMaterialSku, colorCode: extractColorCode(handleGrooveColor) }
          : null,
        msp: null,
        bkpl: null,
      });
      skus.push(cabinetSku);
    }

    // 2) Countertop SKUs
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
    skus.push(...countertopSkuLines);

    // 3) Towel bar SKUs
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
      if (sku) skus.push(sku);
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
      if (sku) skus.push(sku);
    }

    return skus;
  }, [
    canCalculate,
    hasPresets,
    productsPresets,
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
    countertopThickness,
    countertopStyle,
    sinkType,
    drawerPanelFluting,
    grainDirection,
    towelBarOption,
    towelBarColor,
    faucetHolesAmount,
    faucetHolesSpacing,
    colorSkuByName,
  ]);

  // ── Stable key for the SKU list (avoid effect re-runs on same content) ─

  const skuKey = currentSkus.join("|");

  // ── Fetch prices for new/changed SKUs ─────────────────

  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!canCalculate || !currentSkus.length) {
      dispatch(setActiveSkus([]));
      return;
    }

    dispatch(setActiveSkus(currentSkus));

    const pending = currentSkus.filter((sku) => !fetchedRef.current.has(sku));
    if (!pending.length) return;

    const timer = setTimeout(() => {
      let cancelled = false;

      // Mark immediately to prevent duplicate fetches
      pending.forEach((sku) => fetchedRef.current.add(sku));

      const loadPrices = async () => {
        const next: Record<string, number> = {};

        await Promise.all(
          pending.map(async (sku) => {
            try {
              const data = await triggerPriceBySku(sku).unwrap();
              const price = resolvePriceFromResponse(data);
              if (typeof price === "number") next[sku] = price;
            } catch {
              // Ignore price errors; keep placeholder
            }
          }),
        );

        if (!cancelled && Object.keys(next).length) {
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
}
