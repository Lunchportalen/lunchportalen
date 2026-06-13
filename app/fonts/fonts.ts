import localFont from "next/font/local";

/** Self-hosted premium fonts (no next/font/google — deterministic CI/build). */
export const fontBody = localFont({
  src: "./manrope-latin-wght-normal.woff2",
  variable: "--lp-font-body",
  display: "swap",
});

export const fontDisplay = localFont({
  src: "./fraunces-latin-wght-normal.woff2",
  variable: "--lp-font-display",
  display: "swap",
});

export const fontHeading = localFont({
  src: [
    { path: "./inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--lp-font-heading",
  display: "swap",
});
