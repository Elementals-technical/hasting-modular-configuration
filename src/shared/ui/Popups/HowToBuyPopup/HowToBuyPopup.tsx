import { useCallback, useEffect, useRef, useState, type UIEvent } from "react";
import { FileCog, FileQuestionMark, Headset, Star, SwatchBook } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import { PortalBody } from "@/shared/ui/Popups/Portal/PortalBody";

import HubspotForm from "./HubspotForm/HubspotForm";
import styles from "./HowToBuyPopup.module.scss";

const IMAGES = [
  {
    desktop: "https://www.hastingsbathcollection.com/hubfs/Hastings_2023/images/hs-how-to-buy-slide1.jpg",
    mobile: "https://www.hastingsbathcollection.com/hubfs/Hastings_2023/images/hs-how-to-buy-slide1-mob.jpg",
  },
  {
    desktop: "https://www.hastingsbathcollection.com/hubfs/Hastings_2023/images/hs-how-to-buy-slide2.jpg",
    mobile: "https://www.hastingsbathcollection.com/hubfs/Hastings_2023/images/hs-how-to-buy-slide2-mob.jpg",
  },
  {
    desktop: "https://www.hastingsbathcollection.com/hubfs/Hastings_2023/images/hs-how-to-buy-slide3.jpg",
    mobile: "https://www.hastingsbathcollection.com/hubfs/Hastings_2023/images/hs-how-to-buy-slide3-mob.jpg",
  },
];

const testimonials = [
  {
    author: "T Liao",
    role: "Homeowner",
    location: "New York",
    text: "Working with Boni has been an absolute dream. My only regret is that I couldn't work with her on every aspect of the renovation.",
  },
  {
    author: "Nate",
    role: "Homeowner",
    location: "New York",
    text: "Love love Hastings bath vanities! Modern, sophisticated or playful but definitely a statement in any bathroom. John was a pleasure to work with. Attentive, immediate follow up and so professional! I meet enough people who know their product well but I haven't met anyone who is not only knowledgeable but also as dedicated and caring as John.",
  },
];

const HOW_TO_BUY_CONFIGURATION_ID_FIELD = "configuration_id";
const HOW_TO_BUY_CONFIGURATION_URL_FIELD = "configuration_url";

type TestimonialListProps = {
  className: string;
};

function TestimonialList({ className }: TestimonialListProps) {
  return (
    <div className={className}>
      {testimonials.map((t, i) => (
        <div key={i} className={styles.testimonialCard}>
          <div className={styles.testimonialHeader}>
            <div className={styles.testimonialMeta}>
              <div className={styles.testimonialNameRow}>
                <span className={styles.testimonialAuthor}>{t.author}</span>
                <span className={styles.testimonialRole}>{t.role}</span>
              </div>
              <span className={styles.testimonialLocation}>{t.location}</span>
            </div>
            <div className={styles.stars}>
              {Array.from({ length: 5 }).map((_, si) => (
                <AppIcon icon={Star} size={22} color="#DC8C24" key={si} fill="#DC8C24" />
              ))}
            </div>
          </div>
          <p className={styles.testimonialText}>&ldquo;{t.text}&rdquo;</p>
        </div>
      ))}
    </div>
  );
}

type HowToBuyPopupProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hubspotPortalId: string;
  hubspotFormId: string;
  configurationId?: string | null;
  configurationUrl?: string | null;
  isConfigurationLoading?: boolean;
  configurationError?: string | null;
  onRetryConfiguration?: () => void;
  onFormSubmitted?: () => void;
};

