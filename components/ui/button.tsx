"use client";

import * as React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "default";

type ButtonSize = "default" | "sm" | "lg" | "icon";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

const BASE = "lp-btn";

const SIZE: Record<ButtonSize, string> = {
  default: "",
  sm: "lp-btn--sm",
  lg: "lp-btn--lg",
  icon: "lp-btn--icon",
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: "lp-btn--primary",
  secondary: "lp-btn--secondary",
  ghost: "lp-btn--ghost",
  destructive: "lp-btn--destructive",
  default: "lp-btn--primary",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "default", asChild = false, type, children, ...props },
  ref
) {
  const classes = cn(BASE, SIZE[size], VARIANT[variant], className);

  if (asChild) {
    const child = React.Children.only(children) as React.ReactElement<any>;
    return React.cloneElement(child, {
      className: cn(child.props?.className, classes),
      ...props,
    });
  }

  return (
    <button ref={ref} type={type ?? "button"} className={classes} {...props}>
      {children}
    </button>
  );
});
