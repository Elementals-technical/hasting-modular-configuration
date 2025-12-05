import { Outlet, useMatch, useNavigate } from "react-router-dom";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";
import { CreateModelBtn } from "@/features/product/ui/createModelBtn/CreateModelBtn";

import { ROUTES } from "@/shared";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import { ModeSwitcher } from "@/shared/ui/ModeSwitcher/ModeSwitcher";
import { useAppDispatch } from "@/shared/hooks/store/redux";

import { ProductModelsGrid } from "@/entities/product/ui/ProductModelsGrid/ProductModelsGrid";
import { addPreset } from "@/utils/functions/playcanvas/addPreset";

export const ModelPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isDetail = !!useMatch("/prebuilt/model/:modelId");

  const handleNavigate = () => {
    navigate(ROUTES.CUSTOM);
  };

  const handleAddPreset = async (presetProducts: any) => {
    try {
      const presets = await addPreset(presetProducts);
    } catch (error) {
      console.error("[ProductModelItem] Failed to apply preset", error);
    }
  };

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

          <ProductModelsGrid handleAddPreset={handleAddPreset} createModelBtn={<CreateModelBtn />} />
        </>
      )}

      <Outlet />
    </div>
  );
};
