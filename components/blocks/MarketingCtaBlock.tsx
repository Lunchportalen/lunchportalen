import React from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Section } from "@/components/ui/Section";
import { TextBlock } from "@/components/ui/TextBlock";
import type { MergedDesign } from "@/lib/cms/design/designContract";
import {
  marketingContainerClassString,
  marketingSectionClassString,
  mergedBodyClassString,
  mergedHeadingClassString,
} from "@/lib/cms/design/designContract";

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

export type MarketingCtaBlockProps = {
  merged: MergedDesign;
  eyebrow?: string;
  title: string;
  body: string;
  buttonLabel: string;
  buttonHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

/**
 * Locked conversion CTA (`cta`): centered column + primary action.
 */
export function MarketingCtaBlock({
  merged,
  eyebrow,
  title,
  body,
  buttonLabel,
  buttonHref,
  secondaryLabel,
  secondaryHref,
}: MarketingCtaBlockProps) {
  return (
    <Section
      sectionClassName={marketingSectionClassString(merged, { motion: true })}
      containerClassName={marketingContainerClassString(merged)}
    >
      <div className="lp-final-cta">
        <div className="min-w-0">
          {eyebrow ?
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
              {eyebrow}
            </p>
          : null}
          {title ?
            <h3 className={mergedHeadingClassString(merged, "h3")}>{title}</h3>
          : null}
          {body ?
            <TextBlock className={mergedBodyClassString(merged, { measure: true })}>{body}</TextBlock>
          : null}
        </div>
        <div className="lp-finalActions flex flex-wrap items-center justify-center gap-3">
          {buttonLabel ?
            <CmsInlineLink href={buttonHref} className="font-ui lp-btn lp-btn-primary lp-neon">
              {buttonLabel}
            </CmsInlineLink>
          : null}
          {secondaryLabel && secondaryHref ?
            <CmsInlineLink href={secondaryHref} className="font-ui lp-btn lp-btn-ghost">
              {secondaryLabel}
            </CmsInlineLink>
          : null}
        </div>
      </div>
    </Section>
  );
}
