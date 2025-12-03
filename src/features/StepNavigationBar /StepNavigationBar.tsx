import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ArrowLeft } from "@/shared/assets/images/svg/ArrowLeft.tsx";
import { HintIcon } from "@/shared/assets/images/svg/HintIcon.tsx";
import { HelpPopup } from "@/shared/ui/Popups/ui/HelpPopup/HelpPopup";
import { CUSTOM_STEPS, PREBUILT_STEPS } from "@/shared/config/steps";

import s from "./StepNavigationBar.module.scss";

interface StepNavigationBarI {
  title: string | null;
  flow?: "prebuilt" | "custom";
}

export const StepNavigationBar: React.FC<StepNavigationBarI> = ({ title, flow }) => {
  const [isOpening, setIsOpening] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const steps = flow === "custom" ? CUSTOM_STEPS : PREBUILT_STEPS;

  const currentIndex = steps.findIndex((s) => location.pathname.startsWith(s.path));
  const prevStep = currentIndex > 0 ? steps[currentIndex - 1] : undefined;

  const handleNavigate = () => {
    if (prevStep) navigate(prevStep?.path);
  };

  const handleOpenPopup = () => {
    setIsOpening(true);
  };

  return (
    <div className={s.stepNavigationBar}>
      <div className={s.stepBack} onClick={handleNavigate}>
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
