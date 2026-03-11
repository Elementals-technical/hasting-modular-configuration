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
} from "@/shared/lib/sku";
import { useGetConfiguratorQuery } from "@/entities";
import {
  useLazyGetProductPriceBySkuQuery,
  useLazyResolveSkuPriceQuery,
  useLazyDebugSkuSearchQuery,
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
  const [triggerResolveSkuPrice] = useLazyResolveSkuPriceQuery();
  const [triggerDebugSkuSearch] = useLazyDebugSkuSearchQuery();

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
  const shouldUsePresets = hasPresets;
  const canCalculate = shouldUsePresets ? true : hasSceneConfigs ? true : selectedDimensions.width !== null;

  // ── Build all current SKUs ────────────────────────────

  const currentSkus = useMemo(() => {
    if (!canCalculate) return [];

    const skus: string[] = [];
    const handleMaterialSku = handleGrooveColorSku || colorSkuByName.get(handleGrooveColor) || null;

    // 1) Product SKU(s) — Resolver 1
    if (shouldUsePresets) {
      // Prebuilt path: iterate presets
      productsPresets.forEach((preset, idx) => {
        const name = preset.name ?? "";

        // Open Shelf → VAN-UROS-2S-{W}W-{H}H-{D}D-CAB-{mat}-{color}
        if (name === "Open-Shelf") {
          const swatchValue = preset.CabinetColor ?? cabinetColor;
          const sku = buildOpenShelfSku({
            width: preset.Width ?? null,
            height: preset.Height ?? null,
            depth: preset.Depth ?? null,
            cabinetMaterialSku: cabinetColorSku || null,
            cabinetColorCode: extractColorCode(swatchValue),
            grainDirection: grainSku,
          });

          skus.push(sku);
          return;
        }

        // Open Side Shelf → VAN-UROSS-{L|R}-{W}W-{H}H-{D}D-CAB-{mat}-{color}
        if (name === "Side-Shelf") {
          // Determine side: if it's before the main cabinet → L, after → R
          const side: "L" | "R" = idx === 0 ? "L" : "R";
          const swatchValue = preset.CabinetColor ?? cabinetColor;
          const sku = buildOpenSideShelfSku({
            side,
            width: preset.Width ?? null,
            height: preset.Height ?? null,
            depth: preset.Depth ?? null,
            cabinetMaterialSku: cabinetColorSku || null,
            cabinetColorCode: extractColorCode(swatchValue),
            grainDirection: grainSku,
          });

          skus.push(sku);
          return;
        }

        // Standard cabinet → VAN-URSTD-{type}/...
        // preset.name is already a catalog key ("Sink-Base", "Side-Cabinet", etc.)
        const resolvedType = name || resolveCabinetType(name || null) || activeCabinetType;

        const swatchValue = preset.CabinetColor ?? cabinetColor;
        const sku = buildProductSku({
          cabinetType: resolvedType,
          drawers: preset.Drawers ?? null,
          handle: (selectedProductConfig?.Handle as string | undefined) || preset.Handle || null,
          pattern: drawerPanelFluting || null,
          width: preset.Width ?? null,
          height: selectedDimensions.height ?? preset.Height ?? null,
          depth: selectedDimensions.depth ?? preset.Depth ?? null,
          cab: cabinetColorSku
            ? { materialSku: cabinetColorSku, colorCode: extractColorCode(swatchValue), grainDirection: grainSku }
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
        const normalizedName = (cfg.name ?? cfg.id ?? "").toLowerCase();

        if (normalizedName.includes("open-shelf") || normalizedName.includes("openshelf")) {
          skus.push(
            buildOpenShelfSku({
              width: cfg.Width,
              height: cfg.Height,
              depth: cfg.Depth,
              cabinetMaterialSku: cabinetColorSku || null,
              cabinetColorCode: extractColorCode(cabinetColor),
              grainDirection: grainSku,
            }),
          );
          return;
        }

        if (normalizedName.includes("side-shelf") || normalizedName.includes("sideshelf")) {
          const side: "L" | "R" = idx === 0 ? "L" : "R";
          skus.push(
            buildOpenSideShelfSku({
              side,
              width: cfg.Width,
              height: cfg.Height,
              depth: cfg.Depth,
              cabinetMaterialSku: cabinetColorSku || null,
              cabinetColorCode: extractColorCode(cabinetColor),
              grainDirection: grainSku,
            }),
          );
          return;
        }

        skus.push(
          buildProductSku({
            cabinetType: resolvedType,
            drawers: cfg.Drawers,
            handle: (selectedProductConfig?.Handle as string | undefined) || cfg.Handle || null,
            pattern: drawerPanelFluting || null,
            width: cfg.Width,
            height: cfg.Height,
            depth: cfg.Depth,
            cab: cabinetColorSku
              ? { materialSku: cabinetColorSku, colorCode: extractColorCode(cabinetColor), grainDirection: grainSku }
              : null,
            hdl: handleMaterialSku
              ? { materialSku: handleMaterialSku, colorCode: extractColorCode(handleGrooveColor) }
              : null,
            msp: null,
            bkpl: null,
          }),
        );
      });
    } else if (sceneConfigs.length > 0) {
      // Custom path: iterate all products from PlayCanvas
      // Color is global (same for all products on scene) → always use Redux cabinetColor
      sceneConfigs.forEach((cfg, idx) => {
        const resolvedType = resolveCabinetType(cfg.name) ?? resolveCabinetType(cfg.id) ?? activeCabinetType;
        const normalizedName = (cfg.name ?? cfg.id ?? "").toLowerCase();

        // Open Shelf → VAN-UROS-2S-{W}W-{H}H-{D}D-CAB-{mat}-{color}
        if (normalizedName.includes("open-shelf") || normalizedName.includes("openshelf")) {
          const sku = buildOpenShelfSku({
            width: cfg.Width,
            height: cfg.Height,
            depth: cfg.Depth,
            cabinetMaterialSku: cabinetColorSku || null,
            cabinetColorCode: extractColorCode(cabinetColor),
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
            cabinetMaterialSku: cabinetColorSku || null,
            cabinetColorCode: extractColorCode(cabinetColor),
            grainDirection: grainSku,
          });

          skus.push(sku);
          return;
        }

        const sku = buildProductSku({
          cabinetType: resolvedType,
          drawers: cfg.Drawers,
          handle: cfg.Handle,
          pattern: drawerPanelFluting || null,
          width: cfg.Width,
          height: cfg.Height,
          depth: cfg.Depth,
          cab: cabinetColorSku
            ? { materialSku: cabinetColorSku, colorCode: extractColorCode(cabinetColor), grainDirection: grainSku }
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
          sinkType: p.sinkType ?? sinkType ?? null,
        })),
        ...sceneConfigs.map((cfg) => ({
          width: cfg.Width,
          height: cfg.Height,
          depth: cfg.Depth,
          sinkType: sinkType || null,
        })),
      ];
    } else if (sceneConfigs.length > 0) {
      productDimsList = sceneConfigs.map((cfg) => ({
        width: cfg.Width,
        height: cfg.Height,
        depth: cfg.Depth,
        sinkType: sinkType || null,
      }));
    } else {
      productDimsList = [
        {
          width: selectedDimensions.width,
          height: selectedDimensions.height,
          depth: selectedDimensions.depth,
          sinkType: sinkType || null,
        },
      ];
    }

    // 2) Countertop SKUs — Resolver 2 (per product)
    const seenCountertopSkus = new Set<string>();
    productDimsList.forEach((dims) => {
      const countertopSkuLines = buildCountertopSku({
        style: countertopStyle || null,
        width: dims.width,
        depth: dims.depth,
        thickness: countertopThickness || null,
        basinType: dims.sinkType,
        faucetHolesAmount: faucetHolesAmount || null,
        faucetHolesSpacing: faucetHolesSpacing || null,
        countertopMaterialSku: countertopColorSku || null,
        countertopColorCode: extractColorCode(countertopColor),
      });
      countertopSkuLines.forEach((line) => {
        if (!seenCountertopSkus.has(line)) {
          seenCountertopSkus.add(line);

          skus.push(line);
        }
      });
    });

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
        materialSku: countertopColorSku || null,
        colorCode: extractColorCode(countertopColor),
      });
      if (!seenVesselSkus.has(vesselSku)) {
        seenVesselSkus.add(vesselSku);
        console.log(LOG_PREFIX, `Resolver 2b (Vessel #${idx}):`, vesselSku);
        skus.push(vesselSku);
      }
    });

    // 3) Towel bar SKUs — Resolver 3 (global, same for all products)
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
          materialSku: cabinetColorSku || null,
        });
        if (spSku && !seenSpSkus.has(spSku)) {
          seenSpSkus.add(spSku);
          console.log(LOG_PREFIX, `Resolver 4 (SidePanel #${idx}):`, spSku);
          skus.push(spSku);
        }
      });
    }

    // Dividers — one per placed divider
    if (dividersStyle && dividersStyle !== "" && dividersStyle !== "None") {
      const divSku = buildDividerSku({ dividerStyle: dividersStyle });
      if (divSku) {
        const count = placedDividers.length > 0 ? placedDividers.length : cabinetCount;
        for (let i = 0; i < count; i++) {
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
    placedDividers.length,
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
            [...new Set(pending)].map(async (sku) => {
              try {
                console.log(LOG_PREFIX, "Fetching price for:", sku);

                const isVessel = sku.startsWith("VES-");
                const data = isVessel
                  ? await triggerResolveSkuPrice({ containerId: 1, sku }).unwrap()
                  : await triggerPriceBySku(sku).unwrap();

                console.log(LOG_PREFIX, "Response for", sku, "→", data);

                if (isVessel) {
                  const searchParts = sku.split("-").filter(Boolean);
                  triggerDebugSkuSearch({ tableId: 503, searchParts })
                    .unwrap()
                    .then((result) => console.log("[VESSEL]", "Debug SKU search for", sku, "→", result))
                    .catch((err) => console.warn("[VESSEL]", "Debug SKU search failed for", sku, err));
                }

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
