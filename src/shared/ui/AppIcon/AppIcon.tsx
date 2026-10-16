import { forwardRef, type CSSProperties } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import clsx from "clsx";

import { getIconStrokeWidth } from "./iconStroke";
import s from "./AppIcon.module.scss";

type Props = Omit<LucideProps, "absoluteStrokeWidth" | "nonScalingStroke" | "strokeWidth"> & {
  icon: LucideIcon;
};

/** Shared Lucide appearance; responsive hosts can set --icon-stroke-width for CSS-sized icons. */
export const AppIcon = forwardRef<SVGSVGElement, Props>(function AppIcon(
  { icon: Icon, size = 20, width = size, height = size, className, style, ...props },
  ref,
) {
  const strokeWidth = getIconStrokeWidth(Math.min(Number(width), Number(height)));
  const iconStyle = { "--icon-default-stroke-width": strokeWidth, ...style } as CSSProperties;

  return (
    <Icon
      {...props}
      ref={ref}
      size={size}
      width={width}
      height={height}
      strokeWidth={strokeWidth}
      nonScalingStroke
      className={clsx(s.icon, className)}
      style={iconStyle}
    />
  );
});
