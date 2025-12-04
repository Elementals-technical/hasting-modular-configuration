import { useState } from "react";

import { PopupCenterContent } from "@/shared/ui/Popups/PopupCenterContent/PopupCenterContent";
import { BaseButton } from "@/shared";

import img_1 from "../../../../assets/images/png/h1.png";
import img_2 from "../../../../assets/images/png/h2.png";
import img_3 from "../../../../assets/images/png/h3.png";
import img_4 from "../../../../assets/images/png/h4.png";

import s from "./HowToStart.module.scss";
import { CloseIcon } from "@/shared/assets/images/svg/CloseIcon";

const steps = [
  {
    title: "Choose How to Start",
    description:
      "Begin with one of our Pre-Built Concepts — ready-made designs — or build your own custom concept with drag-and-drop control.",
    img: img_1,
  },
  {
    title: "Choose How to Start",
    description: `If you chose a Pre-Built model, you can: add lighting, towel bars, internal organizers, and other accessories, select sink hole options and placement, pick your colors and materials. If you want even more control, click Edit to switch to the Custom Configurator.`,
    img: img_2,
  },
  {
    title: "Custom Mode",
    description:
      "In Custom Configurator, you can: add new cabinets by clicking the “+” button, mix and match different cabinet types, countertops, basins, and add-ons, choose materials, colors, and finishes, adjust layout and sizes to create your ideal setup",
    img: img_3,
  },
  {
    title: "Summary",
    description:
      "In the Summary section, review all your selected components. Once you’re happy, download the specification PDF — it includes all details and technical drawings of your vanity design.",
    img: img_4,
  },
];

interface HowToStartI {
  handleClose: () => void;
}

export const HowToStart: React.FC<HowToStartI> = ({ handleClose }) => {
  const [isOpening, setIsOpening] = useState(true);

  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => setActiveStep((prevStep) => (prevStep + 1) % steps.length);

  return (
    <PopupCenterContent
      onClose={() => {
        setIsOpening(false);
      }}
      isOpening={isOpening}
    >
      <div className={s.howToStart}>
        <div className={s.popupTopContent}>
          <div className={s.closeBtn} onClick={handleClose}>
            <CloseIcon />
          </div>

          <img src={steps[activeStep].img} alt="image" />
        </div>
        <div className={s.howToStartInner}>
          <div className={s.pagination}>
            <div className={s.paginationInner}>
              {steps.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Go to step ${index + 1}`}
                  className={index === activeStep ? s.active : undefined}
                  onClick={() => setActiveStep(index)}
                ></button>
              ))}
            </div>
          </div>

          <div className={s.title}>{steps[activeStep].title}</div>
          <p className={s.content}>{steps[activeStep].description}</p>

          <div className={s.footer}>
            <BaseButton onClick={handleNext}>Next</BaseButton>
          </div>
        </div>
      </div>
    </PopupCenterContent>
  );
};
