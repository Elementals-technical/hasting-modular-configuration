import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Outlet, useMatch, useNavigate, useSearchParams } from "react-router-dom";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";
import { CreateModelBtn } from "@/entities/product/ui/createModelBtn/CreateModelBtn";

import { type PresetProduct, type ProductSize, type ProductStyle } from "@/entities/product/types";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import { ModeSwitcher } from "@/shared/ui/ModeSwitcher/ModeSwitcher";

import { productMockData, ProductModelsGrid } from "@/entities/product/ui/ProductModelsGrid/ProductModelsGrid";
import { addPreset } from "@/utils/functions/playcanvas/addPreset";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  addProductPreset,
  reset,
  resetCabinetBuilderBootstrap,
  setActiveBasinStyle,
  setActiveCountertopColor,
  setCountertopColorSku,
  setCountertopStyle,
  setFaucetHolesAmount,
  setCabinetColor,
  setHandleGrooveColor,
  setSelectedDimensions,
} from "@/entities/product/model/store/slice";
import { getProductsPresets } from "@/entities/product/model/store/selectors";
import { findCountertopSkuByColorName } from "@/features/configurator-rule-core/countertop";
import { useGetConfiguratorQuery } from "@/entities";
import { BaseButton, ROUTES } from "@/shared";
import { AttentionPopup } from "@/shared/ui/Popups/ui/AttentionPopup/AttentionPopup";
import { removeAllProducts } from "@/utils/functions/playcanvas/removeAllProducts";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { resetSidePanels } from "@/utils/functions/playcanvas/resetSidePanels";
import { useLazyRestoreConfigurationQuery } from "@/entities";
import { buildPresetFromConfiguration } from "@/utils/buildPresetFromConfiguration";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { reapplySidePanelsForPreset } from "@/features/sidePanel";
import { getSidePanelsOption } from "@/entities/product/model/store/selectors";
import { clearHistory } from "@/entities/history/model/store/slice";
import { applySwatchOrderFromMetadata } from "@/features/swatchOrder";

import s from "./ModelPage.module.scss";

const presetKeys: Array<keyof PresetProduct> = [
  "name",
  "Width",
  "Height",
  "Depth",
  "CabinetColor",
  "CountertopColor",
  "Drawers",
  "sinkType",
];

const inferCountertopStyleFromSinkType = (sinkType: string): "Vessel" | "Integrated" => {
  const trimmed = sinkType.trim();
  if (trimmed === "Vessel" || trimmed.startsWith("Vessel_")) return "Vessel";
  return "Integrated";
};

const resolvePresetSceneDefaults = (presetProducts?: PresetProduct[]) => {
  if (!presetProducts?.length) return {};

  const firstWithCountertop = presetProducts.find(
    (p) => typeof p.CountertopColor === "string" && p.CountertopColor.trim(),
  );
  const firstWithSink = presetProducts.find((p) => typeof p.sinkType === "string" && p.sinkType.trim());

  const globalConfig: Record<string, string> = {};
  if (firstWithCountertop?.CountertopColor) globalConfig.CountertopColor = firstWithCountertop.CountertopColor;
  if (firstWithSink?.sinkType) {
    globalConfig.sinkType = firstWithSink.sinkType;
    globalConfig.CountertopStyle = inferCountertopStyleFromSinkType(firstWithSink.sinkType);
  }

  return globalConfig;
};

const arePresetsEqual = (left: PresetProduct[] = [], right: PresetProduct[] = []) => {
  if (left.length !== right.length) return false;

  return left.every((item, index) => {
    const compare = right[index];
    if (!compare) return false;

    return presetKeys.every((key) => (item[key] ?? null) === (compare[key] ?? null));
  });
};