export default function HowToBuyPopup({
  open,
  onOpenChange,
  hubspotPortalId,
  hubspotFormId,
  configurationId,
  configurationUrl,
  isConfigurationLoading = false,
  configurationError,
  onRetryConfiguration,
  onFormSubmitted,
}: HowToBuyPopupProps) {
  const rightColRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const leftColRef = useRef<HTMLDivElement | null>(null);
  const mobileThreshold = useRef<number | null>(null);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = useCallback((e: Event | UIEvent<HTMLDivElement>) => {
    const scrollEl = e.currentTarget;
    if (!(scrollEl instanceof HTMLElement)) return;

    let triggerLine;

    if (window.innerWidth < 768) {
      // Cache leftCol bottom once (while imageArea is still full-height) to
      // avoid a feedback loop where hiding the image shifts the trigger line.
      if (mobileThreshold.current === null && leftColRef.current) {
        mobileThreshold.current = leftColRef.current.getBoundingClientRect().bottom + 8;
      }
      triggerLine = mobileThreshold.current ?? window.innerHeight * 0.45;
    } else {
      const { top, height } = scrollEl.getBoundingClientRect();
      triggerLine = top + height * 0.65;
    }

    setScrolled(scrollEl.scrollTop > 0);

    let next = 0;
    stepRefs.current.forEach((el, i) => {
      if (el && el.getBoundingClientRect().top <= triggerLine) next = i;
    });
    setActiveStep(next);
  }, []);

  // Callback ref for right col — desktop scroll container
  const setRightColRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (rightColRef.current) {
        rightColRef.current.removeEventListener("scroll", handleScroll);
      }
      rightColRef.current = el;
      if (el) {
        el.addEventListener("scroll", handleScroll, { passive: true });
      }
    },
    [handleScroll],
  );

  // Callback ref for popup — mobile scroll container
  const setPopupRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (popupRef.current) {
        popupRef.current.removeEventListener("scroll", handleScroll);
      }
      popupRef.current = el;
      if (el) {
        el.addEventListener("scroll", handleScroll, { passive: true });
      }
    },
    [handleScroll],
  );

  useEffect(() => {
    if (open) return;

    const resetTimer = window.setTimeout(() => {
      setActiveStep(0);
      setScrolled(false);
      mobileThreshold.current = null;
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [open]);

  if (!open) {
    return null;
  }

  const hubspotHiddenFields =
    configurationId && configurationUrl
      ? {
          [HOW_TO_BUY_CONFIGURATION_ID_FIELD]: configurationId,
          [HOW_TO_BUY_CONFIGURATION_URL_FIELD]: configurationUrl,
        }
      : undefined;

  return (
    <PortalBody>
      <div className={styles.dialogOverlay} onClick={() => onOpenChange(false)} />
      <div
        className={styles.dialogContent}
        role="dialog"
        aria-modal="true"
        aria-label="How to buy"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.closeButton} onClick={() => onOpenChange(false)} aria-label="Close">
          <CloseBtnIcon width="35" height="35" />
        </button>
        <div className={styles.popup} ref={setPopupRef}>
          {/* Left column — static on desktop, sticky on mobile */}
          <div
            className={styles.leftCol}
            ref={(el) => {
              leftColRef.current = el;
            }}
          >
            <div className={`${styles.leftHeader} ${scrolled && activeStep < 3 ? styles.leftHeaderHidden : ""}`}>
              <h2 className={styles.heading}>{activeStep === 3 ? "Finalize Your Design" : "How It Works"}</h2>
              <p className={styles.subtitle}>
                {activeStep === 3
                  ? "Fill out the form and let our team do the rest."
                  : "Custom bathroom furniture leaves no room for shortcuts. We sweat the small stuff so you don’t have to."}
              </p>
            </div>
            <div className={`${styles.imageArea} ${activeStep === 3 ? styles.imageHidden : ""}`}>
              {IMAGES.map((img, i) => (
                <picture key={i}>
                  <source media="(max-width: 767px)" srcSet={img.mobile} />
                  <img
                    src={img.desktop}
                    alt={`Step ${i + 1}`}
                    className={`${styles.stepImg} ${activeStep === i ? styles.active : ""}`}
                  />
                </picture>
              ))}
              {/* Testimonials shown in left col on the last slide (desktop only) */}
              <TestimonialList className={`${styles.testimonialsOverlay} ${activeStep === 3 ? styles.active : ""}`} />
            </div>
          </div>

          {/* Right column — scrollable */}
          <div className={styles.rightColWrapper}>
            <div className={`${styles.scrollArrow} ${scrolled ? styles.scrollArrowHidden : ""}`} aria-hidden="true">
              <AppIcon icon={FileQuestionMark} size={24} color="#282828" />
            </div>
            <div className={styles.rightCol} ref={setRightColRef}>
              {/* Step 1 */}
              <div
                className={styles.stepItem}
                ref={(el) => {
                  stepRefs.current[0] = el;
                }}
              >
                <div className={styles.stepHeaderRow}>
                  <span className={styles.stepBadge}>01</span>
                  <h3 className={styles.stepHeading}>Submit Your Design</h3>
                </div>
                <p className={styles.stepBody}>
                  Share your design configuration through the form below. Our team receives your design and reaches out
                  within 24 hours to get the ball rolling.
                </p>
              </div>

              {/* Step 2 */}
              <div
                className={styles.stepItem}
                ref={(el) => {
                  stepRefs.current[1] = el;
                }}
              >
                <div className={styles.stepHeaderRow}>
                  <span className={styles.stepBadge}>02</span>
                  <h3 className={styles.stepHeading}>Your Solution Specialist</h3>
                </div>
                <p className={styles.stepBody}>
                  We pair you with a dedicated specialist — your go-to to finalize your design. They support you and
                  your team, making it a breeze. Here's how it works:
                </p>
                <ul className={styles.bulletList}>
                  <li className={styles.bulletItem}>
                    <AppIcon icon={SwatchBook} size={20} color="#B65633" />
                    <span className={styles.bulletText}>
                      <strong>Sample Box Curation.</strong> Confidence in your colorways is a must. We curate your box
                      for review.
                    </span>
                  </li>
                  <li className={styles.bulletItem}>
                    <AppIcon icon={FileCog} size={20} color="#B65633" />
                    <span className={styles.bulletText}>
                      <strong>Vetting the details.</strong> We ensure all the technical details are spot on for you.
                    </span>
                  </li>
                  <li className={styles.bulletItem}>
                    <AppIcon icon={Headset} size={20} color="#B65633" />
                    <span className={styles.bulletText}>
                      <strong>Product Expertise.</strong> We answer any and all your solution questions.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Step 3 */}
              <div
                className={styles.stepItem}
                ref={(el) => {
                  stepRefs.current[2] = el;
                }}
              >
                <div className={styles.stepHeaderRow}>
                  <span className={styles.stepBadge}>03</span>
                  <h3 className={styles.stepHeading}>Choose Your Purchase Path</h3>
                </div>
                <p className={styles.stepBody}>
                  After we finalize your design, you choose your purchase path — through our NYC Showroom or Dealer
                  network.
                </p>
              </div>

              {/* Form section — testimonials in left col on desktop (slide 4) */}
              <div
                className={styles.formSection}
                ref={(el) => {
                  stepRefs.current[3] = el;
                }}
              >
                <div className={styles.formRight}>
                  {isConfigurationLoading ? (
                    <div className={styles.formStatus} aria-live="polite">
                      Preparing your design...
                    </div>
                  ) : configurationError ? (
                    <div className={styles.formStatus} role="alert">
                      <p>{configurationError}</p>
                      {onRetryConfiguration && (
                        <button type="button" className={styles.retryButton} onClick={onRetryConfiguration}>
                          Try again
                        </button>
                      )}
                    </div>
                  ) : (
                    <HubspotForm
                      portalId={hubspotPortalId}
                      formId={hubspotFormId}
                      onFormSubmitted={onFormSubmitted}
                      customStyle={true}
                      hiddenFields={hubspotHiddenFields}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PortalBody>
  );
}
