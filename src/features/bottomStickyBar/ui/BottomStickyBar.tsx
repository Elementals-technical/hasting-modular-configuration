import { BaseButton } from "@/shared/ui/Buttons/BaseButton";

import s from "./BottomStickyBar.module.scss";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppDispatch } from "@/shared/hooks/store/redux";
import { CUSTOM_STEPS, PREBUILT_STEPS } from "@/shared/config/steps";
import { useEffect, type PropsWithChildren } from "react";

type BottomStickyBarProps = PropsWithChildren<{
  flow?: "prebuilt" | "custom";
}>;

export const BottomStickyBar = ({ flow }: BottomStickyBarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const steps = flow === "custom" ? CUSTOM_STEPS : PREBUILT_STEPS;

  const currentIndex = steps.findIndex((s) => location.pathname.startsWith(s.path));
  const nextStep = currentIndex >= 0 ? steps[currentIndex + 1] : undefined;

  const handleNavigate = () => {
    if (nextStep) navigate(nextStep?.path);
  };

  return (
    <div className={s.bottomBar}>
      <div className={s.total}>
        <span>Total</span>
        <span>$1,299.99</span>
      </div>
      <div className={s.nextStepWrapp}>
        <BaseButton onClick={handleNavigate} fullWidth={true}>
          Next: {nextStep?.label}
        </BaseButton>
      </div>
    </div>
  );
};
