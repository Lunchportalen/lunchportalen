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
        "glass-sm": "var(--lp-glass-shadow-sm)",
        "glass-md": "var(--lp-glass-shadow-md)",
      },
      borderRadius: {
        card: "var(--lp-radius-card)",
      },
      spacing: {
        card: "1.5rem",
      },
    },
  },
  plugins: [],
};
