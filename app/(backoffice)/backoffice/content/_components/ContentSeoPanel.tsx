"use client";

// Narrow presentational wrapper for the SEO tab.
// All state and business logic live in ContentWorkspace and are passed via props.
// Validation limits and preview mirror lib/cms/public/cmsPageMetadata.ts for consistency.

import type { SeoRecommendationsState, SeoRecommendation } from "@/lib/seo/intelligence";

const MAX_SEO_TITLE = 120;
const MAX_META_DESCRIPTION = 320;
const MAX_CANONICAL = 500;
const RECOMMENDED_TITLE_MIN = 50;
const RECOMMENDED_TITLE_MAX = 60;
const RECOMMENDED_DESC_MIN = 155;
const RECOMMENDED_DESC_MAX = 160;
const TITLE_SUFFIX = " – Lunchportalen";

type ContentSeoPanelProps = {
  meta: unknown;
  setMeta: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
  safeObj: (x: unknown) => Record<string, unknown>;
  safeStr: (x: unknown) => string;
  title: string;
  slug: string;
  isOffline: boolean;
  effectiveId: string | null;
  aiBusyToolId: string | null;
  handleAiSeoOptimize?: ((opts: { goal: string; audience: string }, opts2?: { fromInline?: boolean }) => void) | null;
  onPickOgImage?: () => void;
  /** SEO intelligence: score + before/suggested/applied flow */
  seoRecommendationsState?: SeoRecommendationsState | null;
  onRunSeoIntelligence?: () => void;
  onApplySeoRecommendation?: (rec: SeoRecommendation) => void;
  onDismissSeoRecommendation?: (rec: SeoRecommendation) => void;
  seoIntelligenceBusy?: boolean;
  /** True when last apply was rejected (stale: content had changed). */
  seoApplyRejected?: boolean;
};

