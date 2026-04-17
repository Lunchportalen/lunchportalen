import React from "react";
import { Section } from "@/components/ui/Section";
import type { MergedDesign } from "@/lib/cms/design/designContract";
import {
  marketingContainerClassString,
  marketingSectionClassString,
  mergedBodyClassString,
} from "@/lib/cms/design/designContract";

function cn(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ");
}

function textAlignFromVariant(v: unknown): string {
  const t = String(v ?? "center").toLowerCase();
  if (t === "left") return "text-left";
  if (t === "right") return "text-right";
  return "text-center";
}

function contentWidthClass(w: unknown): string {
  const t = String(w ?? "narrow").toLowerCase();
  if (t === "wide") return "max-w-4xl";
  if (t === "normal") return "max-w-3xl";
  return "max-w-2xl";
}

export type QuoteBlockProps = {
  merged: MergedDesign;
  quote: string;
  author: string;
  role: string;
  source: string;
  contentWidth: unknown;
  variant: unknown;
};

/**
 * Editorial pull-quote (`quote_block`): typographic quote + optional attribution.
 * **Not** customer testimonials — use `testimonial_block` for trust quotes with structured rows.
 */
export function QuoteBlock({ merged, quote, author, role, source, contentWidth, variant }: QuoteBlockProps) {
  const q = quote.trim();
  if (!q) return null;
  const ta = textAlignFromVariant(variant);
  const mw = cn("w-full", contentWidthClass(contentWidth));
  const a = author.trim();
  const r = role.trim();
  const src = source.trim();

  return (
    <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
      <blockquote
        className={cn(
          "border-l-4 border-pink-500/45 pl-5 md:pl-6",
          mw,
          ta,
          ta === "text-center" && "mx-auto",
          ta === "text-right" && "ml-auto border-l-0 border-r-4 pr-5 md:pr-6",
        )}
      >
        <p className={cn(mergedBodyClassString(merged, { measure: true }), "text-lg italic leading-snug text-[rgb(var(--lp-text))] md:text-xl")}>
          {q}
        </p>
        {(a || r || src) && (
          <footer className={cn("mt-5 space-y-0.5 text-sm text-[rgb(var(--lp-muted))]", ta)}>
            {a ? <cite className="block font-medium not-italic text-[rgb(var(--lp-text))]">— {a}</cite> : null}
            {r ? <span className="block">{r}</span> : null}
            {src ? <span className="block">{src}</span> : null}
          </footer>
        )}
      </blockquote>
    </Section>
  );
}
