"use client";

import Link from "next/link";
import React, { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";

import { contentEditablePlaceholderHeroCx } from "@/lib/cms/inlineEditCx";

function normalizeDisplayText(s: string): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function blurCommitText(raw: string): string {
  return normalizeDisplayText(raw.replace(/\u00a0/g, " ").trim());
}

export type HeroBleedAlign = "left" | "center" | "right";

/** Backoffice live preview: inline edit on canvas (blur → patch). Public pages omit this. */
export type HeroVisualCanvasEdit = {
  onPatch: (patch: Record<string, unknown>) => void;
};

export type HeroBlockProps = {
  /** Stable id for H1 + aria-labelledby (unique per block instance). */
  headingDomId?: string;
  title: string;
  subtitle?: string;
  ctaPrimary?: string;
  ctaPrimaryHref?: string;
  ctaSecondary?: string;
  ctaSecondaryHref?: string;
  /** Resolved background image URL (or empty for solid fallback). */
  backgroundImage: string;
  textAlign: HeroBleedAlign;
  textPosition: HeroBleedAlign;
  overlayImage?: string;
  overlayPosition?: HeroBleedAlign;
  overlayImageAlt?: string;
  visualCanvasEdit?: HeroVisualCanvasEdit | null;
};

function CtaLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  const h = typeof href === "string" ? href.trim() : "";
  if (!h || h === "#") {
    return <span className={className}>{children}</span>;
  }
  const internal = h.startsWith("/") && !h.startsWith("//");
  if (internal) {
    return (
      <Link href={h} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={h} className={className}>
      {children}
    </a>
  );
}

function parseAlign(v: unknown, fallback: HeroBleedAlign): HeroBleedAlign {
  const s = String(v ?? "").toLowerCase();
  if (s === "left" || s === "right" || s === "center") return s;
  return fallback;
}

const justifyMap: Record<HeroBleedAlign, string> = {
  left: "md:justify-start",
  center: "md:justify-center",
  right: "md:justify-end",
};

const textMap: Record<HeroBleedAlign, string> = {
  left: "md:text-left",
  center: "md:text-center",
  right: "md:text-right",
};

const ctaJustifyMap: Record<HeroBleedAlign, string> = {
  left: "md:justify-start",
  center: "md:justify-center",
  right: "md:justify-end",
};

function overlayPositionClasses(pos: HeroBleedAlign): string {
  if (pos === "left") return "left-4 md:left-10";
  if (pos === "right") return "right-4 md:right-10";
  return "left-1/2 -translate-x-1/2";
}

function placeCaretAtEnd(el: HTMLElement) {
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    /* ignore */
  }
}

function CanvasEditableSpan({
  className,
  value,
  onCommit,
  ariaLabel,
  placeholder,
}: {
  className: string;
  value: string;
  onCommit: (v: string) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== value) el.textContent = value;
  }, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== value) el.textContent = value;
  }, [value]);
  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={ariaLabel}
      data-placeholder={placeholder || undefined}
      className={`${className} inline-block min-w-[2ch] outline-none transition-[opacity,transform] duration-150 focus-visible:ring-2 focus-visible:ring-pink-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${contentEditablePlaceholderHeroCx}`}
      onFocus={(e) => placeCaretAtEnd(e.currentTarget)}
      onBlur={() => onCommit(blurCommitText(ref.current?.textContent ?? ""))}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    />
  );
}

/**
 * Full-bleed marketing hero: edge-to-edge background, CMS-controlled text and overlay asset.
 * Mobile: copy and CTAs are centered; overlay image is hidden below md breakpoint.
 */
