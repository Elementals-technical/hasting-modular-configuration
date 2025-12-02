import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { PortalBody } from "../Portal/PortalBody";
import s_animate from "./animation.module.scss";
import s from "./PopupOverlay.module.scss";

interface PopupOverlayPropsI extends PropsWithChildren {
  onClose: () => void;
  isOpening: boolean;
  position?: "Left" | "Right" | "LeftFromMenu";
  animationDurationMs?: number;
}

const overlayAnimation = {
  enter: s_animate.overlayEnter,
  enterActive: s_animate.overlayEnterActive,
  exit: s_animate.overlayExit,
  exitActive: s_animate.overlayExitActive,
};

export const PopupOverlay: React.FC<PopupOverlayPropsI> = ({
  children,
  onClose,
  isOpening,
  position,
  animationDurationMs = 300,
}: PopupOverlayPropsI) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [animationIn, setAnimationIn] = useState(false);

  useEffect(() => {
    setAnimationIn(isOpening);
  }, [isOpening]);

  return (
    <PortalBody>
      <div className={`${s.popupWrapper} ${position ? s[position] : ""}`}>
        <CSSTransition
          in={animationIn}
          nodeRef={overlayRef}
          timeout={animationDurationMs}
          mountOnEnter
          unmountOnExit
          classNames={overlayAnimation}
        >
          <div
            ref={overlayRef}
            className={s.overlay}
            onClick={onClose}
            role="button"
            tabIndex={0}
            aria-label="Overlay"
            onKeyDown={() => null}
          />
        </CSSTransition>
        {children}
      </div>
    </PortalBody>
  );
};
