import React from "react";
import { Section } from "@/components/ui/Section";
import { TextBlock } from "@/components/ui/TextBlock";
import type { MergedDesign } from "@/lib/cms/design/designContract";
import {
  marketingContainerClassString,
  marketingSectionClassString,
  mergedBodyClassString,
  mergedHeadingClassString,
} from "@/lib/cms/design/designContract";

function cn(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ");
}

function headAlignFromVariant(v: unknown): string {
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

export type SectionIntroBlockProps = {
  merged: MergedDesign;
  eyebrow: string;
  title: string;
  lede: string;
  /** Text alignment: `variant` uses registry `left` | `right` | `center` | `minimal` (minimal → center). */
  variant: unknown;
  /** Prose width: `narrow` | `normal` | `wide`. */
  contentWidth: unknown;
};

/**
 * Canonical section heading + short ingress (eyebrow, title, lede).
 * Use instead of composing the same pattern from `rich_text` / `text_block` / `highlight_block`.
 */
export function SectionIntroBlock({ merged, eyebrow, title, lede, variant, contentWidth }: SectionIntroBlockProps) {
  const ha = headAlignFromVariant(variant);
  const mw = cn("w-full", contentWidthClass(contentWidth));
  const e = eyebrow.trim();
  const t = title.trim();
  const l = lede.trim();
  if (!e && !t && !l) return null;

  return (
    <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
      <div className={cn("lp-section-head", ha)}>
        <div
          className={cn(
            mw,
            ha === "text-center" && "mx-auto",
            ha === "text-left" && "mr-auto ml-0",
            ha === "text-right" && "ml-auto mr-0",
          )}
        >
          {e ?
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">{e}</p>
          : null}
          {t ? <h2 className={mergedHeadingClassString(merged, "h2")}>{t}</h2> : null}
          {l ?
            <TextBlock className={cn(mergedBodyClassString(merged, { measure: true }), t ? "mt-3" : "mt-0")}>{l}</TextBlock>
          : null}
        </div>
      </div>
    </Section>
  );
}
