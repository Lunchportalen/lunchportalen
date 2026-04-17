"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import MediaFrame from "@/components/ui/MediaFrame";
import { TextBlock } from "@/components/blocks/TextBlock";

function normalizeDisplayText(s: string): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

export type BannerBlockProps = {
  text: string;
  ctaLabel: string;
  ctaHref: string;
  /** Resolved display URL (cms:* / path / https) */
  backgroundSrc: string | null;
  sectionClassName: string;
  containerClassName: string;
  textClassName: string;
};

const BANNER_H = "h-[240px] min-h-[240px]";

/**
 * Umbraco-style banner: fixed height, centered copy, optional CTA. Layout is system-owned (no alignment variants).
 */
export function BannerBlock({
  text,
  ctaLabel,
  ctaHref,
  backgroundSrc,
  sectionClassName,
  containerClassName,
  textClassName,
}: BannerBlockProps) {
  const copy = normalizeDisplayText(text);
  const label = normalizeDisplayText(ctaLabel);
  const href = typeof ctaHref === "string" ? ctaHref.trim() : "";

  const ctaClasses = "lp-neon font-ui min-h-[44px] px-5";

  return (
    <section className={sectionClassName} aria-label="Banner">
      <div className={containerClassName}>
        <div className={`relative isolate w-full overflow-hidden rounded-2xl ${BANNER_H}`}>
          <div className="absolute inset-0 z-0">
            <MediaFrame
              src={backgroundSrc}
              alt=""
              className={`${BANNER_H} w-full rounded-none object-cover`}
            />
          </div>
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/70 via-black/45 to-black/35"
            aria-hidden
          />
          <div
            className={`relative z-[2] flex ${BANNER_H} w-full flex-col items-center justify-center gap-4 px-6 text-center sm:px-10`}
          >
            {copy ?
              <TextBlock className={`${textClassName} max-w-3xl text-balance text-white drop-shadow-sm`}>
                {copy}
              </TextBlock>
            : null}
            {label ?
              href ?
                href.startsWith("/") && !href.startsWith("//") ?
                  <Button variant="primary" className={ctaClasses} asChild>
                    <Link href={href}>{label}</Link>
                  </Button>
                : <Button variant="primary" className={ctaClasses} asChild>
                    <a href={href}>{label}</a>
                  </Button>
              : <span
                  className={`font-ui inline-flex items-center justify-center rounded-md border border-white/25 bg-white/10 px-5 ${ctaClasses} text-white`}
                >
                  {label}
                </span>
            : null}
          </div>
        </div>
      </div>
    </section>
  );
}
