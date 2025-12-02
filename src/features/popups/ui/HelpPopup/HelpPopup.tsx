import { useState } from "react";

import { BaseButton } from "@/shared";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import { PopupCenterContent } from "@/shared/ui/Popups/PopupCenterContent/PopupCenterContent";

import s from "./HelpPopup.module.scss";

export const HelpPopup = () => {
  const [isOpening, setIsOpening] = useState(true);

  return (
    <PopupCenterContent
      onClose={() => {
        setIsOpening(false);
      }}
      isOpening={isOpening}
    >
      <div className={s.instrPopup}>
        <div className={s.header}>
          <div className={s.title}>How can we help?</div>
          <div className={s.button} onClick={() => setIsOpening(false)}>
            <CloseBtnIcon />
          </div>
        </div>

        <div className={s.content}></div>

        <div className={s.footer}>
          <BaseButton onClick={() => setIsOpening(false)} fullWidth={true}>
            Get Started
          </BaseButton>
        </div>
      </div>
    </PopupCenterContent>
  );
};
