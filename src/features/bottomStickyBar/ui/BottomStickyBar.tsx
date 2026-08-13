import { BaseButton } from "@/shared/ui/Buttons/BaseButton";
import { ArrowLeft } from "@/shared/assets/images/svg/ArrowLeft";

import s from "./BottomStickyBar.module.scss";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CUSTOM_STEPS, PREBUILT_STEPS } from "@/shared/config/steps";
import { type PropsWithChildren, useEffect, useState, useSyncExternalStore } from "react";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { getActiveSkus, getPriceLoading, getPriceTotal } from "@/entities/product/model/store/selectors";
import { closeDrawerInteraction } from "@/utils/functions/playcanvas/dividers";
import { getSummaryTotal, subscribeSummaryStore } from "@/shared/lib/summarySkuStore";
import { printQuoteWithCurrentPreview } from "@/features/quotePrint/lib/printQuote";
import HowToBuyPopup from "@/shared/ui/Popups/HowToBuyPopup/HowToBuyPopup";
import { PortalBody } from "@/shared/ui/Popups/Portal/PortalBody";
import { FileDollarIcon } from "@/shared/assets/images/svg/FileDollarIcon";
import { useCurrentConfigurationLink, type CurrentConfigurationLink } from "@/features/saveConfiguration";
import { trackModularHowToBuyClick } from "@/shared/lib/analytics/modularKeyEvents";

