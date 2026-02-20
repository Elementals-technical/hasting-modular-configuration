import { BaseButton } from "@/shared";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";

import { PopupRightContent } from "../../PopupRightContent/PopupRightContent";

import s from "./HelpPopup.module.scss";

interface HelpPopupI {
  isOpening: boolean;
  onClose: () => void;
}

export const HelpPopup: React.FC<HelpPopupI> = ({ isOpening, onClose }) => {
  const handleDisabledLink = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
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
            <li>
              <a href="#" onClick={handleDisabledLink}>
                <span>I have a product question</span>
                <span>
                  <ArrowRight />
                </span>
              </a>
            </li>
            <li>
              <a href="#" onClick={handleDisabledLink}>
                <span>I need design assistance</span>
                <span>
                  <ArrowRight />
                </span>
              </a>
            </li>
            <li>
              <a href="#" onClick={handleDisabledLink}>
                <span>Order Free Samples</span>
                <span>
                  <ArrowRight />
                </span>
              </a>
            </li>
            <li>
              <a href="#" onClick={handleDisabledLink}>
                <span>View In My Space</span>
                <span>
                  <ArrowRight />
                </span>
              </a>
            </li>
            <li>
              <a href="#" onClick={handleDisabledLink}>
                <span>Question</span>
                <span>
                  <ArrowRight />
                </span>
              </a>
            </li>
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
