import { Link } from "react-router-dom";

import { BaseButton } from "@/shared";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";

import { PopupRightContent } from "../../PopupRightContent/PopupRightContent";

import s from "./HelpPopup.module.scss";

interface HelpPopupI {
  isOpening: boolean;
  setIsOpening: (isOpening: boolean) => void;
}

export const HelpPopup: React.FC<HelpPopupI> = ({ isOpening, setIsOpening }) => {
  return (
    <PopupRightContent
      onClose={() => {
        setIsOpening(false);
      }}
      isOpening={isOpening}
      animationDurationMs={400}
    >
      <div className={s.instrPopup}>
        <div className={s.header}>
          <div className={s.title}>How can we help?</div>
          <div className={s.button} onClick={() => setIsOpening(false)}>
            <CloseBtnIcon />
          </div>
        </div>

        <div className={s.content}>
          <ul className={s.popupList}>
            <li>
              <Link to={"#"}>
                <span>I have a product question</span>
                <span>
                  <ArrowRight />
                </span>
              </Link>
            </li>
            <li>
              <Link to={"#"}>
                <span>I need design assistance</span>
                <span>
                  <ArrowRight />
                </span>
              </Link>
            </li>
            <li>
              <Link to={"#"}>
                <span>Order Free Samples</span>
                <span>
                  <ArrowRight />
                </span>
              </Link>
            </li>
            <li>
              <Link to={"#"}>
                <span>View In My Space</span>
                <span>
                  <ArrowRight />
                </span>
              </Link>
            </li>
            <li>
              <Link to={"#"}>
                <span>Question</span>
                <span>
                  <ArrowRight />
                </span>
              </Link>
            </li>
          </ul>
        </div>

        <div className={s.footer}>
          <BaseButton onClick={() => setIsOpening(false)} fullWidth={true}>
            Get Started
          </BaseButton>
        </div>
      </div>
    </PopupRightContent>
  );
};