export function ContentSeoPanel({
  meta,
  setMeta,
  safeObj,
  safeStr,
  title,
  slug,
  isOffline,
  effectiveId,
  aiBusyToolId,
  handleAiSeoOptimize,
  onPickOgImage,
  seoRecommendationsState = null,
  onRunSeoIntelligence,
  onApplySeoRecommendation,
  onDismissSeoRecommendation,
  seoIntelligenceBusy = false,
  seoApplyRejected = false,
}: ContentSeoPanelProps) {
  const root = safeObj(meta);
  const rawSeo = safeObj((root as { seo?: unknown }).seo);
  const rawSocial = safeObj((root as { social?: unknown }).social);
  const seoTitle = safeStr(rawSeo.title) || title;
  const seoDescription = safeStr(rawSeo.description);
  const canonicalUrl = safeStr(rawSeo.canonical) ?? safeStr(rawSeo.canonicalUrl);
  const noIndex = rawSeo.noIndex === true;
  const noFollow = rawSeo.noFollow === true;
  const ogImage = safeStr(rawSeo.ogImage);
  const twitterCreator = safeStr(rawSeo.twitterCreator);
  const socialTitle = safeStr(rawSocial.title);
  const socialDescription = safeStr(rawSocial.description);
  const sitemapPriority =
    Number((rawSeo as { sitemapPriority?: unknown }).sitemapPriority) || 0;
  const sitemapChangeFreq =
    safeStr((rawSeo as { sitemapChangeFreq?: unknown }).sitemapChangeFreq) || "";
  const alternativeUrl = safeStr((rawSeo as { alternativeUrl?: unknown }).alternativeUrl);
  const alternativeName = safeStr((rawSeo as { alternativeName?: unknown }).alternativeName);
  const titleLen = seoTitle.length;
  const descLen = seoDescription.length;
  const titleOverMax = titleLen > MAX_SEO_TITLE;
  const descOverMax = descLen > MAX_META_DESCRIPTION;
  const titleInRange = titleLen >= RECOMMENDED_TITLE_MIN && titleLen <= RECOMMENDED_TITLE_MAX;
  const descInRange = descLen >= RECOMMENDED_DESC_MIN && descLen <= RECOMMENDED_DESC_MAX;

  // Preview values matching buildCmsPageMetadata so editor sees what public page will use
  const baseTitle = (seoTitle || title || "").trim();
  const displayTitle =
    !baseTitle
      ? "Lunchportalen"
      : baseTitle.includes("–") || baseTitle.includes("Lunchportalen")
        ? baseTitle
        : `${baseTitle}${TITLE_SUFFIX}`;
  const displayCanonical = canonicalUrl.trim() || (slug ? `https://www.lunchportalen.no/${slug.replace(/^\/+/, "")}` : "…");
  const ogTitle = socialTitle || seoTitle || title?.trim() || displayTitle;
  const ogDescription = socialDescription || seoDescription;

  const rawDiag = safeObj((root as { diagnostics?: unknown }).diagnostics);
  const diagnosticsLastRun = safeStr(rawDiag.lastRun);

  const pendingSuggestions = seoRecommendationsState?.suggestions?.filter((s) => s.status === "pending") ?? [];
  const appliedOrDismissed = seoRecommendationsState?.suggestions?.filter((s) => s.status === "applied" || s.status === "dismissed") ?? [];

  return (
    <div className="lp-glass-panel space-y-4 rounded-b-2xl rounded-t-lg border-t-0 p-4">
      <h3 className="text-sm font-semibold text-[rgb(var(--lp-text))]">SEO &amp; deling</h3>

      {/* SEO intelligence: score + before/suggested/applied */}
      <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50 p-4">
        <p className="text-sm font-medium text-[rgb(var(--lp-text))]">SEO-intelligens</p>
        <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
          Få en score og konkrete forslag. Forslag er kun anbefalinger; du bruker eller avviser dem manuelt. Kjør analyse på nytt for oppdatert score etter endringer.
        </p>
        {seoApplyRejected ? (
          <p className="mt-2 text-xs text-amber-700" role="status">
            Innholdet har endret seg. Forslag ble ikke brukt.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {seoRecommendationsState != null ? (
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${
                seoRecommendationsState.score >= 70
                  ? "border-green-200 bg-green-50 text-green-800"
                  : seoRecommendationsState.score >= 40
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              Score: {seoRecommendationsState.score}/100
            </span>
          ) : null}
          {seoRecommendationsState?.lastScoredAt ? (
            <span className="text-xs text-[rgb(var(--lp-muted))]">
              Sist analysert: {new Date(seoRecommendationsState.lastScoredAt).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}
            </span>
          ) : null}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
            disabled={isOffline || !effectiveId || seoIntelligenceBusy}
            onClick={() => onRunSeoIntelligence?.()}
          >
            {seoIntelligenceBusy ? "Kjører analyse…" : "Kjør SEO-analyse"}
          </button>
        </div>
        {pendingSuggestions.length > 0 ? (
          <ul className="mt-4 space-y-3 border-t border-[rgb(var(--lp-border))] pt-4">
            {pendingSuggestions.map((rec) => (
              <li key={rec.id} className="rounded-lg border border-[rgb(var(--lp-border))] bg-white p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-[rgb(var(--lp-text))]">{rec.label}</span>
                    {rec.priority ? (
                      <span className="ml-2 text-[10px] uppercase text-[rgb(var(--lp-muted))]">{rec.priority}</span>
                    ) : null}
                    <dl className="mt-1.5 grid gap-1 text-xs">
                      <div>
                        <dt className="text-[rgb(var(--lp-muted))]">Før</dt>
                        <dd className="text-[rgb(var(--lp-text))]">{rec.before || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-[rgb(var(--lp-muted))]">Foreslått</dt>
                        <dd className="text-[rgb(var(--lp-text))]">{rec.suggested || "—"}</dd>
                      </div>
                      {rec.explanation ? (
                        <div>
                          <dt className="text-[rgb(var(--lp-muted))]">Hvorfor</dt>
                          <dd className="text-[rgb(var(--lp-muted))]">{rec.explanation}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    {rec.metaField != null && onApplySeoRecommendation ? (
                      <button
                        type="button"
                        className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-[10px] font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                        onClick={() => onApplySeoRecommendation(rec)}
                        aria-label={`Bruk forslag: ${rec.label}`}
                      >
                        Bruk
                      </button>
                    ) : null}
                    {onDismissSeoRecommendation ? (
                      <button
                        type="button"
                        className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-[10px] font-medium text-[rgb(var(--lp-muted))] hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                        onClick={() => onDismissSeoRecommendation(rec)}
                        aria-label={`Avvis forslag: ${rec.label}`}
                      >
                        Avvis
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {appliedOrDismissed.length > 0 ? (
          <details className="mt-3 border-t border-[rgb(var(--lp-border))] pt-3">
            <summary className="cursor-pointer text-xs font-medium text-[rgb(var(--lp-muted))]">
              Brukte / avviste forslag ({appliedOrDismissed.length})
            </summary>
            <ul className="mt-2 space-y-1.5 text-xs">
              {appliedOrDismissed.map((rec) => (
                <li key={rec.id} className="flex items-center gap-2 text-[rgb(var(--lp-muted))]">
                  <span className="font-medium text-[rgb(var(--lp-text))]">{rec.label}</span>
                  <span className="rounded border border-[rgb(var(--lp-border))] px-1.5 py-0.5 text-[10px]">
                    {rec.status === "applied" ? "Brukt" : "Avvist"}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      {diagnosticsLastRun ? (
        <p className="text-xs text-[rgb(var(--lp-muted))]">
          Sist sjekket: {new Date(diagnosticsLastRun).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}. Kjør sidediagnostikk i AI-fanen for å oppdatere.
        </p>
      ) : null}

      <div className="space-y-1">
        <p className="text-sm font-medium text-[rgb(var(--lp-text))]">
          Meta som brukes på siden
        </p>
        <p className="text-xs text-[rgb(var(--lp-muted))]">
          Verdier som sendes til søkemotorer og deling. Tomme felt får standard/fallback.
        </p>
        <dl className="grid gap-1.5 rounded-xl border border-[rgb(var(--lp-border))] bg-slate-50 p-3 text-sm">
          <div>
            <dt className="text-xs font-medium text-[rgb(var(--lp-muted))]">Tittel</dt>
            <dd className="truncate font-medium text-blue-600">{displayTitle}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[rgb(var(--lp-muted))]">Meta-beskrivelse</dt>
            <dd className="line-clamp-2 text-[13px] text-[rgb(var(--lp-muted))]">
              {seoDescription || "(tom — søkemotorer kan hente fra innhold)"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[rgb(var(--lp-muted))]">Canonical</dt>
            <dd className="truncate text-[13px]">{displayCanonical}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[rgb(var(--lp-muted))]">Robots</dt>
            <dd className="text-[13px]">
              {noIndex || noFollow
                ? `${noIndex ? "noindex" : "index"}, ${noFollow ? "nofollow" : "follow"}`
                : "index, follow"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[rgb(var(--lp-muted))]">OG-tittel</dt>
            <dd className="truncate text-[13px]">{ogTitle || displayTitle}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[rgb(var(--lp-muted))]">OG-beskrivelse</dt>
            <dd className="line-clamp-2 text-[13px] text-[rgb(var(--lp-muted))]">
              {ogDescription || "(bruker meta-beskrivelse eller tom)"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[rgb(var(--lp-muted))]">OG-bilde</dt>
            <dd className="truncate text-[13px]">{ogImage || "(standard fra innstillinger)"}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-[rgb(var(--lp-text))]">
          Tittel og beskrivelse
        </p>
        <p className="text-xs text-[rgb(var(--lp-muted))]">
          Slik kan siden vises i søkeresultat.
        </p>
        <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-slate-50 p-3 text-sm">
          <p className="truncate text-xs text-[rgb(var(--lp-muted))]">
            {slug ? `${slug}/` : "..."}
          </p>
          <p className="mt-1 font-medium text-blue-600">
            {seoTitle || "Sidetittel"}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[13px] text-[rgb(var(--lp-muted))]">
            {seoDescription || "Meta-beskrivelse"}
          </p>
        </div>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">SEO-tittel</span>
        <input
          value={seoTitle}
          onChange={(e) => {
            const raw = e.target.value;
            const value = raw.trim().slice(0, MAX_SEO_TITLE);
            setMeta((prev: any) => {
              const nextRoot = safeObj(prev);
              const nextSeo = safeObj((nextRoot as { seo?: unknown }).seo);
              return { ...nextRoot, seo: { ...nextSeo, title: value } };
            });
          }}
          className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          placeholder={title || "Tittel for søkeresultat"}
          maxLength={MAX_SEO_TITLE}
        />
        <span
          className={
            titleOverMax
              ? "text-xs text-amber-600"
              : titleInRange
                ? "text-xs text-green-600"
                : "text-xs text-[rgb(var(--lp-muted))]"
          }
        >
          {titleLen}/{MAX_SEO_TITLE} tegn
          {titleInRange && " — anbefalt"}
          {titleOverMax && " — klippes til max"}
        </span>
      </label>

      <label className="grid gap-1 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[rgb(var(--lp-muted))]">Meta-beskrivelse</span>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50"
            disabled={isOffline || !effectiveId || aiBusyToolId === "seo.optimize.page"}
            onClick={() =>
              handleAiSeoOptimize?.(
                { goal: "lead", audience: "" },
                { fromInline: true }
              )
            }
          >
            {aiBusyToolId === "seo.optimize.page" ? "Kjører…" : "Generer SEO-forslag"}
          </button>
        </div>
        <textarea
          value={seoDescription}
          onChange={(e) => {
            const raw = e.target.value;
            const value = raw.slice(0, MAX_META_DESCRIPTION);
            setMeta((prev: any) => {
              const nextRoot = safeObj(prev);
              const nextSeo = safeObj((nextRoot as { seo?: unknown }).seo);
              return { ...nextRoot, seo: { ...nextSeo, description: value } };
            });
          }}
          className="min-h-20 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
          placeholder="Kort og tydelig oppsummering for søkemotorer."
          maxLength={MAX_META_DESCRIPTION}
        />
        <span
          className={
            descOverMax
              ? "text-xs text-amber-600"
              : descInRange
                ? "text-xs text-green-600"
                : "text-xs text-[rgb(var(--lp-muted))]"
          }
        >
          {descLen}/{MAX_META_DESCRIPTION} tegn — anbefalt {RECOMMENDED_DESC_MIN}–{RECOMMENDED_DESC_MAX}
        </span>
      </label>

      <div className="space-y-1">
        <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Delingsbilde</p>
        <p className="text-xs text-[rgb(var(--lp-muted))]">
          Bilde som brukes når siden deles på sosiale medier. Bruk minst 1200×630 px. Hvis
          tomt brukes standard fra Global &gt; Innhold og innstillinger.
        </p>
        <div className="flex gap-2">
          <input
            value={ogImage}
            onChange={(e) => {
              const value = e.target.value;
              setMeta((prev: any) => {
                const nextRoot = safeObj(prev);
                const nextSeo = safeObj((nextRoot as { seo?: unknown }).seo);
                return { ...nextRoot, seo: { ...nextSeo, ogImage: value } };
              });
            }}
            className="h-10 flex-1 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            placeholder="/images/..."
          />
          {typeof onPickOgImage === "function" && (
            <button
              type="button"
              onClick={onPickOgImage}
              className="shrink-0 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
            >
              Velg fra mediearkiv
            </button>
          )}
        </div>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">Twitter-brukernavn (creator)</span>
        <input
          value={twitterCreator}
          onChange={(e) => {
            const value = e.target.value;
            setMeta((prev: any) => {
              const nextRoot = safeObj(prev);
              const nextSeo = safeObj((nextRoot as { seo?: unknown }).seo);
              return { ...nextRoot, seo: { ...nextSeo, twitterCreator: value } };
            });
          }}
          className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          placeholder="@brukernavn"
        />
      </label>

      <div className="space-y-1 border-t border-[rgb(var(--lp-border))] pt-3">
        <p className="text-sm font-medium text-[rgb(var(--lp-text))]">
          Override for deling (og:title / og:description)
        </p>
        <p className="text-xs text-[rgb(var(--lp-muted))]">
          Hvis satt brukes disse i stedet for SEO-tittel/beskrivelse når siden deles.
        </p>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Delings-tittel</span>
          <input
            value={socialTitle ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              setMeta((prev: any) => {
                const nextRoot = safeObj(prev);
                const nextSocial = safeObj((nextRoot as { social?: unknown }).social);
                return {
                  ...nextRoot,
                  social: { ...nextSocial, title: value || undefined },
                };
              });
            }}
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            placeholder={seoTitle || "Tittel ved deling"}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Delings-beskrivelse</span>
          <textarea
            value={socialDescription ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              setMeta((prev: any) => {
                const nextRoot = safeObj(prev);
                const nextSocial = safeObj((nextRoot as { social?: unknown }).social);
                return {
                  ...nextRoot,
                  social: { ...nextSocial, description: value || undefined },
                };
              });
            }}
            className="min-h-16 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
            placeholder={seoDescription || "Beskrivelse ved deling"}
          />
        </label>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">
            Skjul fra søkemotorer
          </p>
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Legger til noindex og ekskluderer siden fra sitemap.xml.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={noIndex}
            onClick={() =>
              setMeta((prev: any) => {
                const r = safeObj(prev);
                const s = safeObj((r as { seo?: unknown }).seo);
                return { ...r, seo: { ...s, noIndex: !s.noIndex } };
              })
            }
            className={`lp-motion-switch relative inline-flex h-7 w-12 items-center rounded-full border-2 ${
              noIndex ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"
            }`}
          >
            <span
              className={`lp-motion-switch-thumb inline-block h-5 w-5 rounded-full bg-white shadow ${
                noIndex ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
            {noIndex ? "JA" : "NEI"}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">
            Stopp at søkemotorer følger lenker
          </p>
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Legger til nofollow slik at lenker på siden ikke følges.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={noFollow}
            onClick={() =>
              setMeta((prev: any) => {
                const r = safeObj(prev);
                const s = safeObj((r as { seo?: unknown }).seo);
                return { ...r, seo: { ...s, noFollow: !s.noFollow } };
              })
            }
            className={`lp-motion-switch relative inline-flex h-7 w-12 items-center rounded-full border-2 ${
              noFollow ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"
            }`}
          >
            <span
              className={`lp-motion-switch-thumb inline-block h-5 w-5 rounded-full bg-white shadow ${
                noFollow ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
            {noFollow ? "JA" : "NEI"}
          </span>
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium text-[rgb(var(--lp-text))]">
          Sitemap XML-prioritet
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={sitemapPriority}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMeta((prev: any) => {
                const r = safeObj(prev);
                const s = safeObj((r as { seo?: unknown }).seo);
                return { ...r, seo: { ...s, sitemapPriority: v } };
              });
            }}
            className="h-10 w-20 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={sitemapPriority}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMeta((prev: any) => {
                const r = safeObj(prev);
                const s = safeObj((r as { seo?: unknown }).seo);
                return { ...r, seo: { ...s, sitemapPriority: v } };
              });
            }}
            className="flex-1"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium text-[rgb(var(--lp-text))]">
          Sitemap XML endringsfrekvens
        </p>
        <div className="flex flex-wrap gap-1">
          {(
            ["ALWAYS", "HOURLY", "DAILY", "WEEKLY", "MONTHLY", "YEARLY", "NEVER"] as const
          ).map((freq) => (
            <button
              key={freq}
              type="button"
              onClick={() =>
                setMeta((prev: any) => {
                  const r = safeObj(prev);
                  const s = safeObj((r as { seo?: unknown }).seo);
                  return { ...r, seo: { ...s, sitemapChangeFreq: freq } };
                })
              }
              className={`rounded border px-2 py-1 text-xs font-medium ${
                sitemapChangeFreq === freq
                  ? "border-slate-400 bg-slate-100 text-slate-900"
                  : "border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-muted))]"
              }`}
            >
              {freq}
            </button>
          ))}
        </div>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">Override canonical URL</span>
        <p className="text-xs text-[rgb(var(--lp-muted))]">
          Full URL inkl. scheme, f.eks. https://www.nettsted.no. Max {MAX_CANONICAL} tegn.
        </p>
        <input
          value={canonicalUrl}
          onChange={(e) => {
            const value = e.target.value.trim().slice(0, MAX_CANONICAL);
            setMeta((prev: any) => {
              const nextRoot = safeObj(prev);
              const nextSeo = safeObj((nextRoot as { seo?: unknown }).seo);
              return {
                ...nextRoot,
                seo: { ...nextSeo, canonical: value, canonicalUrl: value },
              };
            });
          }}
          className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          placeholder="https://..."
          maxLength={MAX_CANONICAL}
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">Alternativ URL</span>
        <p className="text-xs text-[rgb(var(--lp-muted))]">
          Brukes for å lenke til en alternativ side (f.eks. ekstern URL).
        </p>
        <input
          value={alternativeUrl}
          onChange={(e) => {
            const value = e.target.value;
            setMeta((prev: any) => {
              const nextRoot = safeObj(prev);
              const nextSeo = safeObj((nextRoot as { seo?: unknown }).seo);
              return { ...nextRoot, seo: { ...nextSeo, alternativeUrl: value } };
            });
          }}
          className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          placeholder="https://..."
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">Alternativ navn</span>
        <p className="text-xs text-[rgb(var(--lp-muted))]">
          Navn som vises sammen med alternativ URL (f.eks. navn på ekstern side).
        </p>
        <input
          value={alternativeName}
          onChange={(e) => {
            const value = e.target.value;
            setMeta((prev: any) => {
              const nextRoot = safeObj(prev);
              const nextSeo = safeObj((nextRoot as { seo?: unknown }).seo);
              return { ...nextRoot, seo: { ...nextSeo, alternativeName: value } };
            });
          }}
          className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          placeholder="Navn på alternativ side"
        />
      </label>
    </div>
  );
}