export const ModelPage = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDetail = !!useMatch("/prebuilt/model/:modelId");
  const isDefinedProductsRef = useRef(false);
  const productsPresets = useAppSelector(getProductsPresets);
  const spGroove = useAppSelector(getSidePanelsOption);
  const { data: configuratorData } = useGetConfiguratorQuery({ id: 4, view: "full", serialize: true });
  const [isAttentionPopupOpen, setIsAttentionPopupOpen] = useState(false);
  const [sizeFilter, setSizeFilter] = useState<ProductSize | "all">("all");
  const [styleFilter, setStyleFilter] = useState<ProductStyle | "all">("all");
  const modelScrollPositionKey = "prebuilt:model:scrollTop";
  const modelScrollRestoreFlagKey = "prebuilt:model:restore-scroll";

  const getStepContentContainer = useCallback(() => {
    const container = rootRef.current?.closest('[data-scroll-container="step-content"]');
    return container instanceof HTMLElement ? container : null;
  }, []);

  const filteredData = useMemo(() => {
    return productMockData.filter((item) => {
      if (sizeFilter !== "all" && item.size !== sizeFilter) return false;
      if (styleFilter !== "all" && !item.style.includes(styleFilter)) return false;
      return true;
    });
  }, [sizeFilter, styleFilter]);

  const presetIdFromUrl = useMemo(() => {
    const rawPresetId = searchParams.get("preset");
    if (!rawPresetId) return null;

    const parsedPresetId = Number(rawPresetId);
    if (!Number.isFinite(parsedPresetId)) return null;

    return parsedPresetId;
  }, [searchParams]);
  const configIdFromUrl = useMemo(() => searchParams.get("configId"), [searchParams]);
  const [restoreConfiguration] = useLazyRestoreConfigurationQuery();

  const presetFromUrl = useMemo(() => {
    if (presetIdFromUrl === null) return null;
    return productMockData.find((item) => item.id === presetIdFromUrl) ?? null;
  }, [presetIdFromUrl]);

  const handleSizeFilter = useCallback((value?: string | number) => {
    if (value === undefined) {
      setSizeFilter("all");
      return;
    }
    setSizeFilter(value === "all" ? "all" : (value as ProductSize));
  }, []);

  const handleStyleFilter = useCallback((value?: string | number) => {
    if (value === undefined) {
      setStyleFilter("all");
      return;
    }
    setStyleFilter(value === "all" ? "all" : (value as ProductStyle));
  }, []);

  // Define Selected dimentions for the countertop logic.
  const updateSelectedDimensionsFromScene = useCallback(
    async (presetProducts?: PresetProduct[]) => {
      if (!presetProducts?.length) return;

      const entries = await Promise.all(
        presetProducts.map(async (preset) => {
          const name = preset.name;
          if (!name) return null;

          const config = await getConfig(name);
          const width =
            typeof config?.Width === "number" ? config.Width : typeof preset.Width === "number" ? preset.Width : null;
          const depth =
            typeof config?.Depth === "number" ? config.Depth : typeof preset.Depth === "number" ? preset.Depth : null;
          const height =
            typeof config?.Height === "number"
              ? config.Height
              : typeof preset.Height === "number"
                ? preset.Height
                : null;

          return { width, depth, height };
        }),
      );

      const first = entries.find(
        (entry) => entry && (entry.width !== null || entry.depth !== null || entry.height !== null),
      );
      if (!first) return;

      const next: { width?: number; depth?: number; height?: number } = {};
      if (first.width !== null) next.width = first.width;
      if (first.depth !== null) next.depth = first.depth;
      if (first.height !== null) next.height = first.height;

      if (Object.keys(next).length) {
        dispatch(setSelectedDimensions(next));
      }
    },
    [dispatch],
  );

  const activePresetId = useMemo(() => {
    const target = productsPresets.length ? productsPresets : (productMockData[0]?.presetProducts ?? []);

    const match = productMockData.find((preset) => arePresetsEqual(preset.presetProducts, target));

    return match?.id ?? productMockData[0]?.id ?? null;
  }, [productsPresets]);

  const handleAddPreset = useCallback(
    async (presetProducts?: PresetProduct[], presetId?: number, options?: { syncUrl?: boolean }) => {
      try {
        const globalConfig = resolvePresetSceneDefaults(presetProducts);
        await addPreset(presetProducts, globalConfig);

        if (presetProducts) {
          dispatch(addProductPreset(presetProducts));
          if (globalConfig.CountertopColor) {
            dispatch(setActiveCountertopColor(globalConfig.CountertopColor));
            const sku = findCountertopSkuByColorName(configuratorData, globalConfig.CountertopColor);
            if (sku) dispatch(setCountertopColorSku(sku));
          }
          if (globalConfig.sinkType) dispatch(setActiveBasinStyle(globalConfig.sinkType));
          if (globalConfig.CountertopStyle) dispatch(setCountertopStyle(globalConfig.CountertopStyle));
        }
        await updateSelectedDimensionsFromScene(presetProducts);

        // Re-apply side panels to match the new preset's handle/height/drawers
        if (spGroove && spGroove !== "None" && presetProducts?.length) {
          await reapplySidePanelsForPreset(dispatch, spGroove, presetProducts, presetProducts.length);
        }

        const presetCabinetColor = presetProducts?.find((p) => typeof p.CabinetColor === "string" && p.CabinetColor)?.CabinetColor;
        if (presetCabinetColor) dispatch(setCabinetColor(presetCabinetColor));

        dispatch(clearHistory());

        if (presetId && options?.syncUrl !== false) {
          const nextSearchParams = new URLSearchParams(searchParams);
          nextSearchParams.set("preset", String(presetId));
          setSearchParams(nextSearchParams);
        }
      } catch (error) {
        console.error("[ProductModelItem] Failed to apply preset", error);
      }
    },
    [configuratorData, dispatch, searchParams, setSearchParams, updateSelectedDimensionsFromScene, spGroove],
  );

  const resetAccessoriesForCustomTransition = useCallback(async () => {
    await setConfigBatch({}, { TowelBar: "None", TowelBarSide: "both", TowelBarColor: "" });
    await resetSidePanels();
  }, []);

  const rehydrateCountertopFromPresets = (presetProducts: PresetProduct[]) => {
    const color = presetProducts.find((p) => typeof p.CountertopColor === "string" && p.CountertopColor)?.CountertopColor;
    const sinkType = presetProducts.find((p) => typeof p.sinkType === "string" && p.sinkType)?.sinkType;

    if (color) {
      dispatch(setActiveCountertopColor(color));
      const sku = findCountertopSkuByColorName(configuratorData, color);
      if (sku) dispatch(setCountertopColorSku(sku));
    }
    if (sinkType) {
      dispatch(setActiveBasinStyle(sinkType));
      dispatch(setCountertopStyle(inferCountertopStyleFromSinkType(sinkType)));
    }
  };

  const handleCustomizePreset = async (presetProducts?: PresetProduct[]) => {
    if (!presetProducts?.length) return;

    await resetAccessoriesForCustomTransition();
    await removeAllProducts();

    dispatch(reset());
    dispatch(resetCabinetBuilderBootstrap());
    dispatch(addProductPreset(presetProducts));
    rehydrateCountertopFromPresets(presetProducts);
    navigate(ROUTES.CUSTOM);
  };

  const handleNavigate = async (tab: "prebuilt" | "custom") => {
    if (tab !== "custom") return;

    // Sync HandleGrooveColor from the scene to slice before navigating. In
    // prebuilt the groove color may exist only on the PlayCanvas products and
    // not in productOptions; the cabinet-builder bootstrap then falls back to
    // cabinetColor, losing the real value. Pre-populating the slice ensures
    // bootstrap uses the scene's groove color.
    const orderedIds = getOrderedProductIds();
    for (const productId of orderedIds) {
      const config = await getConfig(productId);
      const sceneGroove =
        config && typeof config === "object" ? (config as Record<string, unknown>).HandleGrooveColor : undefined;
      if (typeof sceneGroove === "string" && sceneGroove.trim()) {
        dispatch(setHandleGrooveColor(sceneGroove));
        break;
      }
    }

    // We need to reset the store before navigation because it registers
    // productIds in the store, applies placedCabinetStyles, selectedProductConfig,
    // dimensions and activeCabinetType — so products become deletable and newly
    // added cabinets inherit current colors — without wiping scene extras
    // (side panels, towel bar).
    navigate(ROUTES.CUSTOM);
  };

  const handleConfirmLeave = async () => {
    const currentPresets = productsPresets;

    await resetAccessoriesForCustomTransition();
    await removeAllProducts();

    dispatch(reset());
    dispatch(resetCabinetBuilderBootstrap());
    if (currentPresets.length) {
      dispatch(addProductPreset(currentPresets));
      rehydrateCountertopFromPresets(currentPresets);
    }
    navigate(ROUTES.CUSTOM);
  };

  const canvasReady = usePlayCanvasReady();

  useEffect(() => {
    if (!canvasReady || !configIdFromUrl || isDefinedProductsRef.current) return;

    isDefinedProductsRef.current = true;

    const run = async () => {
      try {
        const result = await restoreConfiguration(configIdFromUrl).unwrap();

        applySwatchOrderFromMetadata(result?.metadata as Record<string, unknown> | undefined, dispatch);

        const configuration = result?.configuration || {};
        const orderedIdsFromMeta = result?.metadata?.orderedProductIds;
        const sourceIds = Array.isArray(orderedIdsFromMeta)
          ? orderedIdsFromMeta.filter((id) => typeof id === "string")
          : [];

        const isTopConfig = (id: string, value: unknown) => {
          if (!value || typeof value !== "object") return false;

          const record = value as Record<string, unknown>;
          const name =
            (typeof record.productType === "string" && record.productType) ||
            (typeof record.ProductType === "string" && record.ProductType) ||
            (typeof record.entityName === "string" && record.entityName) ||
            (typeof record.EntityName === "string" && record.EntityName) ||
            id;

          return name.startsWith("Top_");
        };

        const configIdsRaw = sourceIds.length ? sourceIds : Object.keys(configuration);
        const productConfigIds = configIdsRaw.filter((id) => !isTopConfig(id, configuration[id]));
        const presetProducts = buildPresetFromConfiguration(configuration, productConfigIds);
        if (!presetProducts.length) return;

        const uiState = result?.metadata?.uiState;
        const uiStateValues = uiState && typeof uiState === "object" ? (uiState as Record<string, unknown>) : null;

        await removeAllProducts();

        const restoredCountertopColor =
          (typeof uiStateValues?.CountertopColor === "string" && uiStateValues.CountertopColor) || undefined;
        const restoredCountertopColorSku =
          (typeof uiStateValues?.CountertopColorSku === "string" && uiStateValues.CountertopColorSku) || undefined;
        const restoredFaucetHolesAmount =
          (typeof uiStateValues?.FaucetHolesAmount === "string" && uiStateValues.FaucetHolesAmount) || undefined;
        const restoredSinkType = (typeof uiStateValues?.sinkType === "string" && uiStateValues.sinkType) || undefined;
        const globalConfig = {
          ...resolvePresetSceneDefaults(presetProducts),
          ...(restoredCountertopColor ? { CountertopColor: restoredCountertopColor } : {}),
          ...(restoredSinkType ? { sinkType: restoredSinkType } : {}),
        };

        await addPreset(presetProducts, globalConfig);

        // Rebuild presets from real scene configs to keep SKU-driving fields
        // (name/drawers/handle/dimensions) consistent after restore.
        const sceneIds = getOrderedProductIds();
        const sceneConfigs = await Promise.all(sceneIds.map((id) => getConfig(id)));
        const sceneConfiguration = sceneIds.reduce<Record<string, unknown>>((acc, id, index) => {
          acc[id] = sceneConfigs[index];
          return acc;
        }, {});
        const scenePresets = buildPresetFromConfiguration(sceneConfiguration, sceneIds);
        const effectivePresets = scenePresets.length ? scenePresets : presetProducts;
        dispatch(reset());
        dispatch(resetCabinetBuilderBootstrap());
        dispatch(addProductPreset(effectivePresets));
        if (globalConfig.CountertopColor) {
          dispatch(setActiveCountertopColor(globalConfig.CountertopColor as string));
          if (restoredCountertopColorSku) {
            dispatch(setCountertopColorSku(restoredCountertopColorSku));
          } else {
            const sku = findCountertopSkuByColorName(configuratorData, globalConfig.CountertopColor as string);
            if (sku) dispatch(setCountertopColorSku(sku));
          }
        } else if (restoredCountertopColorSku) {
          dispatch(setCountertopColorSku(restoredCountertopColorSku));
        }
        if (restoredFaucetHolesAmount) dispatch(setFaucetHolesAmount(restoredFaucetHolesAmount));
        if (globalConfig.sinkType) dispatch(setActiveBasinStyle(globalConfig.sinkType as string));
        if (globalConfig.CountertopStyle) dispatch(setCountertopStyle(globalConfig.CountertopStyle as string));
        await updateSelectedDimensionsFromScene(effectivePresets);
        sessionStorage.setItem("prebuiltModelInitialized", "1");
      } catch (error) {
        console.error("[Prebuilt] Failed to restore configuration", error);
      }
    };

    run();
  }, [canvasReady, configIdFromUrl, configuratorData, dispatch, restoreConfiguration, updateSelectedDimensionsFromScene]);

  useEffect(() => {
    const hasInitialized = sessionStorage.getItem("prebuiltModelInitialized") === "1";

    if (!canvasReady || isDefinedProductsRef.current) return;
    if (configIdFromUrl) return;
    if (hasInitialized && productsPresets.length && !presetFromUrl) return;

    isDefinedProductsRef.current = true;

    const presetProducts =
      presetFromUrl?.presetProducts ?? (productsPresets.length ? productsPresets : productMockData[0].presetProducts);

    const run = async () => {
      try {
        const globalConfig = resolvePresetSceneDefaults(presetProducts);
        await addPreset(presetProducts, globalConfig);

        if (!productsPresets.length) {
          dispatch(addProductPreset(presetProducts));
          if (globalConfig.CountertopColor) {
            dispatch(setActiveCountertopColor(globalConfig.CountertopColor));
            const sku = findCountertopSkuByColorName(configuratorData, globalConfig.CountertopColor);
            if (sku) dispatch(setCountertopColorSku(sku));
          }
          if (globalConfig.sinkType) dispatch(setActiveBasinStyle(globalConfig.sinkType));
          if (globalConfig.CountertopStyle) dispatch(setCountertopStyle(globalConfig.CountertopStyle));
        }

        await updateSelectedDimensionsFromScene(presetProducts);
        sessionStorage.setItem("prebuiltModelInitialized", "1");

        const presetCabinetColor = presetProducts.find((p) => typeof p.CabinetColor === "string" && p.CabinetColor)?.CabinetColor;
        if (presetCabinetColor) dispatch(setCabinetColor(presetCabinetColor));

        dispatch(clearHistory());
      } catch (error) {
        console.log(error);
      }
    };
    run();
  }, [canvasReady, configIdFromUrl, configuratorData, dispatch, presetFromUrl, productsPresets, updateSelectedDimensionsFromScene]);

  useEffect(() => {
    if (!canvasReady || !presetFromUrl) return;
    if (configIdFromUrl) return;
    if (!productsPresets.length) return;
    if (arePresetsEqual(productsPresets, presetFromUrl.presetProducts)) return;

    const run = async () => {
      await handleAddPreset(presetFromUrl.presetProducts, presetFromUrl.id, { syncUrl: false });
    };

    run();
  }, [canvasReady, configIdFromUrl, handleAddPreset, presetFromUrl, productsPresets]);

  useEffect(() => {
    if (isDetail) return;

    const container = getStepContentContainer();
    if (!container) return;

    if (sessionStorage.getItem(modelScrollRestoreFlagKey) !== "1") return;

    const storedTop = Number(sessionStorage.getItem(modelScrollPositionKey));
    if (!Number.isFinite(storedTop)) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.scrollTop = storedTop;
      });
    });

    sessionStorage.removeItem(modelScrollRestoreFlagKey);
  }, [getStepContentContainer, isDetail]);

  const clearAllFilters = () => {
    setSizeFilter("all");
    setStyleFilter("all");
  };

  return (
    <div ref={rootRef}>
      {!isDetail && (
        <>
          <ModeSwitcher onClick={handleNavigate} />

          <FilterRow className={s.filterRow}>
            <FilterItem
              label="Size"
              value={sizeFilter === "all" ? undefined : sizeFilter}
              options={[
                { label: "All", value: "all" },
                { label: "24–29″", value: "24_29" },
                { label: "30–39″", value: "30_39" },
                { label: "40–49″", value: "40_49" },
                { label: "50–59″", value: "50_59" },
                { label: "60–69″", value: "60_69" },
                { label: "70–79″", value: "70_79" },
                { label: "80–89″", value: "80_89" },
                { label: "90″+", value: "90_plus" },
              ]}
              onSelect={handleSizeFilter}
            />

            <FilterItem
              label="Style"
              value={styleFilter === "all" ? undefined : styleFilter}
              options={[
                { label: "All", value: "all" },
                { label: "1 Drawer", value: "1_drawer" },
                { label: "2 Drawer", value: "2_drawer" },
                { label: "Single Basin", value: "single_basin" },
                { label: "Double Basin", value: "double_basin" },
                { label: "Asymmetrical", value: "asymmetrical" },
                { label: "Open Shelving", value: "open_shelving" },
              ]}
              onSelect={handleStyleFilter}
            />

            {(sizeFilter !== "all" || styleFilter !== "all") && (
              <BaseButton variant="filterBtn" onClick={clearAllFilters}>
                Clear All
              </BaseButton>
            )}
          </FilterRow>

          <ProductModelsGrid
            data={filteredData}
            handleAddPreset={handleAddPreset}
            handleCustomizePreset={handleCustomizePreset}
            createModelBtn={<CreateModelBtn />}
            activePresetId={activePresetId}
          />
        </>
      )}

      <Outlet />

      <AttentionPopup
        isOpening={isAttentionPopupOpen}
        setIsOpening={setIsAttentionPopupOpen}
        onConfirm={handleConfirmLeave}
      />
    </div>
  );
};
