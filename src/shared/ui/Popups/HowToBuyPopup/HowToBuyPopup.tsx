import { useCallback, useEffect, useRef, useState, type UIEvent } from "react";

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

const HOW_TO_BUY_CONFIGURATION_ID_FIELD = "configuration-id";
const HOW_TO_BUY_CONFIGURATION_URL_FIELD = "configuration-url";

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
                <svg key={si} xmlns="http://www.w3.org/2000/svg" width="22" height="23" viewBox="0 0 22 23" fill="none">
                  <path
                    d="M11 15.6394L6.15113 18.3537L7.23394 12.9032L3.15363 9.13015L8.67219 8.47565L11 3.42944L13.3279 8.47565L18.8465 9.13015L14.7662 12.9032L15.849 18.3537L11 15.6394Z"
                    fill="#DC8C24"
                  />
                </svg>
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
              <svg width="22" height="26" viewBox="0 0 22 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M20.4286 15.2941L11 24.4706L1.57143 15.2941M11 24.4706L11 1.52941"
                  stroke="#282828"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M9.16667 14.1667C9.16667 15.0507 8.81548 15.8986 8.19036 16.5237C7.56523 17.1488 6.71739 17.5 5.83333 17.5C4.94928 17.5 4.10143 17.1488 3.47631 16.5237C2.85119 15.8986 2.5 15.0507 2.5 14.1667V4.16667C2.5 3.72464 2.67559 3.30072 2.98816 2.98816C3.30072 2.67559 3.72464 2.5 4.16667 2.5H7.5C7.94203 2.5 8.36595 2.67559 8.67851 2.98816C8.99107 3.30072 9.16667 3.72464 9.16667 4.16667V14.1667Z"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M13.9166 10.8334H15.8333C16.2753 10.8334 16.6993 11.009 17.0118 11.3215C17.3244 11.6341 17.5 12.058 17.5 12.5V15.8334C17.5 16.2754 17.3244 16.6993 17.0118 17.0119C16.6993 17.3244 16.2753 17.5 15.8333 17.5H5.83331"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M5.83331 14.1666H5.84165"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9.16667 6.66666L11.0833 4.75C11.2694 4.56326 11.4906 4.41516 11.7341 4.3142C11.9776 4.21325 12.2387 4.16143 12.5024 4.16174C12.766 4.16205 13.0269 4.21448 13.2702 4.31601C13.5135 4.41753 13.7344 4.56616 13.92 4.75333L15.5 6.33333C15.6922 6.51817 15.8454 6.73957 15.9508 6.98451C16.0561 7.22944 16.1114 7.49297 16.1135 7.7596C16.1155 8.02623 16.0642 8.29056 15.9625 8.53707C15.8609 8.78357 15.711 9.00727 15.5217 9.195L8.25 16.5"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className={styles.bulletText}>
                      <strong>Sample Box Curation.</strong> Confidence in your colorways is a must. We curate your box
                      for review.
                    </span>
                  </li>
                  <li className={styles.bulletItem}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M12.5 6.66663C12.279 6.66663 12.067 6.57883 11.9108 6.42255C11.7545 6.26627 11.6667 6.05431 11.6667 5.8333V1.66663C11.9305 1.6662 12.1918 1.71796 12.4355 1.81894C12.6792 1.91991 12.9005 2.06809 13.0867 2.25496L16.0767 5.24496C16.2641 5.43122 16.4127 5.65275 16.5139 5.89676C16.6152 6.14078 16.6671 6.40244 16.6667 6.66663H12.5Z"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M16.6667 6.66663V16.6666C16.6667 17.1087 16.4911 17.5326 16.1785 17.8451C15.866 18.1577 15.442 18.3333 15 18.3333H11.515"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M2.75415 16.275L3.52332 15.9567"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M3.33331 8.82663V3.33329C3.33331 2.89127 3.50891 2.46734 3.82147 2.15478C4.13403 1.84222 4.55795 1.66663 4.99998 1.66663H11.6666"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M3.52336 14.0433L2.75336 13.7241"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M4.87666 12.6899L4.5575 11.9208"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M4.87666 17.3101L4.5575 18.0801"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M6.78998 12.6899L7.10915 11.9208"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M7.10831 18.0801L6.78998 17.3101"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8.14417 14.0433L8.9125 13.7241"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8.14417 15.9567L8.9125 16.2758"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M5.83331 17.5C7.21402 17.5 8.33331 16.3807 8.33331 15C8.33331 13.6193 7.21402 12.5 5.83331 12.5C4.4526 12.5 3.33331 13.6193 3.33331 15C3.33331 16.3807 4.4526 17.5 5.83331 17.5Z"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className={styles.bulletText}>
                      <strong>Vetting the details.</strong> We ensure all the technical details are spot on for you.
                    </span>
                  </li>
                  <li className={styles.bulletItem}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="21" viewBox="0 0 20 21" fill="none">
                      <path
                        d="M2.5 9.625H5C5.44203 9.625 5.86595 9.80937 6.17851 10.1376C6.49107 10.4658 6.66667 10.9109 6.66667 11.375V14C6.66667 14.4641 6.49107 14.9092 6.17851 15.2374C5.86595 15.5656 5.44203 15.75 5 15.75H4.16667C3.72464 15.75 3.30072 15.5656 2.98816 15.2374C2.67559 14.9092 2.5 14.4641 2.5 14V9.625ZM2.5 9.625C2.5 8.59084 2.69399 7.56681 3.0709 6.61137C3.44781 5.65593 4.00026 4.7878 4.6967 4.05653C5.39314 3.32527 6.21993 2.7452 7.12987 2.34945C8.03982 1.95369 9.01509 1.75 10 1.75C10.9849 1.75 11.9602 1.95369 12.8701 2.34945C13.7801 2.7452 14.6069 3.32527 15.3033 4.05653C15.9997 4.7878 16.5522 5.65593 16.9291 6.61137C17.306 7.56681 17.5 8.59084 17.5 9.625M17.5 9.625V14C17.5 14.4641 17.3244 14.9092 17.0118 15.2374C16.6993 15.5656 16.2754 15.75 15.8333 15.75H15C14.558 15.75 14.134 15.5656 13.8215 15.2374C13.5089 14.9092 13.3333 14.4641 13.3333 14V11.375C13.3333 10.9109 13.5089 10.4658 13.8215 10.1376C14.134 9.80937 14.558 9.625 15 9.625H17.5Z"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M17.5 14V15.75C17.5 16.6783 17.1488 17.5685 16.5237 18.2249C15.8986 18.8813 15.0507 19.25 14.1667 19.25H10"
                        stroke="#B65633"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
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
