import { useEffect, type PropsWithChildren } from "react";
import { useLocation } from "react-router-dom";

import { BottomStickyBar } from "@/features";
import { setActiveStep } from "@/features/sidebar/model/store/slice";

import { useAppDispatch } from "@/shared/hooks/store/redux";
import { usePriceCalculation } from "@/shared/hooks/usePriceCalculation";
import { CUSTOM_STEPS, PREBUILT_STEPS } from "@/shared/config/steps";

import s from "./ConfiguratorSidebar.module.scss";

type ConfiguratorSidebarProps = PropsWithChildren<{
  flow?: "prebuilt" | "custom";
}>;

export const ConfiguratorSidebar = ({ flow = "prebuilt", children }: ConfiguratorSidebarProps) => {
  const location = useLocation();

  const dispatch = useAppDispatch();

  usePriceCalculation();

  const steps = flow === "custom" ? CUSTOM_STEPS : PREBUILT_STEPS;

  useEffect(() => {
    const match = steps.find((s) => location.pathname.startsWith(s.path));

    dispatch(setActiveStep(match?.label ?? null));
  }, [dispatch, location.pathname, steps]);

  return (
    <div className={s.configSidebar} data-flow={flow}>
      <div className={s.stepContent}>{children}</div>

      <BottomStickyBar flow={flow} />
    </div>
  );
};
