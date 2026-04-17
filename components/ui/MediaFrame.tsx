"use client";

import React from "react";
import { SafeCmsImage } from "@/lib/public/blocks/SafeCmsImage";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Locked aspect + radius for CMS imagery (standalone image block).
 * Uses SafeCmsImage for fail-closed loading and placeholder parity with preview/public.
 */
export default function MediaFrame({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  /** Merged onto outer wrapper (e.g. banner aspect). */
  className?: string;
}) {
  return (
    <div className={cn("aspect-[16/9] w-full overflow-hidden rounded-2xl", className)}>
      <SafeCmsImage src={src} alt={alt} className="h-full w-full rounded-none object-cover" />
    </div>
  );
}
