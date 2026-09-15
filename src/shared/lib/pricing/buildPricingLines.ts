import { resolveCabinetDimensions } from "@/entities/configuration/model/identity";
import { calcTotalCountertopWidthCm } from "@/entities/countertop";
import {
  getAllowedVesselMaterialTokens,
  isSyntesiCountertopMaterialSku,
  normalizeMaterialToken,
  resolveDefaultThicknessFromRules,
} from "@/features/configurator-rule-core/countertop";
import { deriveBookMatchingChargeInfo, type BookMatchingCabinetInput } from "@/shared/lib/bookMatching";
import type { NormalizedProductConfigSnapshot } from "@/shared/lib/normalizeProductConfigSnapshot";
import {
  extractColorCode,
  getCountertopMaterialTokensBySku,
  getCountertopMaterialTokensFromBasinType,
  resolveCabinetPricingMaterialSku,
  resolveCountertopColorCodeFromCandidates,
  resolveCountertopColorSkuFromCandidates,
  resolveCountertopMaterialSkuFromBasinType,
  resolveCountertopMaterialSkuFromColorCode,
  resolveDefaultBasinByCountertopColor,
  resolveHandleGroovePricingMaterialSku,
  resolveOpenSideShelfSide,
  SIDE_PANEL_WIDTH_CM,
  TOWEL_BAR_DEFAULTS,
  vesselHeightCmMap,
} from "@/shared/lib/sku";

import { expandLineSkus } from "./pricingLines";
import type { PricingInput, PricingLine, PricingLineGroup } from "./types";

/**
 * The order lines of the current configuration (D02).
 *
 * Moved from `usePriceCalculation` without changing a resolver: the same SKUs in the same
 * order, but a product that used to be pushed N times is now one line with `quantity: N`,
 * and the countertop top carries the width it is priced for. The sidebar price and both
 * Summary pages read these lines, so they cannot disagree.
 */

const LOG_PREFIX = "[SKU/Price]";
const DEFAULT_COUNTERTOP_COLOR = "Cacao Orinoco FF MT";
const DEFAULT_SINK_TYPE = "Top_Tekorlux_Rectangular";
const normalizeCabinetToken = (value: string) => value.toLowerCase().replace(/[\s_]+/g, "-");

/** Position 0 of the countertop SKU lines is the top; the rest are told apart by their tokens. */
const countertopLineGroup = (sku: string, index: number): PricingLineGroup => {
  if (index === 0) return "countertop";
  if (sku.includes("-FAHO/")) return "faucetHoles";
  if (sku.endsWith("-HCUT")) return "holeCut";
  return "basin";
};

