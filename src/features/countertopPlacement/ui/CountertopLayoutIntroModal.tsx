import { useId, useState } from "react";
import clsx from "clsx";

import { BaseButton } from "@/shared";
import layoutSlideFloatingTop from "@/shared/assets/images/png/popup/Countertop_Layout_1.png";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import { PopupCenterContent } from "@/shared/ui/Popups/PopupCenterContent/PopupCenterContent";

import s from "./CountertopLayoutIntroModal.module.scss";

type LayoutSlide = { id: string; src: string; alt: string };

/** Example layouts the user can build in Drag & Drop; the dots appear once there is more than one. */
const LAYOUT_SLIDES: readonly LayoutSlide[] = [
  {
    id: "floating-top",
    src: layoutSlideFloatingTop,
    alt: "A countertop with a vessel sink repositioned above a row of cabinets",
  },
];

type CountertopLayoutIntroModalProps = {
  isOpening: boolean;
  onContinue: () => void;
  onClose: () => void;
};

/** The "Customize Your Countertop Layout" intro shown before countertop Drag & Drop. */
export const CountertopLayoutIntroModal = ({ isOpening, onContinue, onClose }: CountertopLayoutIntroModalProps) => (
  <PopupCenterContent isOpening={isOpening} onClose={onClose}>
    <IntroContent onContinue={onContinue} onClose={onClose} />
  </PopupCenterContent>
);

type IntroContentProps = Omit<CountertopLayoutIntroModalProps, "isOpening">;

/** Mounted only while the popup is, so every opening starts on the first slide. */
const IntroContent = ({ onContinue, onClose }: IntroContentProps) => {
  const titleId = useId();
  const [activeSlideId, setActiveSlideId] = useState(LAYOUT_SLIDES[0].id);
  const activeSlide = LAYOUT_SLIDES.find((slide) => slide.id === activeSlideId) ?? LAYOUT_SLIDES[0];

  return (
    <div className={s.modal} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className={s.header}>
        <div className={s.title} id={titleId}>
          Customize Your Countertop Layout
        </div>
        <button type="button" aria-label="Close" className={s.closeButton} onClick={onClose}>
          <CloseBtnIcon />
        </button>
      </div>

      <div className={s.slide}>
        <img className={s.slideImage} src={activeSlide.src} alt={activeSlide.alt} />
      </div>

      <div className={s.body}>
        <div className={s.copy}>
          {LAYOUT_SLIDES.length > 1 && (
            <div className={s.dots}>
              {LAYOUT_SLIDES.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`Show example ${index + 1}`}
                  aria-current={slide.id === activeSlide.id}
                  className={clsx(s.dot, slide.id === activeSlide.id && s.dotActive)}
                  onClick={() => setActiveSlideId(slide.id)}
                />
              ))}
            </div>
          )}
          <p className={s.text}>
            You’re about to enter Drag &amp; Drop mode, where you can freely reposition your countertop. Here are a few
            examples of what you can create.
          </p>
        </div>
        <BaseButton type="button" className={s.continueButton} onClick={onContinue}>
          Continue
        </BaseButton>
      </div>
    </div>
  );
};
