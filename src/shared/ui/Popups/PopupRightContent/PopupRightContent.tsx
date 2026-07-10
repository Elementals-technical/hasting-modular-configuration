import { useRef, type PointerEvent, type PropsWithChildren, type SyntheticEvent } from "react";
import { AnimationOpacity } from "../Animation/AnimationOpacity/AnimationOpacity";
import { useMount } from "../hooks/useMount";
import s from "./PopupRightContent.module.scss";

interface PopupFullHeightLeftPropsI extends PropsWithChildren {
  onClose: () => void;
  isOpening: boolean;
  disableAnimation?: boolean;
  animationDurationMs?: number;
}

export const PopupRightContent = ({
  children,
  onClose,
  isOpening,
  disableAnimation = false,
  animationDurationMs,
}: PopupFullHeightLeftPropsI) => {
  const { mounted } = useMount({ opened: isOpening, animationDurationMs });
  const lastTouchTapAtRef = useRef(0);

  if (!mounted) {
    return null;
  }

  const stopBackdropEvent = (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleBackdropPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    stopBackdropEvent(event);

    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;

    const now = Date.now();
    const isDoubleTap = now - lastTouchTapAtRef.current < 350;
    lastTouchTapAtRef.current = now;

    if (isDoubleTap) {
      lastTouchTapAtRef.current = 0;
      onClose();
    }
  };

  return (
    <>
      <div
        className={s.backdrop}
        onPointerDown={stopBackdropEvent}
        onPointerUp={handleBackdropPointerUp}
        onMouseDown={stopBackdropEvent}
        onClick={stopBackdropEvent}
        onDoubleClick={(event) => {
          stopBackdropEvent(event);
          onClose();
        }}
      />
      <div className={s.rightContent}>
        {disableAnimation ? (
          children
        ) : (
          <AnimationOpacity isOpening={isOpening} animationDurationMs={animationDurationMs}>
            {children}
          </AnimationOpacity>
        )}
      </div>
    </>
  );
};