export function HeroBlock(raw: HeroBlockProps) {
  const headingId = raw.headingDomId?.trim() || "hero-bleed-title";
  const title = normalizeDisplayText(String(raw.title ?? ""));
  const subtitle =
    raw.subtitle !== undefined && raw.subtitle !== null ? normalizeDisplayText(String(raw.subtitle)) : "";
  const ctaPrimary = raw.ctaPrimary ? normalizeDisplayText(String(raw.ctaPrimary)) : "";
  const ctaSecondary = raw.ctaSecondary ? normalizeDisplayText(String(raw.ctaSecondary)) : "";
  const ctaPrimaryHref = typeof raw.ctaPrimaryHref === "string" ? raw.ctaPrimaryHref : "";
  const ctaSecondaryHref = typeof raw.ctaSecondaryHref === "string" ? raw.ctaSecondaryHref : "";
  const bg = typeof raw.backgroundImage === "string" ? raw.backgroundImage.trim() : "";
  const textAlign = parseAlign(raw.textAlign, "center");
  const textPosition = parseAlign(raw.textPosition, "center");
  const overlayPos = parseAlign(raw.overlayPosition, "right");
  const overlaySrc = typeof raw.overlayImage === "string" ? raw.overlayImage.trim() : "";
  const overlayAlt = normalizeDisplayText(String(raw.overlayImageAlt ?? ""));
  const vce = raw.visualCanvasEdit ?? null;

  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    if (!vce) return;
    const el = titleRef.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== title) el.textContent = title;
  }, [title, vce]);

  useEffect(() => {
    if (!vce) return;
    const el = titleRef.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== title) el.textContent = title;
  }, [title, vce]);

  useLayoutEffect(() => {
    if (!vce) return;
    const el = subtitleRef.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== subtitle) el.textContent = subtitle;
  }, [subtitle, vce]);

  useEffect(() => {
    if (!vce) return;
    const el = subtitleRef.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== subtitle) el.textContent = subtitle;
  }, [subtitle, vce]);

  const bgStyle =
    bg ?
      ({
        backgroundImage: `url(${bg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } as const)
    : undefined;

  const titleClasses =
    "font-display text-balance text-3xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-4xl md:text-5xl whitespace-pre-line";
  const subtitleClasses =
    "font-body mt-3 text-base leading-relaxed text-white/90 sm:text-lg whitespace-pre-line";

  const showCtaRow = Boolean(vce || ctaPrimary || ctaSecondary);

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen max-w-[100vw]">
      <section
        className="relative isolate overflow-clip"
        {...(title || vce ? { "aria-labelledby": headingId } : { "aria-label": "Toppseksjon" })}
      >
        <div
          className={`relative flex min-h-[320px] w-full items-center md:min-h-[520px] ${bg ? "" : "bg-zinc-900"}`}
          style={bgStyle}
        >
          <div className="pointer-events-none absolute inset-0 bg-black/50" aria-hidden />

          {overlaySrc ? (
            <div
              className={`pointer-events-none absolute bottom-0 z-[5] hidden md:block ${overlayPositionClasses(overlayPos)}`}
              aria-hidden
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- CMS URL kan være ekstern */}
              <img
                src={overlaySrc}
                alt={overlayAlt || ""}
                className="max-h-[280px] w-[min(100vw-2rem,320px)] rounded-2xl object-contain shadow-2xl sm:w-[320px]"
                decoding="async"
                loading="lazy"
              />
            </div>
          ) : null}

          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
            <div className={`flex w-full justify-center ${justifyMap[textPosition]}`}>
              <div className={`w-full max-w-xl text-center ${textMap[textAlign]}`}>
                {vce ?
                  <h1
                    ref={titleRef}
                    id={headingId}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label="Tittel"
                    data-placeholder="Skriv tittel …"
                    className={`${titleClasses} min-h-[1.25em] outline-none transition-[opacity,transform] duration-150 focus-visible:ring-2 focus-visible:ring-pink-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20 ${contentEditablePlaceholderHeroCx}`}
                    onFocus={(e) => placeCaretAtEnd(e.currentTarget)}
                    onBlur={() => vce.onPatch({ title: blurCommitText(titleRef.current?.textContent ?? "") })}
                  />
                : title ?
                  <h1
                    id={headingId}
                    className={titleClasses}
                  >
                    {title}
                  </h1>
                : null}

                {vce ?
                  <p
                    ref={subtitleRef}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label="Undertittel"
                    data-placeholder="Kort undertittel …"
                    className={`${subtitleClasses} min-h-[1.25em] outline-none transition-[opacity,transform] duration-150 focus-visible:ring-2 focus-visible:ring-pink-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20 ${contentEditablePlaceholderHeroCx}`}
                    onFocus={(e) => placeCaretAtEnd(e.currentTarget)}
                    onBlur={() => vce.onPatch({ subtitle: blurCommitText(subtitleRef.current?.textContent ?? "") })}
                  />
                : subtitle ?
                  <p className={subtitleClasses}>{subtitle}</p>
                : null}

                {showCtaRow ?
                  <div className={`mt-6 flex flex-wrap justify-center gap-3 ${ctaJustifyMap[textAlign]}`}>
                    {vce || ctaPrimary ?
                      <CtaLink
                        href={ctaPrimaryHref}
                        className="font-ui lp-btn lp-btn-primary lp-neon inline-flex min-h-[44px] items-center justify-center px-5"
                      >
                        {vce ?
                          <CanvasEditableSpan
                            className="font-ui font-semibold"
                            value={ctaPrimary}
                            ariaLabel="Primærknappetekst"
                            placeholder="Knappetekst"
                            onCommit={(t) => vce.onPatch({ ctaPrimary: t })}
                          />
                        : ctaPrimary}
                      </CtaLink>
                    : null}
                    {vce || ctaSecondary ?
                      <CtaLink
                        href={ctaSecondaryHref}
                        className="font-ui lp-btn lp-btn-ghost inline-flex min-h-[44px] items-center justify-center border border-white/40 bg-white/10 px-5 text-white hover:bg-white/15"
                      >
                        {vce ?
                          <CanvasEditableSpan
                            className="font-ui font-semibold text-white"
                            value={ctaSecondary}
                            ariaLabel="Sekundærknappetekst"
                            placeholder="Valgfri knapp"
                            onCommit={(t) => vce.onPatch({ ctaSecondary: t })}
                          />
                        : ctaSecondary}
                      </CtaLink>
                    : null}
                  </div>
                : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
