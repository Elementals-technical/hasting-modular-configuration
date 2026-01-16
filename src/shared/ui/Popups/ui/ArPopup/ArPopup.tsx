import QRCode from "react-qr-code";

import { BaseButton } from "@/shared";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";

import { PopupCenterContent } from "../../PopupCenterContent/PopupCenterContent";

import s from "./ArPopup.module.scss";
import { LoaderBlock } from "@/shared/ui/LoaderBlock/LoaderBlock";

interface ArPopupI {
  isOpening: boolean;
  setIsOpening: (isOpening: boolean) => void;
  qrValue?: string;
  qrSize?: number;
  isLoadingAr: boolean;
}

export const ArPopup: React.FC<ArPopupI> = ({ isLoadingAr, isOpening, setIsOpening, qrValue, qrSize = 180 }) => {
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
          {isLoadingAr ? (
            <LoaderBlock />
          ) : qrValue ? (
            <QRCode value={qrValue} size={qrSize} />
          ) : (
            <div className={s.message}>No products to share</div>
          )}
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
