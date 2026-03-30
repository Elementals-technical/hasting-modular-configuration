import { BaseButton } from "@/shared/ui/Buttons/BaseButton";

import s from "./BottomStickyBar.module.scss";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
        <span className={s.total_text}>Total List Price</span>
        <span>
          {!activeSkus.length ? (
            "$0.00"
          ) : isPriceLoading ? (
            <span className={s.priceSpinner} />
          ) : (
            formatPrice(priceTotal)
          )}
        </span>
        <span className={s.showroom_link}>
          <Link to="#">
            <span>Quote</span>
            <span className={s.icon}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                className="lucide lucide-download-icon lucide-download"
              >
                <path d="M12 15V3" />
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="m7 10 5 5 5-5" />
              </svg>
            </span>
          </Link>
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
