/**
 * LUNCHPORTALEN — Motion tokens (single source of truth for UI motion).
 * Use these in JS/TS when building class names or inline styles.
 * CSS counterpart: app/globals.css (--lp-duration-*, --lp-ease) and lib/ui/motion.css.
 */

export const motionTokens = {
  /** Fast micro-interactions (buttons, toggles): ~120ms */
  durationFast: "120ms",
  /** Normal hover/state: ~200ms */
  durationNormal: "200ms",
  /** Overlay enter/exit: ~220ms */
  durationEnter: "220ms",
  /** Easing: calm, premium (matches --lp-ease) */
  ease: "cubic-bezier(0.2, 0.8, 0.2, 1)",
} as const;

/** Class names for motion-aware components; pair with Tailwind where needed */
export const motionClasses = {
  /** Buttons: transform, opacity, box-shadow, background, border */
  button: "lp-motion-btn",
  /** Cards / panels / tiles: lift + shadow */
  card: "lp-motion-card",
  /** Modals / dialogs / drawers: enter opacity + transform */
  overlay: "lp-motion-overlay",
  /** Table / list / tree rows */
  row: "lp-motion-row",
  /** Form controls: input, select, textarea, checkbox (border/shadow/background/transform) */
  control: "lp-motion-control",
  /** Opacity-only (e.g. checkmark reveal); fast */
  opacity: "lp-motion-opacity",
  /** Switch track (use with switchThumb for full switch) */
  switch: "lp-motion-switch",
  /** Switch thumb (use with switch for full switch) */
  switchThumb: "lp-motion-switch-thumb",
  /** Icons: transform, opacity */
  icon: "lp-motion-icon",
  /** Hover: slight lift + smooth shadow increase */
  hoverSoft: "lp-motion-hover-soft",
  /** Hover: stronger elevation + subtle translate/scale */
  hoverLift: "lp-motion-hover-lift",
  /** Hover: soft glow emphasis */
  hoverGlow: "lp-motion-hover-glow",
  /** Press: tiny press-down feedback */
  press: "lp-motion-press",
  /** Focus: clear accessible focus-visible ring */
  focus: "lp-motion-focus",
  /** Fade: opacity transition for overlays */
  fade: "lp-motion-fade",
  /** Slide: transform transition (consumer sets translateY) */
  slideUp: "lp-motion-slide-up",
  /** Slide: transform transition (consumer sets translateY) */
  slideDown: "lp-motion-slide-down",
  /** Panel: modal/drawer enter */
  panel: "lp-motion-panel",
  /** Toast: short enter for toast/snackbar */
  toast: "lp-motion-toast",
  /** Skeleton: refined loading shimmer */
  skeleton: "lp-motion-skeleton",
  /** Success: subtle saved/completed flash (add class when success) */
  success: "lp-motion-success",
} as const;
