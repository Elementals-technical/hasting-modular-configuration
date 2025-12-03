import { PropsWithChildren } from "react";
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

  if (!mounted) {
    return null;
  }

  return (
    <div className={s.rightContent}>
      {disableAnimation ? (
        children
      ) : (
        <AnimationOpacity isOpening={isOpening} animationDurationMs={animationDurationMs}>
          {children}
        </AnimationOpacity>
      )}
    </div>
  );
};
