import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Outlet, useMatch, useNavigate } from "react-router-dom";

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
  setSelectedDimensions,
} from "@/entities/product/model/store/slice";
import { getHasPrebuiltSelections, getProductsPresets } from "@/entities/product/model/store/selectors";
import { BaseButton, ROUTES } from "@/shared";
import { AttentionPopup } from "@/shared/ui/Popups/ui/AttentionPopup/AttentionPopup";
import { removeAllProducts } from "@/utils/functions/playcanvas/removeAllProducts";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";

import s from "./ModelPage.module.scss";

const presetKeys: Array<keyof PresetProduct> = [
  "name",
  "Width",
  "Height",
  "Depth",
  "CabinetColor",
  "Drawers",
  "sinkType",
];

const arePresetsEqual = (left: PresetProduct[] = [], right: PresetProduct[] = []) => {
  if (left.length !== right.length) return false;

  return left.every((item, index) => {
    const compare = right[index];
    if (!compare) return false;

    return presetKeys.every((key) => (item[key] ?? null) === (compare[key] ?? null));
  });
};

export const ModelPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isDetail = !!useMatch("/prebuilt/model/:modelId");
  const isDefinedProductsRef = useRef(false);
  const productsPresets = useAppSelector(getProductsPresets);
  const hasPrebuiltSelections = useAppSelector(getHasPrebuiltSelections);

  const [isAttentionPopupOpen, setIsAttentionPopupOpen] = useState(false);
  const [sizeFilter, setSizeFilter] = useState<ProductSize | "all">("all");
  const [styleFilter, setStyleFilter] = useState<ProductStyle | "all">("all");

  const filteredData = useMemo(() => {
    return productMockData.filter((item) => {
      if (sizeFilter !== "all" && item.size !== sizeFilter) return false;
      if (styleFilter !== "all" && !item.style.includes(styleFilter)) return false;
      return true;
    });
  }, [sizeFilter, styleFilter]);

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

  const handleAddPreset = async (presetProducts?: PresetProduct[]) => {
    try {
      await addPreset(presetProducts);

      if (presetProducts) dispatch(addProductPreset(presetProducts));
      await updateSelectedDimensionsFromScene(presetProducts);
    } catch (error) {
      console.error("[ProductModelItem] Failed to apply preset", error);
    }
  };

  const handleCustomizePreset = async (presetProducts?: PresetProduct[]) => {
    if (!presetProducts?.length) return;

    removeAllProducts();
    await setConfigBatch({}, { TowelBar: "None", TowelBarSide: "both", TowelBarColor: "" });
    await setConfigBatch({}, { SidePanel: "None" });

    dispatch(reset());
    dispatch(resetCabinetBuilderBootstrap());
    dispatch(addProductPreset(presetProducts));
    navigate(ROUTES.CUSTOM);
  };

  const handleNavigate = async (tab: "prebuilt" | "custom") => {
    if (tab !== "custom") return;

    if (hasPrebuiltSelections) {
      setIsAttentionPopupOpen(true);
      return;
    }

    const currentPresets = productsPresets;

    removeAllProducts();
    await setConfigBatch({}, { TowelBar: "None", TowelBarSide: "both", TowelBarColor: "" });

    dispatch(reset());
    dispatch(resetCabinetBuilderBootstrap());
    if (currentPresets.length) {
      dispatch(addProductPreset(currentPresets));
    }
    navigate(ROUTES.CUSTOM);
  };

  const handleConfirmLeave = async () => {
    const currentPresets = productsPresets;

    removeAllProducts();
    await setConfigBatch({}, { TowelBar: "None", TowelBarSide: "both", TowelBarColor: "" });
    await setConfigBatch({}, { SidePanel: "None" });

    dispatch(reset());
    dispatch(resetCabinetBuilderBootstrap());
    if (currentPresets.length) {
      dispatch(addProductPreset(currentPresets));
    }
    navigate(ROUTES.CUSTOM);
  };

  const canvasReady = usePlayCanvasReady();

  useEffect(() => {
    const hasInitialized = sessionStorage.getItem("prebuiltModelInitialized") === "1";

    if (!canvasReady || isDefinedProductsRef.current) return;
    if (hasInitialized && productsPresets.length) return;

    isDefinedProductsRef.current = true;

    const presetProducts = productsPresets.length ? productsPresets : productMockData[0].presetProducts;

    const run = async () => {
      try {
        await addPreset(presetProducts);

        if (!productsPresets.length) {
          dispatch(addProductPreset(presetProducts));
        }

        await updateSelectedDimensionsFromScene(presetProducts);
        sessionStorage.setItem("prebuiltModelInitialized", "1");
      } catch (error) {
        console.log(error);
      }
    };
    run();
  }, [canvasReady, dispatch, productsPresets, updateSelectedDimensionsFromScene]);

  const clearAllFilters = () => {
    setSizeFilter("all");
    setStyleFilter("all");
  };

  return (
    <div>
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
              <BaseButton size="sm" onClick={clearAllFilters}>
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
