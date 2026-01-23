import { Link, useSearchParams } from "react-router-dom";

import { BaseButton } from "@/shared";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";

import { PopupRightContent } from "../../PopupRightContent/PopupRightContent";
import { AssistanceStep } from "./steps/assistance/assistance";
import { QuestionStep } from "./steps/question/question";

import s from "./HelpPopup.module.scss";

interface HelpPopupI {
  isOpening: boolean;
  onClose: () => void;
}

export const HelpPopup: React.FC<HelpPopupI> = ({ isOpening, onClose }) => {
  const [searchParams] = useSearchParams();
  const step = searchParams.get("step") || "";
  const stepsMap: Record<string, React.FC> = {
    assistance: AssistanceStep,
    design: AssistanceStep,
    question: QuestionStep,
    product: QuestionStep,
    general: QuestionStep,
  };
  const StepComponent = stepsMap[step];

  const buildStepLink = (step: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("help", "1");
    nextParams.set("step", step);
    const search = nextParams.toString();

    return {
      search: search ? `?${search}` : "",
    };
  };

  return (
    <PopupRightContent
      onClose={onClose}
      isOpening={isOpening}
      animationDurationMs={400}
    >
      <div className={s.instrPopup}>
        <div className={s.header}>
          <div className={s.title}>How can we help?</div>
          <div className={s.button} onClick={onClose}>
            <CloseBtnIcon />
          </div>
        </div>

        <div className={s.content}>
          {StepComponent ? (
            <StepComponent />
          ) : (
            <ul className={s.popupList}>
              <li>
                <Link to={buildStepLink("question")}>
                  <span>I have a product question</span>
                  <span>
                    <ArrowRight />
                  </span>
                </Link>
              </li>
              <li>
                <Link to={buildStepLink("assistance")}>
                  <span>I need design assistance</span>
                  <span>
                    <ArrowRight />
                  </span>
                </Link>
              </li>
              <li>
                <Link to={buildStepLink("question")}>
                  <span>Order Free Samples</span>
                  <span>
                    <ArrowRight />
                  </span>
                </Link>
              </li>
              <li>
                <Link to={buildStepLink("question")}>
                  <span>View In My Space</span>
                  <span>
                    <ArrowRight />
                  </span>
                </Link>
              </li>
              <li>
                <Link to={buildStepLink("question")}>
                  <span>Question</span>
                  <span>
                    <ArrowRight />
                  </span>
                </Link>
              </li>
            </ul>
          )}
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
