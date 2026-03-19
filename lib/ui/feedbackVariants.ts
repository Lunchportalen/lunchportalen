/**
 * LUNCHPORTALEN — Toast and alert visual variants (primitives from lib/ui/motion.css).
 * Toast wired to ToastProvider (components/ui/toast.tsx). Alerts: getAlertVariantClass() or class-based.
 * Pair semantic kind (success/error/warning/info) with variant; use lp-motion-toast for toasts.
 */

export type FeedbackVariant = "glass" | "soft" | "gradient" | "outline" | "glow";

export type FeedbackKind = "success" | "error" | "warning" | "info" | "default";

/** Map variant to lp-toast-* class */
export const toastVariantClasses: Record<FeedbackVariant, string> = {
  glass: "lp-toast-glass",
  soft: "lp-toast-soft",
  gradient: "lp-toast-gradient",
  outline: "lp-toast-outline",
  glow: "lp-toast-glow",
};

/** Map variant to lp-alert-* class */
export const alertVariantClasses: Record<FeedbackVariant, string> = {
  glass: "lp-alert-glass",
  soft: "lp-alert-soft",
  gradient: "lp-alert-gradient",
  outline: "lp-alert-outline",
  glow: "lp-alert-glow",
};

/** Semantic accent for toast (left border; combine with lp-toast-*) */
export const toastSemanticClasses: Record<Exclude<FeedbackKind, "default">, string> = {
  success: "lp-toast--success",
  error: "lp-toast--error",
  warning: "lp-toast--warning",
  info: "lp-toast--info",
};

/** Semantic accent for alert (left border; combine with lp-alert-*) */
export const alertSemanticClasses: Record<Exclude<FeedbackKind, "default">, string> = {
  success: "lp-alert--success",
  error: "lp-alert--error",
  warning: "lp-alert--warning",
  info: "lp-alert--info",
};

export function getToastVariantClass(variant: FeedbackVariant | undefined): string {
  return variant ? toastVariantClasses[variant] : toastVariantClasses.soft;
}

export function getAlertVariantClass(variant: FeedbackVariant | undefined): string {
  return variant ? alertVariantClasses[variant] : alertVariantClasses.soft;
}

export function getToastSemanticClass(kind: FeedbackKind): string {
  return kind === "default" ? "" : toastSemanticClasses[kind];
}

export function getAlertSemanticClass(kind: FeedbackKind): string {
  return kind === "default" ? "" : alertSemanticClasses[kind];
}
