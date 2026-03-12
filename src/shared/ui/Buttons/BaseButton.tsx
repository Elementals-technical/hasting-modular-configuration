import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

import s from "./BaseButton.module.scss";

type BaseButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "filterBtn";
  size?: "md" | "lg" | "sm";
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
};

export const BaseButton = ({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  fullWidth = false,
  className,
  children,
  ...props
}: BaseButtonProps) => (
  <button className={clsx(s.button, s[variant], s[size], fullWidth && s.fullWidth, className)} {...props}>
    {leftIcon && <span className={s.icon}>{leftIcon}</span>}
    <span className={s.label}>{children}</span>
    {rightIcon && <span className={s.icon}>{rightIcon}</span>}
  </button>
);
