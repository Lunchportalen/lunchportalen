import React from "react";
import { Section } from "@/components/ui/Section";
import { TextBlock } from "@/components/ui/TextBlock";
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

export type NewsletterSignupBlockProps = {
  merged: MergedDesign;
  designSettings: ParsedDesignSettings | null;
  blockId: string;
  eyebrow: string;
  title: string;
  lede: string;
  submitLabel: string;
  /** Form `action` URL (e.g. list provider endpoint). Empty → form is presentational (submit disabled). */
  formAction: string;
  disclaimer: string;
  /** HTML form method — many providers expect `post`; default `get` is conservative when action is unknown. */
  submitMethod: string;
  contentWidth: unknown;
  variant: unknown;
};

/**
 * Newsletter / e-post påmelding (`newsletter_signup`). Distinct from `cta_block` (generic CTA) and `form_embed` (full form).
 */
export function NewsletterSignupBlock({
  merged,
  designSettings,
  blockId,
  eyebrow,
  title,
  lede,
  submitLabel,
  formAction,
  disclaimer,
  submitMethod,
  contentWidth,
  variant,
}: NewsletterSignupBlockProps) {
  const ds = designSettings;
  const ta = textAlignFromVariant(variant);
  const mw = cn("w-full", contentWidthClass(contentWidth));
  const action = formAction.trim();
  const canSubmit = Boolean(action) && action !== "#";
  const method = String(submitMethod ?? "get").toLowerCase() === "post" ? "post" : "get";
  const inputId = `newsletter-email-${blockId}`;
  const sub = submitLabel.trim() || "Meld meg på";
  const eb = eyebrow.trim();
  const tt = title.trim();
  const ld = lede.trim();
  const disc = disclaimer.trim();

  return (
    <Section sectionClassName={marketingSectionClassString(merged, { motion: true })} containerClassName={marketingContainerClassString(merged)}>
      <div
        className={cn(
          cardSurfaceClassString(resolvedCardForBlockType("cta_block", merged.card, ds)),
          "p-6 md:p-8",
          mw,
          ta === "text-center" && "mx-auto",
          ta === "text-right" && "ml-auto",
        )}
      >
        <div className={cn("space-y-3", ta)}>
          {eb ?
            <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">{eb}</p>
          : null}
          {tt ? <h3 className={mergedHeadingClassString(merged, "h3")}>{tt}</h3> : null}
          {ld ? <TextBlock className={mergedBodyClassString(merged, { measure: true })}>{ld}</TextBlock> : null}
        </div>
        <form
          className={cn("mt-6 flex w-full max-w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-center", ta === "text-left" && "sm:justify-start")}
          {...(canSubmit ? { action, method } : {})}
        >
          <div className="min-w-0 flex-1">
            <label htmlFor={inputId} className="sr-only">
              E-post
            </label>
            <input
              id={inputId}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required={canSubmit}
              disabled={!canSubmit}
              placeholder="din@epost.no"
              className={cn(
                "w-full min-h-[44px] rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-card))] px-4 text-base text-[rgb(var(--lp-text))] outline-none transition",
                "placeholder:text-[rgb(var(--lp-muted))]",
                "focus-visible:border-pink-500/50 focus-visible:ring-2 focus-visible:ring-pink-500/25",
                !canSubmit && "cursor-not-allowed opacity-60",
              )}
            />
          </div>
          <Button asChild variant="primary" className="shrink-0" disabled={!canSubmit}>
            <button type="submit" className="min-h-[44px] w-full sm:w-auto">
              {sub}
            </button>
          </Button>
        </form>
        {disc ?
          <p className={cn("mt-4 text-xs leading-snug text-[rgb(var(--lp-muted))]", ta)}>{disc}</p>
        : null}
      </div>
    </Section>
  );
}
