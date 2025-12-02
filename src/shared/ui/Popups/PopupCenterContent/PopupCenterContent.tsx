import { AnimationOpacity } from "../Animation/AnimationOpacity/AnimationOpacity";
import { useMount } from "../hooks/useMount";
import { PopupOverlay } from "../PopupOverlay/PopupOverlay";
import s from "./PopupCenterContent.module.scss";
import { PropsWithChildren } from "react";

interface PopupFullHeightLeftPropsI extends PropsWithChildren {
  onClose: () => void;
  isOpening: boolean;
  disableAnimation?: boolean;
  animationDurationMs?: number;
}

export const PopupCenterContent = ({
  children,
  onClose,
  isOpening,
  disableAnimation = false,
  animationDurationMs,
}: PopupFullHeightLeftPropsI) => {
  const { mounted } = useMount({ opened: isOpening, animationDurationMs });

  if (!mounted) {
    return null;
  }

  return (
    <PopupOverlay isOpening={isOpening} onClose={onClose} animationDurationMs={animationDurationMs}>
      <div className={s.centerContent}>
        {disableAnimation ? (
          children
        ) : (
          <AnimationOpacity isOpening={isOpening} animationDurationMs={animationDurationMs}>
            {children}
          </AnimationOpacity>
        )}
      </div>
    </PopupOverlay>
  );
};
