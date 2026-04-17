"use client";

import React, { useMemo } from "react";
import Link from "next/link";

import MediaFrame from "@/components/ui/MediaFrame";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/cms/Button";
import type { MergedDesign, ParsedDesignSettings } from "@/lib/cms/design/designContract";
import {
  cardSurfaceClassString,
  marketingContainerClassString,
  marketingSectionClassString,
  mergedBodyClassString,
  mergedHeadingClassString,
  resolvedCardForBlockType,
} from "@/lib/cms/design/designContract";
import { normalizeDisplayText } from "@/lib/cms/displayText";
import { safeAltForImg } from "@/lib/media/renderSafe";

function cn(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ");
}

export type DualPromoCard = {
  id: string;
  image: string;
  imageAlt: string;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
};

export type DualPromoCardsBlockProps = {
  merged: MergedDesign;
  designSettings: ParsedDesignSettings | null;
  sectionId: string;
  cards: DualPromoCard[];
};

function readImage(row: Record<string, unknown>): string {
  const v =
    (typeof row.image === "string" && row.image.trim() && row.image) ||
    (typeof row.src === "string" && row.src.trim() && row.src) ||
    (typeof row.imageUrl === "string" && row.imageUrl.trim() && row.imageUrl) ||
    "";
  return typeof v === "string" ? v.trim() : "";
}

function parseCardsJson(raw: unknown): DualPromoCard[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row, idx) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `promo-${idx}`;
        return {
          id,
          image: readImage(o),
          imageAlt: typeof o.imageAlt === "string" ? o.imageAlt : "",
          eyebrow: typeof o.eyebrow === "string" ? o.eyebrow : "",
          title: typeof o.title === "string" ? o.title : "",
          description: typeof o.description === "string" ? o.description : "",
          ctaLabel: typeof o.ctaLabel === "string" ? o.ctaLabel : "",
          ctaUrl: typeof o.ctaUrl === "string" ? o.ctaUrl : "",
        };
      })
      .filter((x): x is DualPromoCard => x != null);
  } catch {
    return [];
  }
}

/** Build structured cards from registry / legacy Umbraco-shaped `data`. */
export function cardsFromDualPromoData(data: Record<string, unknown>): DualPromoCard[] {
  if (Array.isArray(data.cards)) {
    const raw = data.cards as unknown[];
    return raw
      .map((row, idx) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `promo-${idx}`;
        return {
          id,
          image: readImage(o),
          imageAlt: typeof o.imageAlt === "string" ? o.imageAlt : "",
          eyebrow: typeof o.eyebrow === "string" ? o.eyebrow : "",
          title: typeof o.title === "string" ? o.title : "",
          description: typeof o.description === "string" ? o.description : "",
          ctaLabel: typeof o.ctaLabel === "string" ? o.ctaLabel : "",
          ctaUrl: typeof o.ctaUrl === "string" ? o.ctaUrl : "",
        };
      })
      .filter((x): x is DualPromoCard => x != null);
  }
  return parseCardsJson(data.cardsJson);
}

function safeSectionDomId(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  if (!/^[a-zA-Z][\w-]*$/.test(t)) return undefined;
  return t;
}

function CtaLink({ label, href }: { label: string; href: string }) {
  const l = label.trim();
  const h = href.trim();
  if (!l || !h) return null;
  const internal = h.startsWith("/") && !h.startsWith("//");
  const cls =
    "inline-flex min-h-[44px] max-w-full items-center justify-center rounded-full border border-[rgba(var(--lp-border),0.9)] px-4 text-sm font-medium text-[rgb(var(--lp-text))] transition hover:border-pink-500/50";
  if (internal) {
    return (
      <Button asChild variant="secondary">
        <Link href={h} className={cls}>
          {l}
        </Link>
      </Button>
    );
  }
  return (
    <Button asChild variant="secondary">
      <a href={h} className={cls} rel="noopener noreferrer">
        {l}
      </a>
    </Button>
  );
}

/**
 * Umbraco `dualPromoCardsBlock` — two (or more) large promo cards with image, copy, and CTA.
 * Distinct from generic `split_block` (plain two-column text).
 */
export function DualPromoCardsBlock({ merged, designSettings, sectionId, cards }: DualPromoCardsBlockProps) {
  const ds = designSettings;
  const list = useMemo(() => cards.filter((c) => c.title.trim() || c.image || c.ctaLabel.trim()), [cards]);
  const domId = safeSectionDomId(sectionId);

  if (list.length === 0) return null;

  return (
    <Section
      sectionClassName={marketingSectionClassString(merged, { motion: true })}
      containerClassName={marketingContainerClassString(merged)}
    >
      <div {...(domId ? { id: domId } : {})} className="mx-auto grid w-full max-w-full gap-6 md:grid-cols-2">
        {list.map((card) => {
          const surface = cardSurfaceClassString(resolvedCardForBlockType("cards", merged.card, ds));
          return (
            <article
              key={card.id}
              className={`${surface} flex min-h-0 w-full max-w-full flex-col overflow-hidden rounded-2xl border border-[rgba(var(--lp-border),0.85)]`}
            >
              <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-[rgb(var(--lp-muted))]/15">
                <MediaFrame
                  src={card.image || null}
                  alt={normalizeDisplayText(safeAltForImg(card.imageAlt, card.title))}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-col px-5 pb-6 pt-5 text-center md:px-6">
                {card.eyebrow.trim() ?
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                    {card.eyebrow.trim()}
                  </p>
                : null}
                {card.title.trim() ?
                  <h3 className={mergedHeadingClassString(merged, "h3")}>{card.title.trim()}</h3>
                : null}
                {card.description.trim() ?
                  <p className={cn(mergedBodyClassString(merged, { measure: true }), "mt-2 text-center")}>{card.description.trim()}</p>
                : null}
                <div className="mt-auto flex justify-center pt-2">
                  <CtaLink label={card.ctaLabel} href={card.ctaUrl} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
