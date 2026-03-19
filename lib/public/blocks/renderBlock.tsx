import React, { type ReactNode } from "react";
import { safeAltForImg, safeCaptionForFigcaption } from "@/lib/media/renderSafe";
import { FormBlock } from "@/lib/public/forms/FormBlock";
import { SafeCmsImage } from "@/lib/public/blocks/SafeCmsImage";

type CmsBlock = {
  id: string;
  type: string;
  data?: Record<string, unknown> | null;
};

type Env = "prod" | "staging";

type Locale = "nb" | "en";

/** Normalize line endings for visible CMS text so literal "\\r\\n" / "\\n" and CRLF do not render as raw characters. Exported for tests. */
export function normalizeDisplayText(s: string): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

export function renderBlock(block: CmsBlock, env: Env, locale: Locale): ReactNode {
  if (!block) return null;
  const data = (block.data ?? {}) as Record<string, unknown>;

  if (block.type === "form") {
    const formId = typeof data.formId === "string" ? data.formId : "";
    const title =
      typeof data.title === "string" ? normalizeDisplayText(data.title) : undefined;
    if (!formId) {
      return (
        <div className="rounded-[var(--lp-radius-card)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Skjema-blokk mangler formId.
        </div>
      );
    }
    return (
      <div className="lp-motion-card">
        <FormBlock formId={formId} title={title} env={env} locale={locale} />
      </div>
    );
  }
  if (block.type === "hero") {
    return (
      <section className="lp-motion-card rounded-[var(--lp-radius-card)] bg-neutral-900 p-6 text-white shadow-[var(--lp-shadow-soft)]">
        <h1 className="font-display whitespace-pre-line text-2xl font-semibold md:text-3xl">
          {normalizeDisplayText(String(data.title ?? data.heading ?? ""))}
        </h1>
        {(data.subtitle ?? data.text) && (
          <p className="font-body mt-2 whitespace-pre-line text-white/85">
            {normalizeDisplayText(String(data.subtitle ?? data.text))}
          </p>
        )}
        {data.ctaLabel && (
          <a
            href={typeof data.ctaHref === "string" ? data.ctaHref : "#"}
            className="font-ui mt-4 inline-flex rounded-full bg-[rgb(var(--lp-surface))] px-4 py-2 text-sm font-medium text-[rgb(var(--lp-text))]"
          >
            {normalizeDisplayText(String(data.ctaLabel))}
          </a>
        )}
      </section>
    );
  }
  if (block.type === "richText") {
    return (
      <section className="lp-motion-card lp-glass-surface rounded-[var(--lp-radius-card)] p-6">
        {data.heading && (
          <h2 className="font-heading whitespace-pre-line text-lg font-semibold text-[rgb(var(--lp-text))]">
            {normalizeDisplayText(String(data.heading))}
          </h2>
        )}
        {data.body && (
          <div className="font-body mt-2 whitespace-pre-line text-sm leading-relaxed text-[rgb(var(--lp-muted))]">
            {normalizeDisplayText(String(data.body))}
          </div>
        )}
      </section>
    );
  }
  if (block.type === "cta") {
    return (
      <section className="lp-motion-card lp-glass-surface flex flex-wrap items-center justify-between gap-4 rounded-[var(--lp-radius-card)] p-6">
        <div>
          {data.title && (
            <h3 className="font-heading whitespace-pre-line text-sm font-semibold text-[rgb(var(--lp-text))]">
              {normalizeDisplayText(String(data.title))}
            </h3>
          )}
          {data.body && (
            <p className="font-body mt-1 whitespace-pre-line text-xs text-[rgb(var(--lp-muted))]">
              {normalizeDisplayText(String(data.body))}
            </p>
          )}
        </div>
        {data.buttonLabel && (
          <a
            href={typeof data.href === "string" ? data.href : "#"}
            className="font-ui inline-flex rounded-full bg-[rgb(var(--lp-text))] px-4 py-2 text-xs font-medium text-white"
          >
            {normalizeDisplayText(String(data.buttonLabel))}
          </a>
        )}
      </section>
    );
  }
  if (block.type === "image") {
    const src = typeof data.src === "string" ? data.src : null;
    const alt = normalizeDisplayText(safeAltForImg(data.alt, data.caption));
    const captionText = normalizeDisplayText(safeCaptionForFigcaption(data.caption, data.alt));
    return (
      <figure className="lp-motion-card lp-glass-surface flex flex-col gap-3 rounded-[var(--lp-radius-card)] p-6">
        <SafeCmsImage src={src} alt={alt} />
        {captionText ? (
          <figcaption className="font-body whitespace-pre-line text-xs text-[rgb(var(--lp-muted))]">
            {captionText}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  // Unknown or unsupported block type.
  // In production we fail silently to avoid noisy output for end-users.
  // In staging we surface a safe, visible warning so editors can fix content.
  if (env === "staging") {
    const typeLabel = block.type || "ukjent";
    return (
      <div className="rounded-[var(--lp-radius-card)] border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
        Ukjent blokktype i innhold: <span className="font-mono">{typeLabel}</span>.
      </div>
    );
  }

  return null;
}