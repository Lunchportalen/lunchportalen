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

/**
 * IMPORTANT:
 * - Put "lp-btn--*" first (shape/tokens from globals.css)
 * - Add explicit hover text/bg utilities here to prevent white-on-white
 * - Keep these utilities LAST (so they win vs accidental className overrides)
 */
const VARIANT: Record<ButtonVariant, string> = {
  primary: cn(
    "lp-btn--primary",
    // base
    "bg-[rgb(var(--lp-text))] text-white",
    // hover (always readable)
    "hover:bg-[rgb(var(--lp-surface))] hover:text-[rgb(var(--lp-text))]",
    // focus ring (keeps your token)
    "focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_rgba(var(--lp-ring),0.22)]"
  ),

  secondary: cn(
    "lp-btn--secondary",
    "bg-[rgb(var(--lp-surface-alt))] text-[rgb(var(--lp-text))]",
    "hover:bg-[rgb(var(--lp-surface))] hover:text-[rgb(var(--lp-text))]",
    "focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_rgba(var(--lp-ring),0.22)]"
  ),

  ghost: cn(
    "lp-btn--ghost",
    "bg-transparent text-[rgb(var(--lp-text))]",
    "hover:bg-[rgba(var(--lp-border),0.35)] hover:text-[rgb(var(--lp-text))]",
    "focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_rgba(var(--lp-ring),0.22)]"
  ),

  destructive: cn(
    "lp-btn--destructive",
    "bg-[rgb(var(--lp-danger))] text-white",
    "hover:bg-[rgb(var(--lp-surface))] hover:text-[rgb(var(--lp-danger))] hover:border-[rgba(var(--lp-danger),0.6)]",
    "focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_rgba(var(--lp-ring),0.22)]"
  ),

  default: cn(
    "lp-btn--primary",
    "bg-[rgb(var(--lp-text))] text-white",
    "hover:bg-[rgb(var(--lp-surface))] hover:text-[rgb(var(--lp-text))]",
    "focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_rgba(var(--lp-ring),0.22)]"
  ),
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
  // Safety class: never allow text to disappear on hover due to accidental overrides
  // (If someone adds hover:bg-white + text-white, our variant hover:text wins.)
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
