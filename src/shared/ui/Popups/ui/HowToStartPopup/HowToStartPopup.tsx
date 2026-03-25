import { useState } from "react";

import { PopupCenterContent } from "@/shared/ui/Popups/PopupCenterContent/PopupCenterContent";
import { BaseButton } from "@/shared";

import howToStartVideo from "../../../../assets/video/howtostart-faster.webm";
import prebuildVideo from "../../../../assets/video/prebuild-faster.webm";
import customVideo from "../../../../assets/video/custom.webm";

import s from "./HowToStart.module.scss";
import { CloseIcon } from "@/shared/assets/images/svg/CloseIcon";

type HowToStartStep = {
  title: string;
  description: string;
  image?: string;
  video?: string;
};

const steps: HowToStartStep[] = [
  {
    title: "Choose How to Start",
    description:
      "Start with one of our pre-built, ready-made designs—or create your own custom concept using drag-and-drop controls.",
  },
  {
    title: "Pre-Built Mode",
    description: `Customize your design from pre-made solutions:\n- Sort by size and style\n- Choose your colors and materials\n- Select your countertop and sink style\n- Add internal organizers, towel bars and more\nIf you want even more control click 'customize' to transition to custom mode for full design control`,
    video: prebuildVideo,
  },
  {
    title: "Custom Mode",
    description: `Create a custom design with our cabinet builder\n- Add, remove, resize, reposition cabinets with ease\n- Utilize the in-scene editor for fast-paced editing\n- Tailor your colorways, countertop details and more\n- Accessorize with drawer dividers, towel bars and more`,
    video: customVideo,
  },
];

interface HowToStartI {
  handleClose: () => void;
}

export const HowToStart: React.FC<HowToStartI> = ({ handleClose }) => {
  const [isOpening, setIsOpening] = useState(true);

  const [activeStep, setActiveStep] = useState(0);
  const activeMedia = steps[activeStep];

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
          <div className={s.topHeader}>
            <div className={s.topTitle}>How to use</div>
            <div className={s.closeBtn} onClick={handleClose}>
              <CloseIcon fill="#333333" />
            </div>
          </div>

          {activeMedia.image ? (
            <img className={s.previewImage} src={activeMedia.image} alt="Summary" />
          ) : (
            <video
              className={s.previewVideo}
              src={activeMedia.video ?? howToStartVideo}
              autoPlay
              muted
              loop
              playsInline
            />
          )}
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
          <div className={s.content}>
            {steps[activeStep].description.split("\n").map((line, i) =>
              line.startsWith("- ") ? (
                <ul key={i} className={s.contentList}>
                  <li>{line.slice(2)}</li>
                </ul>
              ) : (
                <p key={i}>{line}</p>
              )
            )}
          </div>

          <div className={s.footer}>
            <BaseButton onClick={handleNext}>Next</BaseButton>
          </div>
        </div>
      </div>
    </PopupCenterContent>
  );
};
