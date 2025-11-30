import { FilterRow } from "@/shared/ui/Filter/FilterRow.tsx";
import { StepNavigationBar } from "@/shared/ui/StepNavigationBar /StepNavigationBar.tsx";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem.tsx";

import s from "./ConfiguratorSidebar.module.scss";

export const ConfiguratorSidebar = () => {
  return (
    <div className={s.configSidebar}>
      <StepNavigationBar />

      <div className={s.modeSwitcher}>
        <div className={`${s.modeSwitcher_tabItem} ${s.active}`}>
          <div className={s.wrap}>
            <div className={s.title}>Pre-Built Models</div>
            <p className={s.description}>Customize your design from pre-made solutions</p>
          </div>
        </div>
        <div className={s.modeSwitcher_tabItem}>
          <div className={s.wrap}>
            <div className={s.title}>Create Your Own</div>
            <p className={s.description}> Build your own custom, tailored concept</p>
          </div>
        </div>
      </div>

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
