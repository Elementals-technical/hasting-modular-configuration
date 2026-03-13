import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { useState } from "react";

import { ArrowLeft } from "@/shared/assets/images/svg/ArrowLeft.tsx";
import { CUSTOM_STEPS, PREBUILT_STEPS } from "@/shared/config/steps";
import { AttentionPopup } from "@/shared/ui/Popups/ui/AttentionPopup/AttentionPopup";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { getSelectedProducts } from "@/entities/product/model/store/selectors";
import { reset, resetCabinetBuilderBootstrap } from "@/entities/product/model/store/slice";

import { removeAllProducts } from "@/utils/functions/playcanvas/removeAllProducts";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { setVisibleDrawerButtons } from "@/utils/functions/playcanvas/setVisibleDrawerButtons";
import { wrapExitTopView } from "@/utils/functions/playcanvas/dividers";

import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";

import s from "./StepNavigationBar.module.scss";
import { ArrowDown } from "@/shared/assets/images/svg/ArrowDown";
import { close, open } from "../sidebar/model/store/slice";
import { getIsOpenSidebar } from "../sidebar/model/store/selectors";

interface StepNavigationBarI {
  title: string | null;
  flow?: "prebuilt" | "custom";
}

export const StepNavigationBar: React.FC<StepNavigationBarI> = ({ title, flow }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const steps = flow === "custom" ? CUSTOM_STEPS : PREBUILT_STEPS;

  const [isAttentionPopupOpen, setIsAttentionPopupOpen] = useState(false);

  const dispatch = useAppDispatch();
  const selectedProducts = useAppSelector(getSelectedProducts);
  const isSidebarOpen = useAppSelector(getIsOpenSidebar);
  const hasProducts = selectedProducts.length > 0;

  const isModelDetails = !!useMatch("/prebuilt/model/:modelId");
  const currentIndex = steps.findIndex((s) => location.pathname.startsWith(s.path));

  const prevStep = currentIndex > 0 ? steps[currentIndex - 1] : undefined;
  const nextStep = currentIndex >= 0 ? steps[currentIndex + 1] : undefined;

  const handleNavigate = () => {
    const exitTopView = wrapExitTopView({});
    if (exitTopView) exitTopView();

    if (location.pathname.startsWith("/custom/cabinet-builder")) {
      if (hasProducts) {
        setIsAttentionPopupOpen(true);
        return;
      }

      navigate("/prebuilt/model");
      return;
    }

    if (prevStep) {
      setVisibleDrawerButtons(false);

      navigate(prevStep.path);
      return;
    }

    if (isModelDetails) {
      navigate("/prebuilt/model");
      return;
    }
  };

  const handleNavigateForward = () => {
    if (nextStep) {
      const exitTopView = wrapExitTopView({});
      if (exitTopView) exitTopView();

      setVisibleDrawerButtons(false);

      navigate(nextStep.path);
    }
  };

  const handleConfirmLeave = async () => {
    removeAllProducts();

    await setConfigBatch({}, { TowelBar: "None", TowelBarSide: "both", TowelBarColor: "" });
    await setConfigBatch({}, { SidePanel: "None" });

    dispatch(reset());
    dispatch(resetCabinetBuilderBootstrap());

    navigate("/prebuilt/model");
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

        {nextStep ? (
          <div
            className={s.stepNavigationBar_title}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              dispatch(isSidebarOpen ? close() : open());
            }}
          >
            Select {title} <span>{<ArrowDown width="12" height="12" />}</span>
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
