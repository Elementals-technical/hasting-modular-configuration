import { useLocation, useMatch, useNavigate } from "react-router-dom";

import { ArrowLeft } from "@/shared/assets/images/svg/ArrowLeft.tsx";
import { CUSTOM_STEPS, PREBUILT_STEPS } from "@/shared/config/steps";

import s from "./StepNavigationBar.module.scss";

interface StepNavigationBarI {
  title: string | null;
  flow?: "prebuilt" | "custom";
}

export const StepNavigationBar: React.FC<StepNavigationBarI> = ({ title, flow }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const steps = flow === "custom" ? CUSTOM_STEPS : PREBUILT_STEPS;

  const isModelDetails = !!useMatch("/prebuilt/model/:modelId");
  const currentIndex = steps.findIndex((s) => location.pathname.startsWith(s.path));
  const prevStep = currentIndex > 0 ? steps[currentIndex - 1] : undefined;

  const handleNavigate = () => {
    if (location.pathname.startsWith("/custom/cabinet-builder")) {
      navigate("/prebuilt/model");
      return;
    }

    if (prevStep) {
      navigate(prevStep.path);
      return;
    }

    if (isModelDetails) {
      navigate("/prebuilt/model");
      return;
    }
  };

  return (
    <div className={s.stepNavigationBar}>
      <div className={s.stepBack} onClick={handleNavigate}>
        <ArrowLeft />
      </div>
      <div className={s.stepNavigationBar_title}>Select {title}</div>
      <div></div>
    </div>
  );
};
