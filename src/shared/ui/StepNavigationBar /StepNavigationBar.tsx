import { ArrowLeft } from "@/shared/assets/images/svg/ArrowLeft.tsx";
import { HintIcon } from "@/shared/assets/images/svg/HintIcon.tsx";

import s from "./StepNavigationBar.module.scss";

interface StepNavigationBarI {
  title: string | null;
}

export const StepNavigationBar: React.FC<StepNavigationBarI> = ({ title }) => {
  return (
    <div className={s.stepNavigationBar}>
      <div>
        <ArrowLeft />
      </div>
      <div className={s.stepNavigationBar_title}>Select {title}</div>
      <div>
        <HintIcon />
      </div>
    </div>
  );
};
