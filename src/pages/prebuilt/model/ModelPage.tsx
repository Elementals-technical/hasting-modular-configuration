import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";
import { CreateModelBtn } from "@/features/product/ui/createModelBtn/CreateModelBtn";

import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import { ModeSwitcher } from "@/shared/ui/ModeSwitcher/ModeSwitcher";

import { ProductModelsGrid } from "@/entities/product/ui/ProductModelsGrid/ProductModelsGrid";

export const ModelPage = () => {
  return (
    <div>
      <ModeSwitcher />

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

      <ProductModelsGrid createModelBtn={<CreateModelBtn />} />
    </div>
  );
};
