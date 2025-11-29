import { ArrowLeft } from "../../assets/images/svg/ArrowLeft.tsx";
import { HintIcon } from "../../assets/images/svg/HintIcon.tsx";

import s from "./StepNavigationBar.module.scss";

export const StepNavigationBar = () => {
  return (
    <div className={s.stepNavigationBar}>
      <div>
        <ArrowLeft />
      </div>
      <div className={s.stepNavigationBar_title}>Select model</div>
      <div>
        <HintIcon />
      </div>
    </div>
  );
};
