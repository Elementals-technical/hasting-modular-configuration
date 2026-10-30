import { useState } from "react";
import { useLocation } from "react-router-dom";

import { ArrowLeft } from "@/shared/assets/images/svg/ArrowLeft.tsx";
import { useCollectionNavigation, useEntryStep, useStepNavigate } from "@/features/collectionCustomization";
import { AttentionPopup } from "@/shared/ui/Popups/ui/AttentionPopup/AttentionPopup";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { getSelectedProducts } from "@/entities/product/model/store/selectors";
import { reset, resetCabinetBuilderBootstrap } from "@/entities/product/model/store/slice";
import { useChangeAttribute } from "@/features/configurationCommands";

import { closeDrawerInteraction } from "@/utils/functions/playcanvas/dividers";

import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";

import s from "./StepNavigationBar.module.scss";
import { ArrowDown } from "@/shared/assets/images/svg/ArrowDown";
import { close, open } from "../sidebar/model/store/slice";
import { getIsOpenSidebar } from "../sidebar/model/store/selectors";

interface StepNavigationBarI {
  title: string | null;
}

export const StepNavigationBar: React.FC<StepNavigationBarI> = ({ title }) => {
  const { pathname } = useLocation();
  const navigate = useStepNavigate();
  const navigation = useCollectionNavigation();
  const prebuiltEntry = useEntryStep("prebuilt");

  const [isAttentionPopupOpen, setIsAttentionPopupOpen] = useState(false);

  const dispatch = useAppDispatch();
  const { composition } = useChangeAttribute();
  const selectedProducts = useAppSelector(getSelectedProducts);
  const isSidebarOpen = useAppSelector(getIsOpenSidebar);
  const hasProducts = selectedProducts.length > 0;

  const currentStep = navigation?.currentStep ?? null;
  const prevStep = navigation?.previousStep ?? undefined;
  const nextStep = navigation?.nextStep ?? undefined;
  const isSummary = navigation?.isSummary ?? false;
  const isStepDetails = !!currentStep && pathname !== currentStep.path;

  const leaveCustomFlow = () => {
    if (prebuiltEntry) navigate(prebuiltEntry.path);
  };

  const handleNavigate = () => {
    closeDrawerInteraction();

    if (currentStep?.kind === "cabinet-builder") {
      if (hasProducts) {
        setIsAttentionPopupOpen(true);
        return;
      }

      leaveCustomFlow();
      return;
    }

    if (isStepDetails) {
      navigate(currentStep.path);
      return;
    }

    if (prevStep) {
      navigate(prevStep.path);
    }
  };

  const handleNavigateForward = () => {
    if (nextStep) {
      closeDrawerInteraction();

      navigate(nextStep.path);
    }
  };

  const handleConfirmLeave = async () => {
    // Leaving the flow starts over: the products and their add-ons go.
    const cleared = await composition.clear({ resetAddOns: true });
    if (cleared.status === "error") console.warn("[StepNavigationBar] The scene was not cleared", cleared);

    dispatch(reset());
    dispatch(resetCabinetBuilderBootstrap());

    leaveCustomFlow();
  };

  return (
    <>
      <div
        className={s.stepNavigationBar}
        style={!nextStep ? { justifyContent: "unset", gap: "12px", fontSize: "16px" } : undefined}
      >
        <div className={s.stepBack} onClick={handleNavigate}>
          <ArrowLeft />
        </div>

        {!isSummary ? (
          <div
            className={s.stepNavigationBar_title}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              dispatch(isSidebarOpen ? close() : open());
            }}
          >
            {title} <span>{<ArrowDown width="12" height="12" />}</span>
          </div>
        ) : (
          <div>Your Configuration</div>
        )}

        <div
          className={s.stepForward}
          style={{ visibility: nextStep ? "visible" : "hidden" }}
          onClick={handleNavigateForward}
        >
          <ArrowRight />
        </div>
      </div>
      <AttentionPopup
        isOpening={isAttentionPopupOpen}
        setIsOpening={setIsAttentionPopupOpen}
        onConfirm={handleConfirmLeave}
      />
    </>
  );
};
