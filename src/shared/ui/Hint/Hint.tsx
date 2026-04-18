import {
  cloneElement,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import clsx from "clsx";

import { PortalBody } from "@/shared/ui/Popups/Portal/PortalBody";

import s from "./Hint.module.scss";

type Placement = "top" | "bottom" | "left" | "right";

const VIEWPORT_PADDING = 8;

interface HintProps extends PropsWithChildren {
  content: ReactNode;
  placement?: Placement;
  offset?: number;
  trigger?: "hover" | "click";
  className?: string;
}

export const Hint = ({ children, content, placement = "top", offset = 8, trigger = "hover", className }: HintProps) => {
  const triggerRef = useRef<HTMLElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const basePos: Record<Placement, { top: number; left: number }> = {
      top: { top: rect.top - offset, left: centerX },
      bottom: { top: rect.bottom + offset, left: centerX },
      left: { top: centerY, left: rect.left - offset },
      right: { top: centerY, left: rect.right + offset },
    };
    const next = { ...basePos[placement] };

    const bubble = bubbleRef.current;
    if (bubble) {
      const { width: bw, height: bh } = bubble.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (placement === "top" || placement === "bottom") {
        // transform: translateX(-50%) → left is bubble's center.
        const half = bw / 2;
        const min = half + VIEWPORT_PADDING;
        const max = vw - half - VIEWPORT_PADDING;
        if (max >= min) next.left = Math.min(max, Math.max(min, next.left));
      } else if (placement === "left") {
        // transform: translateX(-100%) → left is bubble's right edge.
        next.left = Math.max(bw + VIEWPORT_PADDING, Math.min(vw - VIEWPORT_PADDING, next.left));
      } else if (placement === "right") {
        // left is bubble's left edge.
        next.left = Math.max(VIEWPORT_PADDING, Math.min(vw - bw - VIEWPORT_PADDING, next.left));
      }

      if (placement === "top") {
        // transform: translateY(-100%) → top is bubble's bottom edge.
        next.top = Math.max(bh + VIEWPORT_PADDING, next.top);
      } else if (placement === "bottom") {
        next.top = Math.min(vh - bh - VIEWPORT_PADDING, next.top);
      } else {
        // translateY(-50%) → top is bubble's center.
        const halfH = bh / 2;
        next.top = Math.max(halfH + VIEWPORT_PADDING, Math.min(vh - halfH - VIEWPORT_PADDING, next.top));
      }
    }

    setPos(next);
  }, [open, placement, offset, content]);

  const toggleOpen = (next: boolean) => setOpen(next);

  const attachEvents =
    trigger === "click"
      ? { onClick: () => toggleOpen(!open) }
      : {
          onMouseEnter: () => toggleOpen(true),
          onMouseLeave: () => toggleOpen(false),
          onFocus: () => toggleOpen(true),
          onBlur: () => toggleOpen(false),
        };

  const child = cloneElement(children as ReactElement, {
    ref: triggerRef,
    ...attachEvents,
  });

  return (
    <>
      {child}
      {open && (
        <PortalBody>
          <div className={clsx(s.hint, s[placement], className)} style={{ top: pos.top, left: pos.left }}>
            <div ref={bubbleRef} className={s.bubble}>
              {content}
            </div>
            {/* <div className={s.arrow} /> */}
          </div>
        </PortalBody>
      )}
    </>
  );
};
