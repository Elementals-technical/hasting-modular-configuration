import { FilterRow } from "@/shared/ui/Filter/FilterRow.tsx";
import { ModeSwitcher } from "@/shared/ui/ModeSwitcher/ModeSwitcher";
import { StepNavigationBar } from "@/shared/ui/StepNavigationBar /StepNavigationBar";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem.tsx";

import s from "./ConfiguratorSidebar.module.scss";

export const ConfiguratorSidebar = () => {
  return (
    <div className={s.configSidebar}>
      <StepNavigationBar />

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

      <div className="prebuiltGridProducts"></div>
    </div>
  );
};
