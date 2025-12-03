import { useState } from "react";

import { BaseButton } from "../Buttons/BaseButton";

import { CloseIcon } from "@/shared/assets/images/svg/CloseIcon";

import s from "./HowToBuild.module.scss";

const steps = [
  {
    title: "Choose How to Start",
    description:
      "Begin with one of our Pre-Built Concepts — ready-made designs — or build your own custom concept with drag-and-drop control.",
  },
  {
    title: "Choose How to Start",
    description: `If you chose a Pre-Built model, you can: add lighting, towel bars, internal organizers, and other accessories, select sink hole options and placement, pick your colors and materials. If you want even more control, click Edit to switch to the Custom Configurator.`,
  },
  {
    title: "Custom Mode",
    description:
      "In Custom Configurator, you can: add new cabinets by clicking the “+” button, mix and match different cabinet types, countertops, basins, and add-ons, choose materials, colors, and finishes, adjust layout and sizes to create your ideal setup",
  },
  {
    title: "Summary",
    description:
      "In the Summary section, review all your selected components. Once you’re happy, download the specification PDF — it includes all details and technical drawings of your vanity design.",
  },
];

interface HowToBuildI {
  handleClose: () => void;
}

export const HowToBuild: React.FC<HowToBuildI> = ({ handleClose }) => {
  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => setActiveStep((prevStep) => (prevStep + 1) % steps.length);

  return (
    <div className={s.howToBuild}>
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

        <div className={s.closeBtn} onClick={handleClose}>
          <CloseIcon />
        </div>
      </div>

      <div className={s.title}>{steps[activeStep].title}</div>
      <p className={s.content}>{steps[activeStep].description}</p>

      <BaseButton onClick={handleNext}>Next</BaseButton>
    </div>
  );
};
