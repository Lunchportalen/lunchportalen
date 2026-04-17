"use client";

import React from "react";
import { Section } from "@/components/ui/Section";
import { TextBlock } from "@/components/ui/TextBlock";
import { FormBlock } from "@/lib/public/forms/FormBlock";
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
  const t = String(w ?? "normal").toLowerCase();
  if (t === "wide") return "max-w-5xl";
  if (t === "narrow") return "max-w-2xl";
  return "max-w-4xl";
}

/**
 * Accept only absolute https URLs for third-party form iframes (fail-closed).
 * Protocol-relative `//host/...` is normalized to https.
 */
export function sanitizeHttpsIframeSrc(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const candidate = t.startsWith("//") ? `https:${t}` : t;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export type FormEmbedBlockProps = {
  merged: MergedDesign;
  designSettings: ParsedDesignSettings | null;
  formId: string;
  iframeSrc: string;
  title: string;
  lede: string;
  embedHtml: string;
  contentWidth: unknown;
  variant: unknown;
  renderEnv: "prod" | "staging";
  renderLocale: "nb" | "en";
};

/**
 * Generic embedded / external forms (`form_embed`).
 * Distinct from `newsletter_signup` (single-field native signup) and `cta_block` (link CTA).
 *
 * Resolution order: internal `formId` → validated https `iframeSrc` → optional `embedHtml` (staging preview only).
 */
export function FormEmbedBlock({
  merged,
  designSettings,
  formId,
  iframeSrc,
  title,
  lede,
  embedHtml,
  contentWidth,
  variant,
  renderEnv,
  renderLocale,
}: FormEmbedBlockProps) {
  const ds = designSettings;
  const ta = textAlignFromVariant(variant);
  const mw = cn("w-full", contentWidthClass(contentWidth));
  const fid = formId.trim();
  const iframeUrl = sanitizeHttpsIframeSrc(iframeSrc);
  const htmlSnippet = embedHtml.trim();
  const tt = title.trim();
  const ld = lede.trim();

  const inner = (() => {
    if (fid) {
      return (
        <>
          {ld ?
            <TextBlock className={cn(mergedBodyClassString(merged, { measure: true }), "mb-4", ta)}>{ld}</TextBlock>
          : null}
          <FormBlock formId={fid} {...(tt ? { title: tt } : {})} env={renderEnv} locale={renderLocale} />
        </>
      );
    }
    if (iframeUrl) {
      return (
        <div
          className={cn(
            "w-full overflow-hidden rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30",
            (tt || ld) && "mt-6",
          )}
        >
          <iframe
            src={iframeUrl}
            title={tt || "Innebygd skjema"}
            className="block min-h-[min(520px,70vh)] w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          />
        </div>
      );
    }
    if (htmlSnippet && renderEnv === "staging") {
      return (
        <div
          className={cn(
            "rounded-lg border border-dashed border-amber-400/60 bg-amber-50/40 px-4 py-3 text-amber-950",
            (tt || ld) && "mt-6",
          )}
        >
          <p className="text-xs font-medium">
            HTML-snippet er lagret, men kjøres ikke i forhåndsvisning. Bruk https iframe-URL eller internt skjema i
            produksjon.
          </p>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-snug">
            {htmlSnippet}
          </pre>
        </div>
      );
    }
    return (
      <p className={cn("lp-warning text-sm", (tt || ld) && "mt-6")}>
        {htmlSnippet && renderEnv === "prod" ?
          "Skjemablokken har HTML-snippet uten sikker iframe-URL. Angi en https-URL til iframe-kilden, eller bruk et internt skjema (formId)."
        : "Skjemablokken mangler kilde: fyll inn internt skjema-ID (formId) eller https-URL for iframe (eksternt skjema)."}
      </p>
    );
  })();

  return (
    <Section
      sectionClassName={marketingSectionClassString(merged, { motion: Boolean(fid || iframeUrl) })}
      containerClassName={marketingContainerClassString(merged)}
    >
      <div
        className={cn(
          cardSurfaceClassString(resolvedCardForBlockType("form", merged.card, ds)),
          "lp-border p-6 md:p-8",
          mw,
          ta === "text-center" && "mx-auto",
          ta === "text-right" && "ml-auto",
        )}
      >
        {!fid && (tt || ld) ?
          <div className={cn("space-y-3", ta)}>
            {tt ? <h2 className={mergedHeadingClassString(merged, "h2")}>{tt}</h2> : null}
            {ld ? <TextBlock className={mergedBodyClassString(merged, { measure: true })}>{ld}</TextBlock> : null}
          </div>
        : null}
        {inner}
      </div>
    </Section>
  );
}
