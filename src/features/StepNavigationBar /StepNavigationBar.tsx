import { ArrowLeft } from "@/shared/assets/images/svg/ArrowLeft.tsx";
import { HintIcon } from "@/shared/assets/images/svg/HintIcon.tsx";
import { HelpPopup } from "@/shared/ui/Popups/ui/HelpPopup/HelpPopup";

import s from "./StepNavigationBar.module.scss";
import { useState } from "react";

interface StepNavigationBarI {
  title: string | null;
}

export const StepNavigationBar: React.FC<StepNavigationBarI> = ({ title }) => {
  const [isOpening, setIsOpening] = useState(false);

  const handleOpenPopup = () => {
    setIsOpening(true);
  };

  return (
    <div className={s.stepNavigationBar}>
      <div>
        <ArrowLeft />
      </div>
      <div className={s.stepNavigationBar_title}>Select {title}</div>
      <div className={s.hintIcon}>
        <div onClick={handleOpenPopup}>
          <HintIcon />
        </div>
        <HelpPopup isOpening={isOpening} setIsOpening={setIsOpening} />
      </div>
    </div>
  );
};
