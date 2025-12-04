import { useEffect, useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import s_animate from "./animation.module.scss";

interface PopupOverlayPropsI extends React.PropsWithChildren {
  isOpening: boolean;
  animationDurationMs?: number;
}

const contentAnimation = {
  enter: s_animate.contentEnter,
  enterActive: s_animate.contentEnterActive,
  exit: s_animate.contentExit,
  exitActive: s_animate.contentExitActive,
};

export const AnimationOpacity = (props: PopupOverlayPropsI) => {
  const { children, isOpening, animationDurationMs = 300 } = props;
  const contentRef = useRef<HTMLDivElement>(null);
  const [animationIn, setAnimationIn] = useState(false);

  useEffect(() => {
    setAnimationIn(isOpening);
  }, [isOpening]);

  return (
    <CSSTransition
      in={animationIn}
      nodeRef={contentRef}
      timeout={animationDurationMs}
      mountOnEnter
      unmountOnExit
      classNames={contentAnimation}
    >
      <div ref={contentRef} className={s_animate.animationWrap}>
        {children}
      </div>
    </CSSTransition>
  );
};
