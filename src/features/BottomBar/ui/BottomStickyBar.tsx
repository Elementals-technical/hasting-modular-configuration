import { BaseButton } from "@/shared/ui/Buttons/BaseButton";

import s from "./BottomStickyBar.module.scss";

export const BottomStickyBar = () => {
  return (
    <div className={s.bottomBar}>
      <div className={s.total}>
        <span>Total</span>
        <span>$1,299.99</span>
      </div>
      <div className={s.nextStepWrapp}>
        <BaseButton fullWidth={true}>Next: Cabinet</BaseButton>
      </div>
    </div>
  );
};
