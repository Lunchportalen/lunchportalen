"use client";

import React, { useMemo } from "react";
import Link from "next/link";

import { Section } from "@/components/ui/Section";
import type { MergedDesign } from "@/lib/cms/design/designContract";
import {
  marketingContainerClassString,
  marketingSectionClassString,
  mergedHeadingClassString,
} from "@/lib/cms/design/designContract";

export type AnchorNavLink = {
  id: string;
  label: string;
  href: string;
};

export type AnchorNavigationBlockProps = {
  merged: MergedDesign;
  title: string;
  links: AnchorNavLink[];
  /** Umbraco `linkStyle` e.g. `pills` | `text`. */
  linkStyle: string;
  /** Umbraco `navigationAlignment` e.g. `center` | `start`. */
  navigationAlignment: string;
  /** Umbraco `mobileStyle` e.g. `horizontal-scroll`. */
  mobileStyle: string;
};

function parseLinksJson(raw: unknown): AnchorNavLink[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row, idx) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `toc-${idx}`;
        return {
          id,
          label: typeof o.label === "string" ? o.label : "",
          href: typeof o.href === "string" ? o.href : "",
        };
      })
      .filter((x): x is AnchorNavLink => x != null);
  } catch {
    return [];
  }
}

export function linksFromAnchorNavigationData(data: Record<string, unknown>): AnchorNavLink[] {
  if (Array.isArray(data.links)) {
    const raw = data.links as unknown[];
    return raw
      .map((row, idx) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `toc-${idx}`;
        return {
          id,
          label: typeof o.label === "string" ? o.label : "",
          href: typeof o.href === "string" ? o.href : "",
        };
      })
      .filter((x): x is AnchorNavLink => x != null);
  }
  return parseLinksJson(data.itemsJson);
}

function cn(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ");
}

function NavLink({ item, pill }: { item: AnchorNavLink; pill: boolean }) {
  const label = item.label.trim();
  const href = item.href.trim();
  if (!label || !href) return null;

  const base = cn(
    "inline-flex min-h-[44px] max-w-full shrink-0 items-center justify-center text-sm font-medium transition",
    pill ?
      "rounded-full border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-card))]/80 px-4 text-[rgb(var(--lp-text))] hover:border-pink-500/50"
    : "border-b-2 border-transparent px-2 text-[rgb(var(--lp-text))] underline-offset-4 hover:border-pink-500/40 hover:underline",
  );

  const isHash = href.startsWith("#") && !href.startsWith("#/");
  const internal = href.startsWith("/") && !href.startsWith("//");

  if (internal) {
    return (
      <Link href={href} className={base}>
        {label}
      </Link>
    );
  }
  return (
    <a href={href} className={base} {...(isHash ? {} : { rel: "noopener noreferrer" })}>
      {label}
    </a>
  );
}

/**
 * Table-of-contents / in-page anchor strip (Umbraco `anchorNavigation`).
 * Distinct from `related_links` (related pages) and `rich_text`.
 */
export function AnchorNavigationBlock({
  merged,
  title,
  links,
  linkStyle,
  navigationAlignment,
  mobileStyle,
}: AnchorNavigationBlockProps) {
  const list = useMemo(() => links.filter((l) => l.label.trim() && l.href.trim()), [links]);
  const pill = String(linkStyle ?? "").toLowerCase() !== "text";
  const align = String(navigationAlignment ?? "").toLowerCase();
  const justify =
    align === "start" ? "justify-start"
    : align === "end" ? "justify-end"
    : "justify-center";
  /** Umbraco `horizontal-scroll` is deferred: production mobile law forbids horizontal page scroll (S1). */
  void mobileStyle;

  if (list.length === 0) return null;

  const heading = title.trim();

  return (
    <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
      <nav className="w-full" aria-label={heading || "Innholdsfortegnelse"}>
        {heading ?
          <h2 className={cn(mergedHeadingClassString(merged, "h2"), "mb-4 text-center")}>{heading}</h2>
        : null}
        <div className={cn("flex w-full flex-wrap gap-2", justify)}>
          {list.map((item) => (
            <NavLink key={item.id} item={item} pill={pill} />
          ))}
        </div>
      </nav>
    </Section>
  );
}
