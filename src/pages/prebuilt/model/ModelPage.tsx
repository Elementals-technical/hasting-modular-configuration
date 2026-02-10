import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useMatch, useNavigate } from "react-router-dom";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";
import { CreateModelBtn } from "@/entities/product/ui/createModelBtn/CreateModelBtn";

import { type PresetProduct } from "@/entities/product/types";
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
  resetPrebuiltProducts,
} from "@/entities/product/model/store/slice";
import { getHasPrebuiltSelections, getProductsPresets } from "@/entities/product/model/store/selectors";
import { ROUTES } from "@/shared";
import { AttentionPopup } from "@/shared/ui/Popups/ui/AttentionPopup/AttentionPopup";
import { removeAllProducts } from "@/utils/functions/playcanvas/removeAllProducts";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";

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

  const handleNavigate = async (tab: "prebuilt" | "custom") => {
    if (tab !== "custom") return;

    if (hasPrebuiltSelections) {
      setIsAttentionPopupOpen(true);
      return;
    }

    removeAllProducts();
    await setConfigBatch({}, { TowelBar: "None", TowelBarSide: "both", TowelBarColor: "" });

    dispatch(reset());
    dispatch(resetPrebuiltProducts());
    dispatch(resetCabinetBuilderBootstrap());
    navigate(ROUTES.CUSTOM);
  };

  const handleConfirmLeave = async () => {
    removeAllProducts();
    await setConfigBatch({}, { TowelBar: "None", TowelBarSide: "both", TowelBarColor: "" });
    await setConfigBatch({}, { SidePanel: "None" });

    dispatch(reset());
    dispatch(resetPrebuiltProducts());
    dispatch(resetCabinetBuilderBootstrap());
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
          <ModeSwitcher onClick={handleNavigate} />

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

      <AttentionPopup
        isOpening={isAttentionPopupOpen}
        setIsOpening={setIsAttentionPopupOpen}
        onConfirm={handleConfirmLeave}
      />
    </div>
  );
};
