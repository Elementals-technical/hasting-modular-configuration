import { useState } from "react";

import { PopupCenterContent } from "@/shared/ui/Popups/PopupCenterContent/PopupCenterContent";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import { BaseButton } from "@/shared";

import s from "./InstructionPopup.module.scss";

interface InstructionPopupI {
  handleClose: () => void;
}

export const InstructionPopup: React.FC<InstructionPopupI> = ({ handleClose }) => {
  const [isOpening, setIsOpening] = useState(true);

  return (
    <PopupCenterContent
      onClose={() => {
        setIsOpening(false);
        handleClose();
      }}
      isOpening={isOpening}
    >
      <div className={s.instrPopup}>
        <div className={s.header}>
          <div className={s.title}>Instructions</div>
          <div
            className={s.button}
            onClick={() => {
              setIsOpening(false);
              handleClose();
            }}
          >
            <CloseBtnIcon />
          </div>
        </div>

        <div className={s.content}></div>

        <div className={s.footer}>
          <BaseButton
            onClick={() => {
              setIsOpening(false);
              handleClose();
            }}
            fullWidth={true}
          >
            Get Started
          </BaseButton>
        </div>
      </div>
    </PopupCenterContent>
  );
};