const formatPrice = (value?: number | null) => {
  if (typeof value !== "number") return "$—";

  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

type BottomStickyBarProps = PropsWithChildren<{
  flow?: "prebuilt" | "custom";
  nextButtonDataTarget?: string;
}>;

const HOW_TO_BUY_HUBSPOT_PORTAL_ID = "21569224";
const HOW_TO_BUY_HUBSPOT_FORM_ID = "e12e000d-b948-4749-b10c-f31f364299b9";
const isMobileQuoteButtonVisible = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px)").matches;

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
  const [isNavigatingToQuote, setIsNavigatingToQuote] = useState(false);
  const [isHowToBuyOpen, setIsHowToBuyOpen] = useState(false);
  const [isPreparingHowToBuyConfiguration, setIsPreparingHowToBuyConfiguration] = useState(false);
  const [howToBuyConfigurationLink, setHowToBuyConfigurationLink] = useState<CurrentConfigurationLink | null>(null);
  const [howToBuyConfigurationError, setHowToBuyConfigurationError] = useState<string | null>(null);
  const [isQuoteDownloadModalOpen, setIsQuoteDownloadModalOpen] = useState(false);
  const { createCurrentConfigurationLink } = useCurrentConfigurationLink();
  const isQuotePrintRequested = new URLSearchParams(location.search).get("print") === "1";
  const isQuotePending = isGeneratingQuote || isNavigatingToQuote || isQuotePrintRequested;
  const isDisplayedPriceLoading = isPriceLoading || (isSummaryPage && typeof displayedTotal !== "number");
  const fullPriceLabel = activeSkus.length ? formatPrice(displayedTotal) : "$0.00";

  const currentIndex = steps.findIndex((s) => location.pathname.startsWith(s.path));
  const nextStep = currentIndex >= 0 ? steps[currentIndex + 1] : undefined;
  const previousStep = currentIndex > 0 ? steps[currentIndex - 1] : undefined;

  useEffect(() => {
    if (!isQuotePrintRequested) {
      setIsNavigatingToQuote(false);
    }
  }, [isQuotePrintRequested, location.pathname]);

  useEffect(() => {
    if (!isQuotePending) {
      setIsQuoteDownloadModalOpen(false);
    }
  }, [isQuotePending]);

  const handleQuoteClick = async () => {
    if (isQuotePending) return;

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
      setIsNavigatingToQuote(true);
      closeDrawerInteraction();
      navigate(`${summaryStep.path}?print=1`);
    }
  };

  const prepareHowToBuyConfiguration = async () => {
    if (isPreparingHowToBuyConfiguration) return;

    setIsHowToBuyOpen(true);
    setIsPreparingHowToBuyConfiguration(true);
    setHowToBuyConfigurationLink(null);
    setHowToBuyConfigurationError(null);

    try {
      const link = await createCurrentConfigurationLink();
      setHowToBuyConfigurationLink(link);
    } catch (error) {
      console.error("[How to Buy] Failed to prepare configuration link", error);
      setHowToBuyConfigurationError("We couldn't prepare your design details. Please try again.");
    } finally {
      setIsPreparingHowToBuyConfiguration(false);
    }
  };

  const handleNavigate = () => {
    if (nextStep) {
      closeDrawerInteraction();

      navigate(nextStep?.path);
    } else {
      trackModularHowToBuyClick({
        cta_location: "bottom_sticky_bar",
        configurator_flow: flow,
      });
      void prepareHowToBuyConfiguration();
    }
  };

  const handleNavigateBack = () => {
    if (!previousStep) return;
    closeDrawerInteraction();
    navigate(previousStep.path);
  };

  return (
    <>
      <div className={s.bottomBar}>
        <div className={s.total}>
          <span className={s.total_text}>Total List Price</span>
          <span className={s.priceValue} aria-label={isDisplayedPriceLoading ? undefined : fullPriceLabel}>
            {isDisplayedPriceLoading ? (
              <span className={s.priceSpinner} />
            ) : (
              fullPriceLabel
            )}
          </span>
          <span className={s.showroom_link}>
            <Link
              to="#"
              aria-disabled={isQuotePending}
              onClick={(e) => {
                e.preventDefault();
                if (isQuotePending) return;
                if (isMobileQuoteButtonVisible()) {
                  setIsQuoteDownloadModalOpen(true);
                }
                void handleQuoteClick();
              }}
              aria-label={isQuotePending ? "Generating quote" : "Quote"}
            >
              <span className={s.quoteDesktopContent}>
                <span>{isQuotePending ? "Generating..." : "Quote"}</span>
                <span className={s.icon}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-download-icon lucide-download"
                  >
                    <path d="M12 15V3" />
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="m7 10 5 5 5-5" />
                  </svg>
                </span>
              </span>
              <span className={s.quoteMobileIcon} aria-hidden="true">
                <FileDollarIcon />
              </span>
            </Link>
          </span>
        </div>
        <div
          className={`${s.nextStepWrapp} ${!previousStep ? s.nextStepWrappNoBack : ""}`}
          data-tutorial-target={nextButtonDataTarget}
        >
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
          <BaseButton
            className={s.desktopNextButton}
            onClick={handleNavigate}
            disabled={!nextStep && isPreparingHowToBuyConfiguration}
            fullWidth={true}
          >
            <span className={s.nextButtonDesktopLabel}>
              {nextStep ? `Next: ${nextStep.label}` : isPreparingHowToBuyConfiguration ? "Preparing..." : "How to Buy"}
            </span>
            <span className={s.nextButtonMobileLabel}>
              {nextStep ? nextStep.label : isPreparingHowToBuyConfiguration ? "Preparing..." : "How to Buy"}
            </span>
          </BaseButton>
          <button
            type="button"
            className={`${s.backButton} ${s.mobileNextButton}`}
            onClick={handleNavigate}
            disabled={!nextStep && isPreparingHowToBuyConfiguration}
            aria-label={nextStep ? `Next to ${nextStep.label}` : "How to Buy"}
          >
            <ArrowLeft fill="#1f2933" />
          </button>
        </div>
      </div>

      <HowToBuyPopup
        open={isHowToBuyOpen}
        onOpenChange={setIsHowToBuyOpen}
        hubspotPortalId={HOW_TO_BUY_HUBSPOT_PORTAL_ID}
        hubspotFormId={HOW_TO_BUY_HUBSPOT_FORM_ID}
        configurationId={howToBuyConfigurationLink?.id}
        configurationUrl={howToBuyConfigurationLink?.url}
        isConfigurationLoading={isPreparingHowToBuyConfiguration}
        configurationError={howToBuyConfigurationError}
        onRetryConfiguration={() => void prepareHowToBuyConfiguration()}
        onFormSubmitted={() => setIsHowToBuyOpen(false)}
      />

      {isQuoteDownloadModalOpen && (
        <PortalBody>
          <div className={s.quoteDownloadOverlay}>
            <div className={s.quoteDownloadModal} role="dialog" aria-modal="true" aria-live="polite">
              <span className={s.quoteSpinner} />
              <span>Downloading Quote</span>
            </div>
          </div>
        </PortalBody>
      )}
    </>
  );
};
