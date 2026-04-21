import { useEffect, useRef, type PropsWithChildren } from "react";
import { Link, useLocation } from "react-router-dom";

import { BottomStickyBar } from "@/features";
import { getActiveStep } from "@/features/sidebar/model/store/selectors";
import { setActiveStep } from "@/features/sidebar/model/store/slice";
import { StepNavigationBar } from "@/features/StepNavigationBar/StepNavigationBar";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { usePriceCalculation } from "@/shared/hooks/usePriceCalculation";
import { CUSTOM_STEPS, PREBUILT_STEPS } from "@/shared/config/steps";
import { setIsDrawerOpen } from "@/entities/product/model/store/slice";
import { closeDrawerInteraction } from "@/utils/functions/playcanvas/dividers";

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
  const currentStep = steps.find((step) => location.pathname.startsWith(step.path));
  const previousStepPathRef = useRef<string | null>(null);
  const isSummaryPage = !!summaryStep && location.pathname.startsWith(summaryStep.path);

  useEffect(() => {
    dispatch(setActiveStep(currentStep?.label ?? null));
  }, [currentStep?.label, dispatch]);

  useEffect(() => {
    const previousStepPath = previousStepPathRef.current;
    previousStepPathRef.current = currentStep?.path ?? null;

    if (!previousStepPath || previousStepPath === currentStep?.path) return;

    closeDrawerInteraction();
    dispatch(setIsDrawerOpen(false));
  }, [currentStep?.path, dispatch]);

  return (
    <div className={s.configSidebar} data-flow={flow}>
      {summaryStep && !isSummaryPage && (
        <Link className={s.summaryViewBtn} to={summaryStep.path} onClick={closeDrawerInteraction}>
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
