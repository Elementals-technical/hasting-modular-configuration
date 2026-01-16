import { BaseButton } from "@/shared";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";

import { PopupCenterContent } from "../../PopupCenterContent/PopupCenterContent";

import s from "./AttentionPopup.module.scss";

interface AttentionPopupI {
  isOpening: boolean;
  setIsOpening: (isOpening: boolean) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export const AttentionPopup: React.FC<AttentionPopupI> = ({ isOpening, setIsOpening, onConfirm, onCancel }) => {
  const handleCancel = () => {
    setIsOpening(false);
    onCancel?.();
  };

  const handleConfirm = () => {
    setIsOpening(false);
    onConfirm?.();
  };

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
            <BaseButton onClick={handleCancel} fullWidth={true}>
              Cancel
            </BaseButton>
          </div>

          <div>
            <BaseButton onClick={handleConfirm} fullWidth={true}>
              Accept
            </BaseButton>
          </div>
        </div>
      </div>
    </PopupCenterContent>
  );
};