export const buildPricingLines = (input: PricingInput): PricingLine[] => {
  const {
    skuBuilders,
    activeProfile,
    colorSkuMaps: { cabinetColorSkuByName, handleGrooveColorSkuByName, countertopColorSkuCandidatesByValue },
    countertopRules,
    cabinetCatalog,
    shouldUsePresets,
    productIds,
    orderedProductIds,
    productsPresets,
    sceneConfigs,
    cabinetEntries,
    dimensionsByCabinet,
    activeCabinetType,
    selectedDimensions,
    selectedProductConfig,
    placedDividers: activePlacedDividers,
    placedCabinetStyles,
    cabinetColor,
    cabinetColorSku,
    handleGrooveColor,
    handleGrooveColorSku,
    countertopColor,
    countertopColorSku,
    vesselColor,
    countertopThickness,
    countertopStyle,
    sinkType,
    drawerPanelFluting,
    grainDirection,
    bookMatching,
    towelBarOption,
    towelBarColor,
    faucetHolesAmount,
    sidePanelsOption,
    sidePanelLeft,
    sidePanelRight,
  } = input;

  const profile = skuBuilders.profile;
  if (!profile) return [];

  const lines: PricingLine[] = [];
  const add = ({ quantity = 1, ...line }: Omit<PricingLine, "quantity"> & { quantity?: number }) => {
    if (quantity <= 0) return;
    lines.push({ ...line, quantity });
  };

  const grainSku = grainDirection === "GrainHorizontal" ? "H" : grainDirection === "GrainVertical" ? "V" : null;

  /** Resolve a PlayCanvas product name (e.g. "SinkBase60") → catalog code ("Sink-Base") */
  const resolveCabinetType = (productName: string | null): string | null => {
    if (!productName) return null;
    const normalized = normalizeCabinetToken(productName);
    const match = cabinetCatalog.typeCabinetRules.find((rule) => normalized.includes(normalizeCabinetToken(rule.code)));
    return match?.code ?? null;
  };

  const handleMaterialSku = handleGrooveColorSku || handleGrooveColorSkuByName.get(handleGrooveColor) || null;
  const firstPreset = productsPresets[0];
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
  const resolveHandleGrooveMaterialSku = (cabinetMaterialSku: string | null) =>
    resolveHandleGroovePricingMaterialSku({
      cabinetMaterialSku,
      colorName: handleGrooveColor,
      materialSku: handleMaterialSku,
    });
  const shouldUsePresetCountertopColor =
    shouldUsePresets && countertopColor === DEFAULT_COUNTERTOP_COLOR && Boolean(firstPreset?.CountertopColor);
  const shouldUsePresetSinkType = shouldUsePresets && sinkType === DEFAULT_SINK_TYPE && Boolean(firstPreset?.sinkType);
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
    resolveCountertopMaterialSkuFromBasinType(resolvedSinkType) ||
    null;
  const resolvedVesselColor = vesselColor;
  const vesselTypeForTokens = resolvedSinkType?.startsWith("Vessel_") ? resolvedSinkType : null;
  const allowedVesselMaterialTokens = vesselTypeForTokens
    ? Array.from(getAllowedVesselMaterialTokens(vesselTypeForTokens, activeProfile) ?? [])
    : [];
  const vesselPreferredMaterialTokens =
    allowedVesselMaterialTokens.length > 0
      ? allowedVesselMaterialTokens
      : [...getCountertopMaterialTokensBySku(resolvedCountertopMaterialSku), ...preferredCountertopMaterialTokens];
  const resolvedVesselColorCode = resolvedVesselColor
    ? resolveCountertopColorCodeFromCandidates({
        value: resolvedVesselColor,
        candidatesByValue: countertopColorSkuCandidatesByValue,
        preferredMaterialTokens: vesselPreferredMaterialTokens,
      })
    : null;
  const resolvedVesselMaterialSku = resolvedVesselColor
    ? (resolveCountertopMaterialSkuFromColorCode(resolvedVesselColorCode) ??
      resolveCountertopColorSkuFromCandidates({
        value: resolvedVesselColor,
        candidatesByValue: countertopColorSkuCandidatesByValue,
        preferredMaterialTokens: vesselPreferredMaterialTokens,
      }))
    : null;
  const effectiveCountertopColorCode = extractColorCode(resolvedCountertopColor);
  const effectiveCountertopMaterialSku =
    resolveCountertopMaterialSkuFromColorCode(effectiveCountertopColorCode) ?? resolvedCountertopMaterialSku;
  const syntesiMaterial = activeProfile?.ruleData.syntesi?.material ?? null;
  const isSyntesiCountertop =
    syntesiMaterial !== null &&
    (isSyntesiCountertopMaterialSku(effectiveCountertopMaterialSku, activeProfile) ||
      normalizeMaterialToken(resolvedSinkType ?? "").includes(normalizeMaterialToken(syntesiMaterial)));
  const isVesselCountertop = (countertopStyle || "").trim().toLowerCase() === "vessel";
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
  const configName = (cfg: NormalizedProductConfigSnapshot) =>
    cfg.ProductType ??
    cfg.productType ??
    (cfg.entityName ? resolveNameFromRaw(cfg.entityName) : null) ??
    (cfg._productId ? resolveNameFromRaw(cfg._productId) : null) ??
    cfg.name;
  const selectedProductName =
    typeof selectedProductConfig?.name === "string"
      ? selectedProductConfig.name
      : typeof activeCabinetType === "string"
        ? activeCabinetType
        : null;
  const sinkBaseCountForPricing = Math.max(
    1,
    shouldUsePresets
      ? productsPresets.filter((preset) => isSinkBaseName(preset.name ?? null)).length +
          sceneConfigs.filter((cfg) => isSinkBaseName(configName(cfg))).length
      : sceneConfigs.length > 0
        ? sceneConfigs.filter((cfg) => isSinkBaseName(configName(cfg))).length
        : isSinkBaseName(selectedProductName)
          ? 1
          : 0,
  );
  const sceneSinkBaseEntries = sceneConfigs.flatMap((cfg, index) =>
    isSinkBaseName(configName(cfg)) ? [{ id: `config-${index}`, sinkType: cfg.sinkType ?? resolvedSinkType }] : [],
  );
  const sinkBaseEntriesForPricing = shouldUsePresets
    ? [
        ...productsPresets
          .filter((preset) => isSinkBaseName(preset.name ?? null))
          .map((preset, index) => ({
            id: `preset-${index}`,
            sinkType: shouldUsePresetSinkType ? (preset.sinkType ?? resolvedSinkType) : resolvedSinkType,
          })),
        ...sceneSinkBaseEntries,
      ]
    : sceneConfigs.length > 0
      ? sceneSinkBaseEntries
      : isSinkBaseName(selectedProductName)
        ? [{ id: "fallback-0", sinkType: resolvedSinkType }]
        : [];
  const materialForThicknessRules =
    resolvedCountertopMaterialSku || resolveCountertopMaterialSkuFromBasinType(resolvedSinkType);
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
    activeCountertopStyle: countertopStyle || null,
  });
  const resolvedCountertopThickness =
    countertopThickness || sceneConfigs[0]?.Thickness || matrixDefaultThickness || null;

  // 1) Product SKU(s) — Resolver 1
  const selectedProductDrawerStyle =
    typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : null;
  const getPlacedDrawerStyle = (id?: string | null) => (id ? (placedCabinetStyles[id] ?? null) : null);
  const getConfigDrawerStyle = (cfg: NormalizedProductConfigSnapshot) =>
    cfg.Drawers ?? getPlacedDrawerStyle(cfg.id) ?? getPlacedDrawerStyle(cfg._productId) ?? selectedProductDrawerStyle;
  const orderedCabinetProductIds = orderedProductIds.filter((id) => productIds.includes(id));
  const productOrder = new Map(
    (orderedProductIds.length ? orderedProductIds : productIds).map((id, index) => [id, index]),
  );
  const sortBySceneOrder = (left: NormalizedProductConfigSnapshot, right: NormalizedProductConfigSnapshot) =>
    (productOrder.get(left.id) ?? productOrder.get(left._productId) ?? Number.MAX_SAFE_INTEGER) -
    (productOrder.get(right.id) ?? productOrder.get(right._productId) ?? Number.MAX_SAFE_INTEGER);
  const sceneConfigsInSceneOrder = [...sceneConfigs].sort(sortBySceneOrder);

  const addSceneCabinet = (cfg: NormalizedProductConfigSnapshot, idx: number, handle: string | null) => {
    const resolvedType = resolveCabinetType(cfg.name) ?? resolveCabinetType(cfg.id) ?? activeCabinetType;
    const normalizedName = normalizeCabinetToken(cfg.name ?? cfg.id ?? "");
    const swatchValue = cfg.CabinetColor ?? cabinetColor;
    const id = `cabinet:${cfg.id}`;

    // Open Shelf → VAN-UROS-2S-{W}W-{H}H-{D}D-CAB-{mat}-{color}
    if (normalizedName.includes("open-shelf") || normalizedName.includes("openshelf")) {
      const cabinetMaterialSku = resolveCabinetMaterialSku(swatchValue);
      add({
        id,
        group: "openShelf",
        sourceId: cfg.id,
        sku: skuBuilders.buildOpenShelfSku({
          width: cfg.Width,
          height: cfg.Height,
          depth: cfg.Depth,
          cabinetMaterialSku,
          cabinetColorCode: resolveMaterialColorCode(swatchValue, cabinetMaterialSku),
          grainDirection: grainSku,
        }),
      });
      return;
    }

    // Open Side Shelf → VAN-UROSS-{L|R}-{W}W-{H}H-{D}D
    if (normalizedName.includes("side-shelf") || normalizedName.includes("sideshelf")) {
      const side = resolveOpenSideShelfSide({
        productIds: [cfg.id, cfg._productId],
        orderedProductIds: orderedCabinetProductIds,
        fallbackIndex: idx,
      });
      const cabinetMaterialSku = resolveCabinetMaterialSku(swatchValue);
      add({
        id,
        group: "sideShelf",
        sourceId: cfg.id,
        sku: skuBuilders.buildOpenSideShelfSku({
          side,
          width: cfg.Width,
          height: cfg.Height,
          depth: cfg.Depth,
          cabinetMaterialSku,
          cabinetColorCode: resolveMaterialColorCode(swatchValue, cabinetMaterialSku),
          grainDirection: grainSku,
        }),
      });
      return;
    }

    const cabMaterialSku = resolveCabinetMaterialSku(swatchValue);
    const hdlMaterialSku = resolveHandleGrooveMaterialSku(cabMaterialSku);
    add({
      id,
      group: "cabinet",
      sourceId: cfg.id,
      sku: skuBuilders.buildProductSku({
        cabinetType: resolvedType,
        drawers: cfg.Drawers,
        handle,
        pattern: drawerPanelFluting || null,
        width: cfg.Width,
        height: cfg.Height,
        depth: cfg.Depth,
        cab: cabMaterialSku
          ? {
              materialSku: cabMaterialSku,
              colorCode: resolveMaterialColorCode(swatchValue, cabMaterialSku),
              grainDirection: grainSku,
            }
          : null,
        hdl: hdlMaterialSku
          ? { materialSku: hdlMaterialSku, colorCode: resolveMaterialColorCode(handleGrooveColor, hdlMaterialSku) }
          : null,
        msp: null,
        bkpl: null,
      }),
    });
  };

  if (shouldUsePresets) {
    // Prebuilt path: iterate presets
    productsPresets.forEach((preset, idx) => {
      const name = preset.name ?? "";
      const normalizedPresetName = normalizeCabinetToken(name);
      const normalizedPresetType = name ? name.replace(/[\s_]+/g, "-") : "";
      const id = `cabinet:preset-${idx}`;
      const sourceId = productIds[idx];
      const swatchValue = preset.CabinetColor ?? cabinetColor;

      // Open Shelf → VAN-UROS-2S-{W}W-{H}H-{D}D-CAB-{mat}-{color}
      if (normalizedPresetName.includes("open-shelf") || normalizedPresetName.includes("openshelf")) {
        const cabinetMaterialSku = resolveCabinetMaterialSku(swatchValue);
        add({
          id,
          group: "openShelf",
          sourceId,
          sku: skuBuilders.buildOpenShelfSku({
            width: preset.Width ?? null,
            height: preset.Height ?? null,
            depth: preset.Depth ?? null,
            cabinetMaterialSku,
            cabinetColorCode: resolveMaterialColorCode(swatchValue, cabinetMaterialSku),
            grainDirection: grainSku,
          }),
        });
        return;
      }

      // Open Side Shelf → VAN-UROSS-{L|R}-{W}W-{H}H-{D}D-CAB-{mat}-{color}
      if (normalizedPresetName.includes("side-shelf") || normalizedPresetName.includes("sideshelf")) {
        const side = resolveOpenSideShelfSide({ fallbackIndex: idx });
        const cabinetMaterialSku = resolveCabinetMaterialSku(swatchValue);
        add({
          id,
          group: "sideShelf",
          sourceId,
          sku: skuBuilders.buildOpenSideShelfSku({
            side,
            width: preset.Width ?? null,
            height: preset.Height ?? null,
            depth: preset.Depth ?? null,
            cabinetMaterialSku,
            cabinetColorCode: resolveMaterialColorCode(swatchValue, cabinetMaterialSku),
            grainDirection: grainSku,
          }),
        });
        return;
      }

      // Standard cabinet → VAN-URSTD-{type}/...
      // preset.name is already a catalog key ("Sink-Base", "Side-Cabinet", etc.)
      const resolvedType = normalizedPresetType || resolveCabinetType(name || null) || activeCabinetType;
      const recordedDimensions = resolveCabinetDimensions(cabinetEntries, dimensionsByCabinet, productIds[idx]);
      const cabMaterialSku = resolveCabinetMaterialSku(swatchValue);
      const hdlMaterialSku = resolveHandleGrooveMaterialSku(cabMaterialSku);
      add({
        id,
        group: "cabinet",
        sourceId,
        sku: skuBuilders.buildProductSku({
          cabinetType: resolvedType,
          drawers: preset.Drawers ?? null,
          handle: (selectedProductConfig?.Handle as string | undefined) || preset.Handle || null,
          pattern: drawerPanelFluting || null,
          width: preset.Width ?? null,
          height: recordedDimensions?.height ?? preset.Height ?? null,
          depth: recordedDimensions?.depth ?? preset.Depth ?? null,
          cab: cabMaterialSku
            ? {
                materialSku: cabMaterialSku,
                colorCode: resolveMaterialColorCode(swatchValue, cabMaterialSku),
                grainDirection: grainSku,
              }
            : null,
          hdl: hdlMaterialSku
            ? { materialSku: hdlMaterialSku, colorCode: resolveMaterialColorCode(handleGrooveColor, hdlMaterialSku) }
            : null,
          msp: null,
          bkpl: null,
        }),
      });
    });

    // Extra products added on top of presets (e.g. via sidebar in prebuilt mode)
    sceneConfigs.forEach((cfg, idx) =>
      addSceneCabinet(cfg, idx, (selectedProductConfig?.Handle as string | undefined) || cfg.Handle || null),
    );
  } else if (sceneConfigs.length > 0) {
    // Custom path: iterate all products from PlayCanvas
    sceneConfigs.forEach((cfg, idx) => addSceneCabinet(cfg, idx, cfg.Handle));
  } else {
    // Fallback: single product from selectedProductConfig
    const cabMaterialSku = resolveCabinetMaterialSku(cabinetColor);
    const hdlMaterialSku = resolveHandleGrooveMaterialSku(cabMaterialSku);
    add({
      id: "cabinet:selected",
      group: "cabinet",
      sourceId: productIds[0],
      sku: skuBuilders.buildProductSku({
        cabinetType: activeCabinetType,
        drawers: typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : null,
        handle: typeof selectedProductConfig?.Handle === "string" ? selectedProductConfig.Handle : null,
        pattern: drawerPanelFluting || null,
        width: selectedDimensions.width,
        height: selectedDimensions.height,
        depth: selectedDimensions.depth,
        cab: cabMaterialSku
          ? {
              materialSku: cabMaterialSku,
              colorCode: resolveMaterialColorCode(cabinetColor, cabMaterialSku),
              grainDirection: grainSku,
            }
          : null,
        hdl: hdlMaterialSku
          ? { materialSku: hdlMaterialSku, colorCode: resolveMaterialColorCode(handleGrooveColor, hdlMaterialSku) }
          : null,
        msp: null,
        bkpl: null,
      }),
    });
  }

  // ── Collect per-product dimension sets for resolvers 2-4 ──
  // Prebuilt: each preset has its own W/H/D + sinkType
  // Custom:   each sceneConfig has its own W/H/D (sinkType global)
  // Fallback: single selectedDimensions
  type ProductDims = {
    productId: string | null;
    width: number | null;
    height: number | null;
    depth: number | null;
    sinkType: string | null;
  };
  let productDimsList: ProductDims[];
  let bookMatchingCabinets: BookMatchingCabinetInput[];

  if (shouldUsePresets) {
    productDimsList = [
      ...productsPresets.map((p, index) => ({
        productId: productIds[index] ?? null,
        width: p.Width ?? null,
        height: p.Height ?? null,
        depth:
          resolveCabinetDimensions(cabinetEntries, dimensionsByCabinet, productIds[index])?.depth ?? p.Depth ?? null,
        sinkType: shouldUsePresetSinkType ? (p.sinkType ?? resolvedSinkType) : resolvedSinkType,
      })),
      ...sceneConfigsInSceneOrder.map((cfg) => ({
        productId: cfg.id ?? cfg._productId,
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
      ...sceneConfigsInSceneOrder.map((cfg) => ({
        name: configName(cfg),
        drawers: getConfigDrawerStyle(cfg),
      })),
    ];
  } else if (sceneConfigs.length > 0) {
    productDimsList = sceneConfigs.map((cfg) => ({
      productId: cfg.id ?? cfg._productId,
      width: cfg.Width,
      height: cfg.Height,
      depth: cfg.Depth,
      sinkType: resolvedSinkType,
    }));
    bookMatchingCabinets = sceneConfigsInSceneOrder.map((cfg) => ({
      name: configName(cfg),
      drawers: getConfigDrawerStyle(cfg),
    }));
  } else {
    productDimsList = [
      {
        productId: productIds[0] ?? null,
        width: selectedDimensions.width,
        height: selectedDimensions.height,
        depth: selectedDimensions.depth,
        sinkType: resolvedSinkType,
      },
    ];
    bookMatchingCabinets = [
      {
        name: selectedProductName,
        drawers: typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : null,
      },
    ];
  }

  // 2) Countertop SKUs — Resolver 2
  // Add aggregate (full composition) countertop SKU so Summary line has a matching price key.
  const cabinetWidthSum = productDimsList.reduce((sum, dims) => sum + (dims.width ?? 0), 0);
  const totalCountertopWidth = calcTotalCountertopWidthCm(cabinetWidthSum, sidePanelLeft, sidePanelRight);

  const aggregateCountertopInput = {
    style: countertopStyle || null,
    width: totalCountertopWidth,
    depth: selectedDimensions.depth,
    thickness: resolvedCountertopThickness,
    basinType: resolvedSinkType,
    faucetHolesAmount: faucetHolesAmount || null,
    countertopMaterialSku: effectiveCountertopMaterialSku,
    countertopColorCode: effectiveCountertopColorCode,
  };
  const aggregateCountertopLines = skuBuilders.buildCountertopSkuIfComplete(aggregateCountertopInput);
  const aggregateCountertopSkuSet = new Set(aggregateCountertopLines);
  aggregateCountertopLines.forEach((line, index) => {
    const isIntegratedBasinSkuLine = index === 1 && !isVesselCountertop;
    if (isIntegratedBasinSkuLine && isSyntesiCountertop) return;

    if (isIntegratedBasinSkuLine && sinkBaseEntriesForPricing.length > 0) {
      sinkBaseEntriesForPricing.forEach((entry) => {
        const basinLine =
          skuBuilders.buildCountertopSkuIfComplete({
            style: countertopStyle || null,
            width: totalCountertopWidth,
            depth: selectedDimensions.depth,
            thickness: resolvedCountertopThickness,
            basinType: entry.sinkType || null,
            faucetHolesAmount: faucetHolesAmount || null,
            countertopMaterialSku: effectiveCountertopMaterialSku,
            countertopColorCode: effectiveCountertopColorCode,
          })[1] ?? line;
        add({ id: `countertop:basin:${entry.id}`, group: "basin", sku: basinLine });
      });
      return;
    }
    const repeatCount = index === 1 && resolvedSinkType ? sinkBaseCountForPricing : 1;
    add({
      id: `countertop:${index}`,
      group: countertopLineGroup(line, index),
      sku: line,
      quantity: repeatCount,
      ...(index === 0 && totalCountertopWidth != null ? { widthCm: totalCountertopWidth } : {}),
    });
  });

  // Always keep a default faucet-holes pricing SKU in the pool (including "0"),
  // with dynamic material resolved from basin/material context.
  const faucetHolesQty = (faucetHolesAmount ?? "").trim() || "0";
  const faucetMaterialSku =
    resolveCountertopMaterialSkuFromColorCode(effectiveCountertopColorCode) ??
    resolveCountertopMaterialSkuFromBasinType(resolvedSinkType) ??
    effectiveCountertopMaterialSku ??
    "HPL";
  const defaultFaucetSku = `CT-${profile.series.countertopPrefix}${faucetMaterialSku}-FAHO/${faucetHolesQty}`;
  if (!aggregateCountertopSkuSet.has(defaultFaucetSku)) {
    add({ id: "countertop:faucetDefault", group: "faucetHoles", sku: defaultFaucetSku });
  }

  // Do not add per-product countertop lines to active pricing SKUs.
  // They duplicate the aggregate countertop pricing line and inflate totals
  // (e.g. counting both CT-UR...INTG-70.9W and CT-UR...INTG-23.6W).

  // 2b) Vessel basin SKU — Resolver 2b (when sinkType is a vessel type)
  const vesselType = resolvedSinkType?.startsWith("Vessel_") ? resolvedSinkType : null;
  if (vesselType) {
    const vesselSku = skuBuilders.buildVesselSku({
      vesselType,
      width: totalCountertopWidth,
      height: vesselHeightCmMap[vesselType] ?? null,
      depth: selectedDimensions.depth,
      materialSku: resolvedVesselMaterialSku,
      colorCode: resolvedVesselColorCode,
    });
    console.log(LOG_PREFIX, "Resolver 2b (Vessel):", vesselSku, "×", sinkBaseCountForPricing);
    add({ id: "vessel", group: "vessel", sku: vesselSku, quantity: sinkBaseCountForPricing });
  }

  // 3) Towel bar SKUs — Resolver 3 (global, same for all products)
  const hasTowel = towelBarOption && towelBarOption !== "None";
  const hasRight = towelBarOption === "Right" || towelBarOption === "Both";
  const hasLeft = towelBarOption === "Left" || towelBarOption === "Both";

  if (hasTowel && hasRight) {
    const sku = skuBuilders.buildTowelBarSku({
      side: "R",
      width: TOWEL_BAR_DEFAULTS.width,
      height: TOWEL_BAR_DEFAULTS.height,
      depth: TOWEL_BAR_DEFAULTS.depth,
      materialSku: "LACM",
      colorCode: towelBarColor || null,
    });
    if (sku) add({ id: "towelBar:right", group: "towelBar", sku });
  }

  if (hasTowel && hasLeft) {
    const sku = skuBuilders.buildTowelBarSku({
      side: "L",
      width: TOWEL_BAR_DEFAULTS.width,
      height: TOWEL_BAR_DEFAULTS.height,
      depth: TOWEL_BAR_DEFAULTS.depth,
      materialSku: "LACM",
      colorCode: towelBarColor || null,
    });
    if (sku) add({ id: "towelBar:left", group: "towelBar", sku });
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
      const sidePanelCabinetMaterialSku =
        resolveCabinetMaterialSku(sidePanelCabinetColor) || inferSidePanelMaterialSku(sidePanelCabinetColor);
      const spSku = skuBuilders.buildSidePanelSku({
        panelType: sidePanelsOption,
        width: SIDE_PANEL_WIDTH_CM,
        height: dims.height,
        depth: dims.depth,
        cabMaterialSku: sidePanelCabinetMaterialSku,
        cabColorCode: resolveMaterialColorCode(sidePanelCabinetColor, sidePanelCabinetMaterialSku),
        hdlMaterialSku: handleMaterialSku,
        hdlColorCode: resolveMaterialColorCode(handleGrooveColor, handleMaterialSku),
      });
      if (spSku) add({ id: "sidePanel", group: "sidePanel", sku: spSku, quantity: activeSideCount });
    }
  }

  // Dividers are priced only from actual per-slot placements.
  // DividersStyle is just the currently selected placement tool.
  const resolveDividerDepth = (cabinetId: string): number | null =>
    productDimsList.find((dims) => dims.productId === cabinetId)?.depth ?? null;

  if (activePlacedDividers.length > 0) {
    const typeToStyle: Record<"A" | "B" | "C", "Option A" | "Option B" | "Option C"> = {
      A: "Option A",
      B: "Option B",
      C: "Option C",
    };

    activePlacedDividers.forEach((divider, index) => {
      const style = typeToStyle[divider.type];
      const divSku = style
        ? skuBuilders.buildDividerSku({ dividerStyle: style, cabinetDepth: resolveDividerDepth(divider.cabinetId) })
        : null;
      if (!divSku) return;
      console.log(LOG_PREFIX, `Resolver 4 (Divider #${index + 1}):`, divSku, divider);
      add({ id: `divider:${divider.cabinetId}:${index}`, group: "divider", sku: divSku, sourceId: divider.cabinetId });
    });
  }

  // 5) Book matching SKU — pricing modifier (per drawer)
  const bookMatchingInfo = deriveBookMatchingChargeInfo({
    grainDirection,
    bookMatching,
    materialSku: resolveCabinetMaterialSku(cabinetColor),
    cabinets: bookMatchingCabinets,
    profile: activeProfile,
    skuProfile: profile,
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
    add({ id: "bookMatching", group: "bookMatching", sku: bookMatchingInfo.sku, quantity: bookMatchingInfo.drawerQty });
  }

  console.log(LOG_PREFIX, "All SKUs:", expandLineSkus(lines));
  return lines;
};
