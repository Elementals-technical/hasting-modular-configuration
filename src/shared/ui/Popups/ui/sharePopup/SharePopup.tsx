import { BaseButton } from "@/shared";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";

import { PopupCenterContent } from "../../PopupCenterContent/PopupCenterContent";

import s from "./SharePopup.module.scss";

interface SharePopupI {
  isOpening: boolean;
  setIsOpening: (isOpening: boolean) => void;
  shareValue?: string;
  onCopy?: () => void;
}

export const SharePopup: React.FC<SharePopupI> = ({ isOpening, setIsOpening, shareValue = "", onCopy }) => {
  return (
    <PopupCenterContent
      onClose={() => {
        setIsOpening(false);
      }}
      isOpening={isOpening}
    >
      <div className={s.instrPopup}>
        <div className={s.header}>
          <div className={s.title}>Share</div>
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
          <p>Copy the link below to share this configuration.</p>
          <div className={s.inputWrap}>
            <input className={s.input} value={shareValue} readOnly />
          </div>
        </div>

        <div className={s.footer}>
          <div className={s.footerInner}>
            <BaseButton fullWidth={true}>Copy to clipboard</BaseButton>
          </div>
        </div>
      </div>
    </PopupCenterContent>
  );
};
