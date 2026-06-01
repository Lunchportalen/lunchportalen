/** @type {import("tailwindcss").Config} */
/** Shared fallback stack for typography tokens (matches lib/design/fontRegistry + globals.css). */
const fontFallback = [
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "Helvetica Neue",
  "Arial",
  "Noto Sans",
  "sans-serif",
];

module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /* Typography tokens — semantic roles (premium font registry). Use font-body, font-heading, etc. */
      fontFamily: {
        body: ["var(--lp-font-body)", ...fontFallback],
        heading: ["var(--lp-font-heading)", ...fontFallback],
        display: ["var(--lp-font-display)", ...fontFallback],
        editorial: ["var(--lp-font-display)", ...fontFallback],
        campaign: ["var(--lp-font-display)", ...fontFallback],
        accent: ["var(--lp-font-heading)", ...fontFallback],
        ui: ["var(--lp-font-body)", ...fontFallback],
      },
      fontSize: {
        "ds-h1": ["var(--ds-h1)", { lineHeight: "1.04", letterSpacing: "-0.05em" }],
        "ds-h2": ["var(--ds-h2)", { lineHeight: "1.08", letterSpacing: "-0.04em" }],
        "ds-h3": ["var(--ds-h3)", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        "ds-body-lg": ["var(--ds-body-lg)", { lineHeight: "1.55" }],
        "ds-body": ["var(--ds-body)", { lineHeight: "1.55" }],
        "ds-body-sm": ["var(--ds-body-sm)", { lineHeight: "1.5" }],
      },
      colors: {
        bg: "var(--ds-bg)",
        "bg-soft": "var(--ds-bg-soft)",
        "bg-dark": "var(--ds-bg-dark)",
        surface: "var(--ds-surface)",
        text: "var(--ds-text)",
        "text-soft": "var(--ds-text-soft)",
        "text-inverse": "var(--ds-text-inverse)",
        line: "var(--ds-line)",
        "line-strong": "var(--ds-line-strong)",
        brand: "var(--ds-brand)",
        "brand-hover": "var(--ds-brand-hover)",
        accent: {
          DEFAULT: "var(--ds-accent)",
          hover: "var(--ds-accent-hover)",
          soft: "var(--ds-accent-soft)",
          wash: "var(--ds-accent-wash)",
          "wash-strong": "var(--ds-accent-wash-strong)",
          "gradient-end": "var(--ds-accent-gradient-end)",
        },
        "warm-dark": "var(--ds-warm-dark)",
        green: "var(--ds-green)",
      },
      /* Normalized blur: cards=sm, panels=md, overlays=lg (subtle premium) */
      backdropBlur: {
        sm: "4px",
        md: "8px",
        lg: "12px",
      },
      /* Glass opacity tokens (match motion.css) */
      backgroundColor: {
        "glass-light": "var(--lp-glass-light)",
        "glass-medium": "var(--lp-glass-medium)",
        "glass-strong": "var(--lp-glass-strong)",
      },
      borderColor: {
        "glass-highlight": "var(--lp-glass-highlight)",
      },
      boxShadow: {
        soft: "var(--ds-shadow-soft)",
        card: "var(--ds-shadow-card)",
        "card-hover": "var(--ds-shadow-card-hover)",
        accent: "var(--ds-shadow-accent)",
        "accent-sm": "var(--ds-shadow-accent-sm)",
        secondary: "var(--ds-shadow-secondary)",
        "glass-sm": "var(--lp-glass-shadow-sm)",
        "glass-md": "var(--lp-glass-shadow-md)",
      },
      borderRadius: {
        card: "var(--lp-radius-card)",
        sm: "var(--ds-radius-sm)",
        md: "var(--ds-radius-md)",
        lg: "var(--ds-radius-lg)",
        pill: "var(--ds-radius-pill)",
      },
      spacing: {
        card: "1.5rem",
        touch: "3rem",
        cta: "3.375rem",
        day: "3.625rem",
        "calendar-pill": "3.25rem",
        chip: "2rem",
        action: "3.125rem",
      },
      maxWidth: {
        ds: "var(--ds-max)",
        "ds-text": "var(--ds-text-max)",
        "week-mobile": "var(--ds-week-mobile-max)",
        "week-admin": "var(--ds-week-admin-max)",
      },
      zIndex: {
        modal: "60",
      },
      keyframes: {
        lpShimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        lpShimmer: "lpShimmer 1.35s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
