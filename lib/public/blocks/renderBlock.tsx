import type { ReactNode } from "react";
import { FormBlock } from "@/lib/public/forms/FormBlock";

type CmsBlock = {
  id: string;
  type: string;
  data?: Record<string, unknown> | null;
};

type Env = "prod" | "staging";

type Locale = "nb" | "en";

export function renderBlock(block: CmsBlock, env: Env, locale: Locale): ReactNode {
  if (!block) return null;
  const data = (block.data ?? {}) as Record<string, unknown>;
  if (block.type === "form") {
    const formId = typeof data.formId === "string" ? data.formId : "";
    const title = typeof data.title === "string" ? data.title : undefined;
    if (!formId) {
      return (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Skjema-blokk mangler formId.
        </div>
      );
    }
    return <FormBlock formId={formId} title={title} env={env} locale={locale} />;
  }
  if (block.type === "hero") {
    return (
      <section className="lp-hero-cms rounded-2xl bg-slate-900 px-4 py-8 text-white md:px-6">
        <h1 className="text-2xl font-semibold md:text-3xl">
          {String(data.title ?? data.heading ?? "")}
        </h1>
        {(data.subtitle ?? data.text) && (
          <p className="mt-2 text-slate-300">{String(data.subtitle ?? data.text)}</p>
        )}
        {data.ctaLabel && (
          <a
            href={typeof data.ctaHref === "string" ? data.ctaHref : "#"}
            className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900"
          >
            {String(data.ctaLabel)}
          </a>
        )}
      </section>
    );
  }
  if (block.type === "richText") {
    return (
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-5">
        {data.heading && (
          <h2 className="text-lg font-semibold text-slate-900">{String(data.heading)}</h2>
        )}
        {data.body && (
          <div className="mt-2 text-sm leading-relaxed text-slate-700">{String(data.body)}</div>
        )}
      </section>
    );
  }
  if (block.type === "cta") {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          {data.title && <h3 className="text-sm font-semibold text-slate-900">{String(data.title)}</h3>}
          {data.body && <p className="mt-1 text-xs text-slate-600">{String(data.body)}</p>}
        </div>
        {data.buttonLabel && (
          <a
            href={typeof data.href === "string" ? data.href : "#"}
            className="inline-flex rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
          >
            {String(data.buttonLabel)}
          </a>
        )}
      </section>
    );
  }
  if (block.type === "image") {
    const src = typeof data.src === "string" ? data.src : null;
    const alt = typeof data.alt === "string" ? data.alt : typeof data.caption === "string" ? data.caption : "";
    return (
      <figure className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- CMS image src can be external/dynamic
          <img src={src} alt={alt} className="h-auto w-full rounded-lg object-cover" />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-lg bg-slate-200 text-xs text-slate-500">
            Bilde
          </div>
        )}
        {(data.caption ?? data.alt) && (
          <figcaption className="text-xs text-slate-600">
            {String(data.caption ?? data.alt)}
          </figcaption>
        )}
      </figure>
    );
  }
  return null;
}