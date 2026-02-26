import { BaseButton } from "@/shared/ui/Buttons/BaseButton";

import s from "./BottomStickyBar.module.scss";
import { useLocation, useNavigate } from "react-router-dom";
import { CUSTOM_STEPS, PREBUILT_STEPS } from "@/shared/config/steps";
import { type PropsWithChildren } from "react";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { getActiveSkus, getPriceLoading, getPriceTotal } from "@/entities/product/model/store/selectors";
import { setVisibleDrawerButtons } from "@/utils/functions/playcanvas/setVisibleDrawerButtons";
import { wrapExitTopView } from "@/utils/functions/playcanvas/dividers";
import { getSummarySkuJson } from "@/shared/lib/summarySkuStore";

const formatPrice = (value?: number | null) => {
  if (typeof value !== "number") return "$—";

  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

type BottomStickyBarProps = PropsWithChildren<{
  flow?: "prebuilt" | "custom";
}>;

export const BottomStickyBar = ({ flow }: BottomStickyBarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const steps = flow === "custom" ? CUSTOM_STEPS : PREBUILT_STEPS;

  const priceTotal = useAppSelector(getPriceTotal);
  const activeSkus = useAppSelector(getActiveSkus);
  const isPriceLoading = useAppSelector(getPriceLoading);

  const currentIndex = steps.findIndex((s) => location.pathname.startsWith(s.path));
  const nextStep = currentIndex >= 0 ? steps[currentIndex + 1] : undefined;

  const handleNavigate = () => {
    if (nextStep) {
      const exitTopView = wrapExitTopView({});
      if (exitTopView) exitTopView();

      setVisibleDrawerButtons(false);

      navigate(nextStep?.path);
    } else {
      const skuJson = getSummarySkuJson();
      if (skuJson.length && navigator.clipboard) {
        navigator.clipboard.writeText(JSON.stringify(skuJson, null, 2));
      }
    }
  };

  return (
    <div className={s.bottomBar}>
      <div className={s.total}>
        <span>Total</span>
        <span>
          {!activeSkus.length ? (
            "$0.00"
          ) : isPriceLoading ? (
            <span className={s.priceSpinner} />
          ) : (
            formatPrice(priceTotal)
          )}
        </span>
      </div>
      <div className={s.nextStepWrapp}>
        <BaseButton onClick={handleNavigate} fullWidth={true}>
          {nextStep ? `Next: ${nextStep.label}` : "Create Order"}
        </BaseButton>
      </div>
    </div>
  );
};
