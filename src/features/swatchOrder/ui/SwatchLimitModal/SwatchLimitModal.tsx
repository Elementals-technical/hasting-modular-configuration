import { PopupCenterContent } from "@/shared/ui/Popups/PopupCenterContent/PopupCenterContent";
import s from "./SwatchLimitModal.module.scss";

interface SwatchLimitModalProps {
  isOpen: boolean;
  header?: string;
  body: string;
  onClose: () => void;
}

export const SwatchLimitModal = ({ isOpen, header, body, onClose }: SwatchLimitModalProps) => {
  return (
    <PopupCenterContent isOpening={isOpen} onClose={onClose}>
      <div className={s.modal}>
        <div className={s.body}>
          {header && <p className={s.header}>{header}</p>}
          <span className={s.text}>{body}</span>
        </div>
        <div className={s.footer}>
          <button type="button" className={s.okBtn} onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </PopupCenterContent>
  );
};
