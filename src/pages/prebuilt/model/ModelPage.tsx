import { useEffect, useMemo, useRef } from "react";
import { Outlet, useMatch, useNavigate } from "react-router-dom";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";
import { CreateModelBtn } from "@/entities/product/ui/createModelBtn/CreateModelBtn";

import { type PresetProduct } from "@/entities/product/types";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";

import { productMockData, ProductModelsGrid } from "@/entities/product/ui/ProductModelsGrid/ProductModelsGrid";
import { addPreset } from "@/utils/functions/playcanvas/addPreset";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { addProductPreset } from "@/entities/product/model/store/slice";
import { getProductsPresets } from "@/entities/product/model/store/selectors";
import { ROUTES } from "@/shared";

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

  const activePresetId = useMemo(() => {
    const target = productsPresets.length ? productsPresets : (productMockData[0]?.presetProducts ?? []);

    const match = productMockData.find((preset) => arePresetsEqual(preset.presetProducts, target));

    return match?.id ?? productMockData[0]?.id ?? null;
  }, [productsPresets]);

  const handleAddPreset = async (presetProducts?: PresetProduct[]) => {
    try {
      await addPreset(presetProducts);

      if (presetProducts) dispatch(addProductPreset(presetProducts));
    } catch (error) {
      console.error("[ProductModelItem] Failed to apply preset", error);
    }
  };

  const handleCustomizePreset = (presetProducts?: PresetProduct[]) => {
    if (!presetProducts?.length) return;

    dispatch(addProductPreset(presetProducts));
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

        sessionStorage.setItem("prebuiltModelInitialized", "1");
      } catch (error) {
        console.log(error);
      }
    };
    run();
  }, [canvasReady, dispatch, productsPresets]);

  return (
    <div>
      {!isDetail && (
        <>
          <FilterRow>
            <FilterItem
              label="Size"
              options={[
                { label: "Small", value: "s" },
                { label: "Medium", value: "m" },
                { label: "Large", value: "l" },
              ]}
            />

            <FilterItem
              label="Style"
              options={[
                { label: "Style 1", value: "s" },
                { label: "Style 2", value: "m" },
                { label: "Style 3", value: "l" },
              ]}
            />
          </FilterRow>

          <ProductModelsGrid
            handleAddPreset={handleAddPreset}
            handleCustomizePreset={handleCustomizePreset}
            createModelBtn={<CreateModelBtn />}
            activePresetId={activePresetId}
          />
        </>
      )}

      <Outlet />

    </div>
  );
};
