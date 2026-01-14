import { BaseButton } from "@/shared";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";

import { PopupCenterContent } from "../../PopupCenterContent/PopupCenterContent";

import ar_image from "@/shared/assets/images/png/ar_image.png";

import s from "./ArPopup.module.scss";

interface ArPopupI {
  isOpening: boolean;
  setIsOpening: (isOpening: boolean) => void;
}

export const ArPopup: React.FC<ArPopupI> = ({ isOpening, setIsOpening }) => {
  return (
    <PopupCenterContent
      onClose={() => {
        setIsOpening(false);
      }}
      isOpening={isOpening}
    >
      <div className={s.instrPopup}>
        <div className={s.header}>
          <div className={s.title}>View in Augmented Reality</div>
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
          <p>Scan the QR code to view in your space</p>
        </div>

        <div className={s.arImage}>
          <img src={ar_image} alt="QR image" />
        </div>

        <div className={s.footer}>
          <div className={s.footerInner}>
            <BaseButton
              onClick={() => {
                setIsOpening(false);
              }}
              fullWidth={true}
            >
              Done
            </BaseButton>
          </div>
        </div>
      </div>
    </PopupCenterContent>
  );
};
