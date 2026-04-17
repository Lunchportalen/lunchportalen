"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import MediaFrame from "@/components/ui/MediaFrame";
import { TextBlock } from "@/components/blocks/TextBlock";
import type { MergedDesign } from "@/lib/cms/design/designContract";
import {
  marketingContainerClassString,
  marketingSectionClassString,
} from "@/lib/cms/design/designContract";

export type BannerCarouselSlide = {
  id: string;
  title: string;
  subtitle: string;
  buttonText: string;
  link: string;
  image: string;
};

export type BannerCarouselBlockProps = {
  merged: MergedDesign;
  slides: BannerCarouselSlide[];
  /** When true, all slides stack vertically (Umbraco `disableCarousel`). */
  disableCarousel: boolean;
  showArrows: boolean;
  showDots: boolean;
  /** Milliseconds between auto-advance; 0 = off. */
  autoRotateMs: number;
  /** Shuffle order once on mount (Umbraco `enableRandomOrder`). */
  shuffleOnLoad: boolean;
};

const BANNER_H = "h-[240px] min-h-[240px]";

function normalizeCopy(s: string): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function parseSlidesJson(raw: unknown): BannerCarouselSlide[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row, idx) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `slide-${idx}`;
        const title = typeof o.title === "string" ? o.title : "";
        const subtitle = typeof o.subtitle === "string" ? o.subtitle : "";
        const buttonText = typeof o.buttonText === "string" ? o.buttonText : "";
        const link = typeof o.link === "string" ? o.link : "";
        const image =
          (typeof o.image === "string" && o.image.trim()) ||
          (typeof o.src === "string" && o.src.trim()) ||
          "";
        return { id, title, subtitle, buttonText, link, image };
      })
      .filter((x): x is BannerCarouselSlide => x != null);
  } catch {
    return [];
  }
}

function shuffleSlides(slides: BannerCarouselSlide[]): BannerCarouselSlide[] {
  const out = [...slides];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Multi-slide marketing carousel aligned with Umbraco `banners` / `bannerItem` (single-strip `banner` remains separate).
 */
export function BannerCarouselBlock({
  merged,
  slides: slidesIn,
  disableCarousel,
  showArrows,
  showDots,
  autoRotateMs,
  shuffleOnLoad,
}: BannerCarouselBlockProps) {
  const initialSlides = useMemo(() => {
    let s = slidesIn.filter((x) => x.title || x.subtitle || x.buttonText || x.image);
    if (shuffleOnLoad && s.length > 1) s = shuffleSlides(s);
    return s;
  }, [slidesIn, shuffleOnLoad]);

  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  indexRef.current = index;

  const n = initialSlides.length;
  const go = useCallback(
    (dir: -1 | 1) => {
      if (n <= 1) return;
      setIndex((i) => (i + dir + n) % n);
    },
    [n],
  );

  useEffect(() => {
    if (disableCarousel || n <= 1) return;
    const ms = autoRotateMs > 0 ? autoRotateMs : 0;
    if (ms <= 0 || prefersReducedMotion()) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % n);
    }, ms);
    return () => window.clearInterval(t);
  }, [autoRotateMs, disableCarousel, n]);

  if (n === 0) return null;

  if (disableCarousel) {
    return (
      <section className={marketingSectionClassString(merged, { motion: true })} aria-label="Banner">
        <div className={`${marketingContainerClassString(merged)} flex flex-col gap-6`}>
          {initialSlides.map((slide) => (
            <SingleSlide key={slide.id} slide={slide} />
          ))}
        </div>
      </section>
    );
  }

  const slide = initialSlides[index] ?? initialSlides[0]!;

  return (
    <section className={marketingSectionClassString(merged, { motion: true })} aria-label="Bannerkarusell">
      <div className={marketingContainerClassString(merged)}>
        <div className="relative w-full">
          {n > 1 && showArrows ?
            <>
              <button
                type="button"
                className="absolute left-2 top-1/2 z-[4] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white backdrop-blur-sm min-h-[44px] min-w-[44px]"
                aria-label="Forrige slide"
                onClick={() => go(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="absolute right-2 top-1/2 z-[4] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white backdrop-blur-sm min-h-[44px] min-w-[44px]"
                aria-label="Neste slide"
                onClick={() => go(1)}
              >
                ›
              </button>
            </>
          : null}

          <SingleSlide slide={slide} />

          {n > 1 && showDots ?
            <div
              className="mt-3 flex flex-wrap items-center justify-center gap-2"
              role="tablist"
              aria-label="Velg slide"
            >
              {initialSlides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-2.5 min-h-[10px] min-w-[10px] rounded-full px-2 transition ${
                    i === index ? "bg-pink-500" : "bg-[rgb(var(--lp-muted))]/40"
                  }`}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
          : null}
        </div>
      </div>
    </section>
  );
}

function SingleSlide({ slide }: { slide: BannerCarouselSlide }) {
  const copy = [normalizeCopy(slide.title), normalizeCopy(slide.subtitle)].filter(Boolean).join(" — ");
  const label = normalizeCopy(slide.buttonText);
  const href = typeof slide.link === "string" ? slide.link.trim() : "";
  const bg = slide.image?.trim() || null;
  const ctaClasses = "lp-neon font-ui min-h-[44px] px-5";

  return (
    <div className={`relative isolate w-full overflow-hidden rounded-2xl ${BANNER_H}`}>
      <div className="absolute inset-0 z-0">
        <MediaFrame
          src={bg}
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
          <TextBlock className="font-display max-w-3xl text-balance text-xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-2xl md:text-3xl">
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
  );
}

/** Resolve slides from flat render data (`slides` from Umbraco adapter or `slidesJson`). */
export function slidesFromBannerCarouselData(data: Record<string, unknown>): BannerCarouselSlide[] {
  if (Array.isArray(data.slides)) {
    const raw = data.slides as unknown[];
    return raw
      .map((row, idx) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `slide-${idx}`;
        return {
          id,
          title: typeof o.title === "string" ? o.title : "",
          subtitle: typeof o.subtitle === "string" ? o.subtitle : "",
          buttonText: typeof o.buttonText === "string" ? o.buttonText : "",
          link: typeof o.link === "string" ? o.link : "",
          image:
            (typeof o.image === "string" && o.image.trim()) ||
            (typeof o.src === "string" && o.src.trim()) ||
            "",
        };
      })
      .filter((x): x is BannerCarouselSlide => x != null);
  }
  return parseSlidesJson(data.slidesJson);
}
