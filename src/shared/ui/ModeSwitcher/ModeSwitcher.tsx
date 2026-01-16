import { useState } from "react";

import s from "./ModeSwitcher.module.scss";

interface ModeSwitcherI {
  onClick: (tab: "prebuilt" | "custom") => void;
}

export const ModeSwitcher: React.FC<ModeSwitcherI> = ({ onClick }) => {
  const [activeTab, setActiveTab] = useState<"prebuilt" | "custom">("prebuilt");

  const handleClickTab = (tab: "prebuilt" | "custom") => {
    setActiveTab(tab);
    onClick(tab);
  };

  return (
    <div className={s.modeSwitcher}>
      <div
        className={`${s.modeSwitcher_tabItem} ${activeTab === "prebuilt" ? s.active : ""}`}
        onClick={() => handleClickTab("prebuilt")}
      >
        <div className={s.wrap}>
          <div className={s.title}>Pre-Built Models</div>
          <p className={s.description}>Customize your design from pre-made solutions</p>
        </div>
      </div>
      <div
        className={`${s.modeSwitcher_tabItem} ${activeTab === "custom" ? s.active : ""}`}
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
