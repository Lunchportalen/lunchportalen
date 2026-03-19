import { iconSizes, radiusPx, cssVarNames } from "./globals";
import { fontRegistry, getFontFamily, getFontCssVar, typographyTokenClasses } from "./fontRegistry";
import { motionTokens, motionClasses } from "@/lib/ui/motionTokens";

export const colorVars = {
  surface: cssVarNames.surface,
  surfaceAlt: cssVarNames.surfaceAlt,
  card: cssVarNames.card,
  text: cssVarNames.text,
  muted: cssVarNames.muted,
  border: cssVarNames.border,
  ring: cssVarNames.ring,
  success: cssVarNames.success,
} as const;

export const radius = radiusPx;

export const icons = {
  sizes: iconSizes,
  classes: {
    sm: 'lp-icon-sm',
    md: 'lp-icon-md',
    lg: 'lp-icon-lg',
  },
} as const;

export const motion = {
  tokens: motionTokens,
  classes: motionClasses,
} as const;

export const primitives = {
  buttons: {
    description: 'Knappesystemet er bygget p� .lp-btn + varianter fra app/globals.css og components/ui/button.tsx.',
    baseClass: 'lp-btn',
    variants: ['lp-btn--primary', 'lp-btn--secondary', 'lp-btn--ghost', 'lp-btn--destructive'],
  },
  cards: {
    description: 'Kort og paneler bruker .lp-card + Card fra components/ui/card.tsx.',
    baseClass: 'lp-card',
    helpers: ['lp-card-head', 'lp-card-body', 'lp-card-content'],
  },
  nav: {
    description: 'Navigasjonspiller i hero/header bruker .lp-nav-item (globals.css).',
    baseClass: 'lp-nav-item',
  },
} as const;

export const fonts = {
  registry: fontRegistry,
  getFontFamily,
  getFontCssVar,
  /** Token class names for Tailwind/globals (font-body, font-heading, etc.). */
  typographyTokenClasses,
} as const;

export type DesignRegistry = {
  colorVars: typeof colorVars;
  radius: typeof radius;
  icons: typeof icons;
  motion: typeof motion;
  primitives: typeof primitives;
  fonts: typeof fonts;
};

export const designRegistry: DesignRegistry = {
  colorVars,
  radius,
  icons,
  motion,
  primitives,
  fonts,
};

