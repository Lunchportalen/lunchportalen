"use client";

import React, { useState } from "react";

/**
 * Renders a CMS image with fail-closed behavior: missing or broken URL shows
 * a placeholder instead of a broken image. Used by renderBlock for the image block
 * so preview and public share the same safe resolution behavior.
 */
export function SafeCmsImage({
  src,
  alt,
  className = "h-auto w-full rounded-lg object-cover",
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const effectiveSrc = typeof src === "string" && src.trim() ? src.trim() : null;
  const showPlaceholder = !effectiveSrc || failed;

  if (showPlaceholder) {
    return (
      <div className="flex h-40 items-center justify-center rounded-[var(--lp-radius-card)] bg-[rgb(var(--lp-surface-2))] text-xs text-[rgb(var(--lp-muted))]">
        Bilde
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- CMS image src can be external/dynamic
    <img
      src={effectiveSrc}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
