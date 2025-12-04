import { useState } from "react";

import { BaseButton } from "@/shared";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";

import { PopupCenterContent } from "../../PopupCenterContent/PopupCenterContent";

import s from "./AttentionPopup.module.scss";

export const AttentionPopup = () => {
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
          <div className={s.title}>Attention!</div>
          <div
            className={s.button}
            onClick={() => {
              setIsOpening(false);
            }}
          >
            <CloseBtnIcon />
          </div>
        </div>

        <div className={s.content}>
          <p>If you leave your configuration now, your customizations will be removed.</p>
          <p>Are you sure you want to proceed?</p>
        </div>

        <div className={s.footer}>
          <div>
            <BaseButton
              onClick={() => {
                setIsOpening(false);
              }}
              fullWidth={true}
            >
              Cancel
            </BaseButton>
          </div>

          <div>
            <BaseButton
              onClick={() => {
                setIsOpening(false);
              }}
              fullWidth={true}
            >
              Accept
            </BaseButton>
          </div>
        </div>
      </div>
    </PopupCenterContent>
  );
};
