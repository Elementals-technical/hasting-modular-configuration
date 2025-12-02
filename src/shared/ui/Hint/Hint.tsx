import { cloneElement, PropsWithChildren, ReactElement, ReactNode, useEffect, useRef, useState } from "react";

import clsx from "clsx";

import { PortalBody } from "@/shared/ui/Popups/Portal/PortalBody";

import s from "./Hint.module.scss";

type Placement = "top" | "bottom" | "left" | "right";

interface HintProps extends PropsWithChildren {
  content: ReactNode;
  placement?: Placement;
  offset?: number;
  trigger?: "hover" | "click";
  className?: string;
}

export const Hint = ({ children, content, placement = "top", offset = 8, trigger = "hover", className }: HintProps) => {
  const triggerRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const placements: Record<Placement, { top: number; left: number }> = {
      top: { top: rect.top - offset, left: centerX },
      bottom: { top: rect.bottom + offset, left: centerX },
      left: { top: centerY, left: rect.left - offset },
      right: { top: centerY, left: rect.right + offset },
    };

    setPos(placements[placement]);
  }, [open, placement, offset]);

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
            <div className={s.bubble}>{content}</div>
            {/* <div className={s.arrow} /> */}
          </div>
        </PortalBody>
      )}
    </>
  );
};
