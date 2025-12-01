import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";

import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import { ModeSwitcher } from "@/shared/ui/ModeSwitcher/ModeSwitcher";

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
    </div>
  );
};
