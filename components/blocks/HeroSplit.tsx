import React from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { MergedDesign } from "@/lib/cms/design/designContract";
import {
  heroLayoutClassList,
  marketingContainerClassString,
  themeSectionModifierClasses,
} from "@/lib/cms/design/designContract";

function CmsLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
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

export type HeroSplitProps = {
  merged: MergedDesign;
  title: string;
  subtitle: string;
  imageSrc: string | null;
  imageAlt: string;
  useGradient: boolean;
  ctaLabel: string;
  ctaHref: string;
};

/**
 * Locked `hero_full` layout (stacked media + copy). System-owned; no author CSS.
 */
export function HeroSplit({
  merged,
  title,
  subtitle,
  imageSrc,
  imageAlt,
  useGradient,
  ctaLabel,
  ctaHref,
}: HeroSplitProps) {
  const heroLayoutMods = merged.heroLayout === "split" ? [] : heroLayoutClassList(merged.heroLayout);
  const themeExtra = themeSectionModifierClasses(merged.theme);
  const heroClassName = ["lp-hero", "relative", "isolate", "overflow-hidden", themeExtra, ...heroLayoutMods]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={heroClassName} aria-label="Toppseksjon">
      {imageSrc ?
        <div className="lp-hero-media" aria-hidden="true">
          <div className="lp-hero-frame lp-hero-frame-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- CMS URL kan være ekstern */}
            <img src={imageSrc} alt={imageAlt || ""} className="lp-hero-img" />
          </div>
          {useGradient ? <div className="lp-hero-overlay pointer-events-none" /> : null}
        </div>
      : <div className="lp-hero-media" aria-hidden="true">
          <div className="absolute inset-0 lp-surface-2" />
          {useGradient ? <div className="lp-hero-overlay pointer-events-none" /> : null}
        </div>
      }

      <div className={marketingContainerClassString(merged)}>
        <div className="lp-hero-content">
          <div className="lp-heroCopy mx-auto w-full max-w-3xl">
            {title ?
              <h1
                className={
                  merged.typography.heading === "display"
                    ? "font-display lp-display text-balance whitespace-pre-line"
                    : "lp-heroTitle text-balance whitespace-pre-line"
                }
              >
                {title}
              </h1>
            : null}
            {subtitle ?
              <p
                className={
                  merged.typography.body === "compact"
                    ? "font-body lp-p-sm mx-auto text-balance whitespace-pre-line"
                    : "font-body lp-heroLead mx-auto text-balance whitespace-pre-line"
                }
              >
                {subtitle}
              </p>
            : null}
            {ctaLabel ?
              <div className="lp-heroActions justify-center">
                <CmsLink href={ctaHref} className="lp-btn lp-btn-primary lp-neon">
                  {ctaLabel}
                </CmsLink>
              </div>
            : null}
          </div>
        </div>
      </div>
    </section>
  );
}
