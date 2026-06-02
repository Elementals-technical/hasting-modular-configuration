import { BaseButton } from "@/shared/ui/Buttons/BaseButton";
import { ArrowLeft } from "@/shared/assets/images/svg/ArrowLeft";

import s from "./BottomStickyBar.module.scss";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CUSTOM_STEPS, PREBUILT_STEPS } from "@/shared/config/steps";
import { type PropsWithChildren, useState, useSyncExternalStore } from "react";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { getActiveSkus, getPriceLoading, getPriceTotal } from "@/entities/product/model/store/selectors";
import { closeDrawerInteraction } from "@/utils/functions/playcanvas/dividers";
import { getSummarySkuJson, getSummaryTotal, subscribeSummaryStore } from "@/shared/lib/summarySkuStore";
import { printQuoteWithCurrentPreview } from "@/features/quotePrint/lib/printQuote";

const formatPrice = (value?: number | null) => {
  if (typeof value !== "number") return "$—";

  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

type BottomStickyBarProps = PropsWithChildren<{
  flow?: "prebuilt" | "custom";
  nextButtonDataTarget?: string;
}>;

export const BottomStickyBar = ({ flow, nextButtonDataTarget }: BottomStickyBarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const steps = flow === "custom" ? CUSTOM_STEPS : PREBUILT_STEPS;

  const priceTotal = useAppSelector(getPriceTotal);
  const activeSkus = useAppSelector(getActiveSkus);
  const isPriceLoading = useAppSelector(getPriceLoading);
  const isSummaryPage = location.pathname.includes("/summary");
  const summaryTotal = useSyncExternalStore(subscribeSummaryStore, getSummaryTotal, getSummaryTotal);
  const displayedTotal = isSummaryPage ? summaryTotal : priceTotal;
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);

  const currentIndex = steps.findIndex((s) => location.pathname.startsWith(s.path));
  const nextStep = currentIndex >= 0 ? steps[currentIndex + 1] : undefined;
  const previousStep = currentIndex > 0 ? steps[currentIndex - 1] : undefined;

  const copySkuJson = () => {
    const skuJson = getSummarySkuJson();

    if (skuJson.length && navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(skuJson, null, 2));
    }
  };

  const handleQuoteClick = async () => {
    if (isGeneratingQuote) return;

    if (isSummaryPage) {
      setIsGeneratingQuote(true);
      try {
        await printQuoteWithCurrentPreview();
      } finally {
        setIsGeneratingQuote(false);
      }
      return;
    }

    const summaryStep = steps[steps.length - 1];
    if (summaryStep) {
      closeDrawerInteraction();
      navigate(`${summaryStep.path}?print=1`);
    }
  };

  const handleNavigate = () => {
    if (nextStep) {
      closeDrawerInteraction();

      navigate(nextStep?.path);
    } else {
      copySkuJson();
    }
  };

  const handleNavigateBack = () => {
    if (!previousStep) return;
    closeDrawerInteraction();
    navigate(previousStep.path);
  };

  return (
    <div className={s.bottomBar}>
      <div className={s.total}>
        <span className={s.total_text}>Total List Price</span>
        <span>
          {!activeSkus.length ? (
            "$0.00"
          ) : isPriceLoading || (isSummaryPage && typeof displayedTotal !== "number") ? (
            <span className={s.priceSpinner} />
          ) : (
            formatPrice(displayedTotal)
          )}
        </span>
        <span className={s.showroom_link}>
          <Link
            to="#"
            aria-disabled={isGeneratingQuote}
            onClick={(e) => {
              e.preventDefault();
              if (isGeneratingQuote) return;
              void handleQuoteClick();
            }}
          >
            <span>{isGeneratingQuote ? "Generating..." : "Quote"}</span>
            <span className={s.icon}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="17"
                height="17"
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
      <div className={s.nextStepWrapp} data-tutorial-target={nextButtonDataTarget}>
        {previousStep && (
          <button
            type="button"
            className={s.backButton}
            onClick={handleNavigateBack}
            aria-label={`Back to ${previousStep.label}`}
          >
            <ArrowLeft fill="#1f2933" />
          </button>
        )}
        <BaseButton onClick={handleNavigate} fullWidth={true}>
          {nextStep ? `Next: ${nextStep.label}` : "How to buy"}
        </BaseButton>
      </div>
    </div>
  );
};
