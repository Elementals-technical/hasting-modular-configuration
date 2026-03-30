import { BaseButton } from "@/shared";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";
import { PopupRightContent } from "@/shared/ui/Popups/PopupRightContent/PopupRightContent";

import s from "./HelpCenterPopup.module.scss";

export interface HelpCenterItem {
  id: string;
  label: string;
  onClick?: () => void;
}

interface HelpCenterPopupProps {
  isOpening: boolean;
  onClose: () => void;
  items: HelpCenterItem[];
}

export const HelpCenterPopup: React.FC<HelpCenterPopupProps> = ({ isOpening, onClose, items }) => {
  const handleItemClick = (item: HelpCenterItem) => {
    item.onClick?.();
  };

  return (
    <PopupRightContent onClose={onClose} isOpening={isOpening} animationDurationMs={400}>
      <div className={s.instrPopup}>
        <div className={s.header}>
          <div className={s.title}>How can we help?</div>
          <div className={s.button} onClick={onClose}>
            <CloseBtnIcon />
          </div>
        </div>

        <div className={s.content}>
          <ul className={s.popupList}>
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" className={s.popupItem} onClick={() => handleItemClick(item)}>
                  <span>{item.label}</span>
                  <span>
                    <ArrowRight />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className={s.footer}>
          <BaseButton onClick={onClose} fullWidth={true}>
            Get Started
          </BaseButton>
        </div>
      </div>
    </PopupRightContent>
  );
};
