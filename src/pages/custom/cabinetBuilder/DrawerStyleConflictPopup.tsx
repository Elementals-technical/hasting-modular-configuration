import { BaseButton } from "@/shared";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import { PopupCenterContent } from "@/shared/ui/Popups/PopupCenterContent/PopupCenterContent";

import s from "./DrawerStyleConflictPopup.module.scss";

interface DrawerStyleConflictPopupProps {
  isOpening: boolean;
  newStyleTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DrawerStyleConflictPopup: React.FC<DrawerStyleConflictPopupProps> = ({
  isOpening,
  newStyleTitle,
  onConfirm,
  onCancel,
}) => {
  return (
    <PopupCenterContent onClose={onCancel} isOpening={isOpening}>
      <div className={s.popup}>
        <div className={s.header}>
          <div className={s.title}>Clear Design?</div>
          <div className={s.closeBtn} onClick={onCancel}>
            <CloseBtnIcon />
          </div>
        </div>

        <div className={s.content}>
          <p>
            Switching to <strong>{newStyleTitle}</strong> requires a fresh start. All current cabinets will be removed
            from your design.
          </p>
          <p>Are you sure you want to proceed?</p>
        </div>

        <div className={s.footer}>
          <div>
            <BaseButton onClick={onCancel} fullWidth={true}>
              Cancel
            </BaseButton>
          </div>
          <div>
            <BaseButton onClick={onConfirm} fullWidth={true}>
              Clear All
            </BaseButton>
          </div>
        </div>
      </div>
    </PopupCenterContent>
  );
};
