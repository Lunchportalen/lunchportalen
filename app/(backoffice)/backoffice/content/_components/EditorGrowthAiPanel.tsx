"use client";

export type GrowthSeoOpportunity = {
  id: string;
  type: string;
  message: string;
  priority: string;
};

export type GrowthSeoKeyword = { phrase: string; intent: string; reason: string };

export type GrowthFunnelStep = { type: string; label: string; purpose: string };

export type EditorGrowthAiPanelProps = {
  enabled: boolean;
  productInput: string;
  audienceInput: string;
  onProductChange: (v: string) => void;
  onAudienceChange: (v: string) => void;
  busy: boolean;
  error: string | null;
  seoOpportunities: GrowthSeoOpportunity[];
  seoKeywords: GrowthSeoKeyword[];
  contentIdeas: string[];
  adHeadlines: string[];
  adDescriptions: string[];
  funnelSteps: GrowthFunnelStep[];
  funnelImprovements: string[];
  onRunSeo: () => void;
  onRunAds: () => void;
  onRunFunnel: () => void;
  onClearPreview: () => void;
};

/**
 * Growth intelligence: SEO, ads copy, funnel — forslag og forhåndsvisning kun.
 * Ingen auto-publisering, ingen annonsekjøp, ingen kampanjeoppretting.
 */
export function EditorGrowthAiPanel({
  enabled,
  productInput,
  audienceInput,
  onProductChange,
  onAudienceChange,
  busy,
  error,
  seoOpportunities,
  seoKeywords,
  contentIdeas,
  adHeadlines,
  adDescriptions,
  funnelSteps,
  funnelImprovements,
  onRunSeo,
  onRunAds,
  onRunFunnel,
  onClearPreview,
}: EditorGrowthAiPanelProps) {
  if (!enabled) return null;

  const hasAny =
    seoOpportunities.length > 0 ||
    seoKeywords.length > 0 ||
    contentIdeas.length > 0 ||
    adHeadlines.length > 0 ||
    adDescriptions.length > 0 ||
    funnelSteps.length > 0 ||
    funnelImprovements.length > 0;

  return (
    <section
      aria-label="AI vekst"
      className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vekst (AI)</p>
      <p className="mt-1 text-[11px] leading-snug text-[rgb(var(--lp-muted))]">
        Kun forslag og generert tekst. Ingen publisering, ingen annonsebudsjett, ingen automatiske kampanjer.
      </p>

      <div className="mt-3 space-y-2">
        <label className="grid gap-0.5 text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
          Produkt / tilbud (annonser)
          <input
            value={productInput}
            onChange={(e) => onProductChange(e.target.value)}
            placeholder="F.eks. Lunchportalen — samlet bedriftslunsj"
            className="min-h-[36px] rounded-lg border border-[rgb(var(--lp-border))] px-2 text-xs text-[rgb(var(--lp-text))]"
          />
        </label>
        <label className="grid gap-0.5 text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
          Målgruppe (valgfritt)
          <input
            value={audienceInput}
            onChange={(e) => onAudienceChange(e.target.value)}
            placeholder="F.eks. HR-ledere i mellomstore bedrifter"
            className="min-h-[36px] rounded-lg border border-[rgb(var(--lp-border))] px-2 text-xs text-[rgb(var(--lp-text))]"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onRunSeo}
          className="min-h-[40px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? "Kjører…" : "SEO-muligheter"}
        </button>
        <button
          type="button"
          disabled={busy || !productInput.trim()}
          onClick={onRunAds}
          className="min-h-[40px] rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/60 px-3 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] disabled:opacity-50"
        >
          Generer annonsetekst
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRunFunnel}
          className="min-h-[40px] rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/60 px-3 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] disabled:opacity-50"
        >
          Optimaliser funnel
        </button>
      </div>

      {hasAny ? (
        <button
          type="button"
          onClick={onClearPreview}
          className="mt-2 text-[10px] font-medium text-[rgb(var(--lp-muted))] underline-offset-2 hover:underline"
        >
          Tøm forhåndsvisning
        </button>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs text-red-700" aria-live="polite">
          {error}
        </p>
      ) : null}

      {seoOpportunities.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
            SEO-muligheter
          </p>
          <ul className="mt-1 space-y-1.5 text-xs text-[rgb(var(--lp-text))]">
            {seoOpportunities.map((o) => (
              <li key={o.id} className="leading-snug">
                <span className="text-[10px] text-[rgb(var(--lp-muted))]">[{o.priority}]</span> {o.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {seoKeywords.length > 0 ? (
        <div className="mt-2 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Nøkkelord</p>
          <ul className="mt-1 space-y-1 text-[11px] text-[rgb(var(--lp-text))]">
            {seoKeywords.map((k) => (
              <li key={k.phrase}>
                <span className="font-medium">{k.phrase}</span>{" "}
                <span className="text-[rgb(var(--lp-muted))]">({k.intent})</span> — {k.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {contentIdeas.length > 0 ? (
        <div className="mt-2 rounded-lg border border-dashed border-[rgb(var(--lp-border))] px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Innholdsideer</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px] text-[rgb(var(--lp-text))]">
            {contentIdeas.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {(adHeadlines.length > 0 || adDescriptions.length > 0) && (
        <div className="mt-3 rounded-lg border border-pink-500/30 bg-pink-50/40 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Annonseforslag (Google/Meta)</p>
          {adHeadlines.length > 0 ? (
            <ul className="mt-1 space-y-1 text-[11px] font-medium text-[rgb(var(--lp-text))]">
              {adHeadlines.map((h, i) => (
                <li key={`h-${i}`}>{h}</li>
              ))}
            </ul>
          ) : null}
          {adDescriptions.length > 0 ? (
            <ul className="mt-1 space-y-1 text-[11px] text-[rgb(var(--lp-text))]">
              {adDescriptions.map((d, i) => (
                <li key={`d-${i}`}>{d}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-[10px] text-[rgb(var(--lp-muted))]">
            Lim inn manuelt i annonseplattform — ingen opplasting eller kjøp herfra.
          </p>
        </div>
      )}

      {(funnelSteps.length > 0 || funnelImprovements.length > 0) && (
        <div className="mt-3 rounded-lg border border-[rgb(var(--lp-border))] bg-slate-50/80 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Funnel</p>
          {funnelSteps.length > 0 ? (
            <ol className="mt-1 list-inside list-decimal space-y-1 text-[11px] text-[rgb(var(--lp-text))]">
              {funnelSteps.map((s, i) => (
                <li key={`${s.type}-${i}`}>
                  <span className="font-medium">{s.label}</span> ({s.type}) — {s.purpose}
                </li>
              ))}
            </ol>
          ) : null}
          {funnelImprovements.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-[11px] text-[rgb(var(--lp-text))]">
              {funnelImprovements.map((m, i) => (
                <li key={i}>→ {m}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
