import { StepNavigationBar } from "../../../shared/ui/StepNavigationBar /StepNavigationBar.tsx";

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

      <div className="filterArea"></div>
      <div className="prebuiltGridProducts"></div>
    </div>
  );
};
