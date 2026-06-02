import { useState } from "react";

import s from "./ModeSwitcher.module.scss";

interface ModeSwitcherI {
  onClick: (tab: "prebuilt" | "custom") => void;
  dataTargets?: {
    root?: string;
    prebuilt?: string;
    custom?: string;
  };
}

export const ModeSwitcher: React.FC<ModeSwitcherI> = ({ onClick, dataTargets }) => {
  const [activeTab, setActiveTab] = useState<"prebuilt" | "custom">("prebuilt");

  const handleClickTab = (tab: "prebuilt" | "custom") => {
    setActiveTab(tab);
    onClick(tab);
  };

  return (
    <div className={s.modeSwitcher} data-tutorial-target={dataTargets?.root}>
      <div
        className={`${s.modeSwitcher_tabItem} ${activeTab === "prebuilt" ? s.active : ""}`}
        data-tutorial-target={dataTargets?.prebuilt}
        onClick={() => handleClickTab("prebuilt")}
      >
        <div className={s.wrap}>
          <div className={s.title}>Pre-Built Models</div>
          <p className={s.description}>Customize your design from pre-made solutions</p>
        </div>
      </div>
      <div
        className={`${s.modeSwitcher_tabItem} ${activeTab === "custom" ? s.active : ""}`}
        data-tutorial-target={dataTargets?.custom}
        onClick={() => handleClickTab("custom")}
      >
        <div className={s.wrap}>
          <div className={s.title}>Create Your Own</div>
          <p className={s.description}> Build your own custom, tailored concept</p>
        </div>
      </div>
    </div>
  );
};
