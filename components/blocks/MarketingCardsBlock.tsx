import React from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Section } from "@/components/ui/Section";
import type { MergedDesign, ParsedDesignSettings } from "@/lib/cms/design/designContract";
import {
  cardSurfaceClassString,
  marketingContainerClassString,
  marketingSectionClassString,
  mergedBodyClassString,
  mergedHeadingClassString,
  resolvedCardForBlockType,
} from "@/lib/cms/design/designContract";

export type MarketingCardItem = {
  title: string;
  text: string;
  kicker?: string;
  linkLabel?: string;
  linkHref?: string;
};

export type MarketingCardsBlockProps = {
  merged: MergedDesign;
  designSettings: ParsedDesignSettings | null;
  title: string;
  intro: string;
  items: MarketingCardItem[];
  /** When true, shows a small system-owned “icon” ring with the first letter of the title. */
  featurePresentation?: boolean;
  ctas?: Array<{ href: string; label: string; ghost?: boolean }>;
};

function CmsInlineLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
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

/**
 * Locked cards grid (`cards` / feature grid).
 */
export function MarketingCardsBlock({
  merged,
  designSettings,
  title,
  intro,
  items,
  featurePresentation = false,
  ctas,
}: MarketingCardsBlockProps) {
  const ds = designSettings;
  return (
    <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
      <div className="lp-section-head">
        <h2 className={mergedHeadingClassString(merged, "h2")}>{title}</h2>
        {intro ? <p className={mergedBodyClassString(merged, { measure: true })}>{intro}</p> : null}
      </div>

      <div className="lp-cards3">
        {items.map((item, i) => (
          <div
            key={i}
            className={`${cardSurfaceClassString(resolvedCardForBlockType("cards", merged.card, ds))} h-full`}
          >
            {item.kicker?.trim() ?
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                {item.kicker.trim()}
              </p>
            : null}
            {featurePresentation && item.title ?
              <div className="mb-3 flex justify-center">
                <span className="lp-neon-ring inline-flex h-10 w-10 items-center justify-center text-sm font-semibold">
                  {item.title.trim().slice(0, 1).toUpperCase()}
                </span>
              </div>
            : null}
            <h3 className={mergedHeadingClassString(merged, "h3")}>{item.title}</h3>
            <p className={merged.typography.body === "compact" ? "lp-p-sm" : "lp-p"}>{item.text}</p>
            {item.linkLabel && item.linkHref ?
              <div className="mt-3">
                <CmsInlineLink href={item.linkHref} className="text-sm font-medium text-[rgb(var(--lp-text))] underline-offset-4 hover:underline">
                  {item.linkLabel}
                </CmsInlineLink>
              </div>
            : null}
          </div>
        ))}
      </div>

      {ctas && ctas.length > 0 ?
        <div className="lp-cta-row">
          {ctas.map((c, i) => (
            <CmsInlineLink
              key={i}
              href={c.href}
              className={`lp-btn ${c.ghost ? "lp-btn-ghost" : "lp-btn-primary lp-neon"}`}
            >
              {c.label}
            </CmsInlineLink>
          ))}
        </div>
      : null}
    </Section>
  );
}
