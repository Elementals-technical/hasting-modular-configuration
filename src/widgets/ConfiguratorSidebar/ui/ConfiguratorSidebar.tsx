import { useEffect, type PropsWithChildren } from "react";
import { Link, useLocation } from "react-router-dom";

import { BottomStickyBar } from "@/features";
import { getActiveStep } from "@/features/sidebar/model/store/selectors";
import { setActiveStep } from "@/features/sidebar/model/store/slice";
import { StepNavigationBar } from "@/features/StepNavigationBar/StepNavigationBar";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { usePriceCalculation } from "@/shared/hooks/usePriceCalculation";
import { CUSTOM_STEPS, PREBUILT_STEPS } from "@/shared/config/steps";

import s from "./ConfiguratorSidebar.module.scss";

type ConfiguratorSidebarProps = PropsWithChildren<{
  flow?: "prebuilt" | "custom";
}>;

export const ConfiguratorSidebar = ({ flow = "prebuilt", children }: ConfiguratorSidebarProps) => {
  const location = useLocation();

  const activeStep = useAppSelector(getActiveStep);
  const dispatch = useAppDispatch();

  usePriceCalculation();

  const steps = flow === "custom" ? CUSTOM_STEPS : PREBUILT_STEPS;
  const summaryStep = steps.find((step) => step.id === "summary");
  const isSummaryPage = !!summaryStep && location.pathname.startsWith(summaryStep.path);

  useEffect(() => {
    const match = steps.find((s) => location.pathname.startsWith(s.path));

    dispatch(setActiveStep(match?.label ?? null));
  }, [dispatch, location.pathname, steps]);

  return (
    <div className={s.configSidebar} data-flow={flow}>
      {summaryStep && !isSummaryPage && (
        <Link className={s.summaryViewBtn} to={summaryStep.path}>
          <span>Summary View</span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      <div className={s.desktopStepNavigation}>
        <StepNavigationBar title={activeStep} flow={flow} />
      </div>

      <div className={s.stepContent} data-scroll-container="step-content">
        {children}
      </div>

      <BottomStickyBar flow={flow} />
    </div>
  );
};
