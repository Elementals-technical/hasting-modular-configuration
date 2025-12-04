import { useState } from "react";

import { PopupCenterContent } from "@/shared/ui/Popups/PopupCenterContent/PopupCenterContent";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import { BaseButton } from "@/shared";

import img_1 from "@/shared/assets/images/png/first_inst.png";
import img_2 from "@/shared/assets/images/png/sec_inst.png";
import img_3 from "@/shared/assets/images/png/third_inst.png";

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

        <div className={s.content}>
          <div className={s.contentBlock}>
            <div>1. Tap on the piece you’d like to add.</div>
            <div className={s.contentBlock_img}>
              <img src={img_1} alt="first image" />
            </div>
          </div>

          <div className={s.contentBlock}>
            <div>2. Tap on + icon to insert the selected piece.</div>
            <div className={s.contentBlock_img}>
              <img src={img_2} alt="first image" />
            </div>
          </div>

          <div className={s.contentBlock}>
            <div>3. To edit, tap a piece, then click an action you want</div>
            <div className={s.contentBlock_img}>
              <img src={img_3} alt="first image" />
            </div>
          </div>
        </div>

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
