// components/ComputedDivider.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type Props = {
  /**
   * Hvilken CSS-variabel som skal leses fra :root (documentElement).
   * Kan være:
   *  - "--lp-divider" (eks: "rgba(255,255,255,0.12)")
   *  - "--lp-divider-rgb" (eks: "255, 255, 255") (da brukes alpha)
   */
  cssVar?: `--${string}`;

  /** Hvis cssVar er rgb (f.eks "255, 0, 127"), brukes denne alphaen */
  alpha?: number;

  /** px-høyde på divider */
  height?: number;

  /** ekstra className */
  className?: string;

  /** fallback hvis computed ikke gir verdi */
  fallback?: string;
};

function clamp01(n: number) {
  if (Number.isNaN(n)) return 1;
  return Math.max(0, Math.min(1, n));
}

export default function ComputedDivider({
  cssVar = "--lp-divider-rgb",
  alpha = 0.12,
  height = 1,
  className,
  fallback = "rgba(255,255,255,0.10)",
}: Props) {
  const [bg, setBg] = useState<string>(fallback);

  const a = useMemo(() => clamp01(alpha), [alpha]);

  useEffect(() => {
    try {
      const root = document.documentElement;
      const raw = getComputedStyle(root).getPropertyValue(cssVar).trim();

      if (!raw) {
        setBg(fallback);
        return;
      }

      // Hvis variabelen allerede er en full css-farge (rgba/hex/hsl/etc)
      // bruker vi den direkte.
      const looksLikeColor =
        raw.startsWith("rgb") ||
        raw.startsWith("#") ||
        raw.startsWith("hsl") ||
        raw.startsWith("color(") ||
        raw.startsWith("oklch") ||
        raw.startsWith("lab");

      if (looksLikeColor) {
        setBg(raw);
        return;
      }

      // Hvis variabelen er "r, g, b" (vanlig mønster)
      // så bygg rgba(..., alpha)
      // Eksempel: "--lp-neon-rgb: 255, 0, 127"
      const isRgbTriplet = /^[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}$/.test(raw);
      if (isRgbTriplet) {
        setBg(`rgba(${raw}, ${a})`);
        return;
      }

      // Ukjent format -> fallback
      setBg(fallback);
    } catch {
      setBg(fallback);
    }
  }, [cssVar, a, fallback]);

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{ height, width: "100%", background: bg }}
    />
  );
}
