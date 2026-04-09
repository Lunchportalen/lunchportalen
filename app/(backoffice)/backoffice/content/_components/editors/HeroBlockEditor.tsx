"use client";

import { useState } from "react";
import type { HeroBlock, HeroSuggestion } from "../editorBlockTypes";

type FetchAltResult =
  | { ok: true; alt: string | null }
  | { ok: false; error: string };

type HeroBlockEditorProps = {
  block: HeroBlock;
  onChange: (next: HeroBlock) => void;
  onOpenMediaPicker: () => void;
  /** Fetches alt from media archive. Same contract as image block. */
  onFetchAltFromArchive?: (mediaItemId: string) => Promise<FetchAltResult>;
  /** Optional AI suggestions from media archive */
  suggestions?: {
    items: HeroSuggestion[];
    loading: boolean;
    error: string | null;
    targetBlockId: string | null;
  };
  onRequestSuggestions?: () => void;
  onApplySuggestion?: (suggestion: HeroSuggestion) => void;
  /** Optional AI structured intent (hero title / CTA) */
  aiBusy?: boolean;
  onGenerateTitle?: () => void;
  onGenerateCta?: () => void;
};

export function HeroBlockEditor({
  block,
  onChange,
  onOpenMediaPicker,
  onFetchAltFromArchive,
  suggestions,
  onRequestSuggestions,
  onApplySuggestion,
  aiBusy,
  onGenerateTitle,
  onGenerateCta,
}: HeroBlockEditorProps) {
  const [fetchAltLoading, setFetchAltLoading] = useState(false);
  const [fetchAltError, setFetchAltError] = useState<string | null>(null);
  const c = block.contentData;

  async function handleFetchAltFromArchive() {
    if (!c.mediaItemId || !onFetchAltFromArchive) return;
    setFetchAltLoading(true);
    setFetchAltError(null);
    try {
      const result = await onFetchAltFromArchive(c.mediaItemId);
      if (result.ok === false) {
        setFetchAltError(result.error);
        return;
      }
      if (result.alt) {
        onChange({
          ...block,
          contentData: { ...block.contentData, imageAlt: result.alt },
        });
      } else setFetchAltError("Ingen alt-tekst i mediearkivet for dette bildet.");
    } catch (e) {
      setFetchAltError(e instanceof Error ? e.message : "Kunne ikke hente fra mediearkiv.");
    } finally {
      setFetchAltLoading(false);
    }
  }

  const hasMediaRefNoUrl = Boolean((c.mediaItemId ?? "").trim() && !(c.imageId ?? "").trim());

  return (
    <div className="grid gap-2">
      {hasMediaRefNoUrl ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800" role="status">
          Mediearkiv-referanse uten bilde-URL. Velg bilde på nytt fra mediearkiv eller skriv inn URL.
        </p>
      ) : null}
      <label className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">Bilde (ID / URL)</span>
        <div className="flex gap-2">
          <input
            value={c.imageId || ""}
            onChange={(e) =>
              onChange({
                ...block,
                contentData: { ...block.contentData, imageId: e.target.value },
              })
            }
            placeholder="cms:*, media-ID, https://… eller /sti"
            className="h-10 flex-1 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
          <button
            type="button"
            onClick={onOpenMediaPicker}
            className="shrink-0 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))]"
          >
            Fra mediearkiv
          </button>
        </div>
      </label>
      {c.imageId ? (
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Bilde alt-tekst</span>
          <input
            value={c.imageAlt || ""}
            onChange={(e) =>
              onChange({
                ...block,
                contentData: { ...block.contentData, imageAlt: e.target.value },
              })
            }
            placeholder="Beskriv bildet for tilgjengelighet"
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
          {c.mediaItemId && onFetchAltFromArchive ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleFetchAltFromArchive()}
                disabled={fetchAltLoading}
                className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 disabled:opacity-60"
              >
                {fetchAltLoading ? "Henter…" : "Hent alt fra mediearkiv"}
              </button>
              {fetchAltError ? (
                <span className="text-xs text-red-600" role="alert">
                  {fetchAltError} Prøv igjen eller skriv inn alt-tekst manuelt.
                </span>
              ) : null}
            </div>
          ) : null}
        </label>
      ) : null}
      {suggestions && onRequestSuggestions && onApplySuggestion && (
        <div className="mt-2 space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[rgb(var(--lp-muted))]">AI bildeforslag</span>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50"
              disabled={suggestions.loading}
              onClick={onRequestSuggestions}
            >
              {suggestions.loading ? "Finner forslag…" : "Foreslå bilder fra mediearkiv"}
            </button>
          </div>
          {suggestions.error && <p className="text-[10px] text-red-600">{suggestions.error}</p>}
          {suggestions.items.length > 0 && (
            <div className="mt-1 grid gap-1.5 md:grid-cols-3">
              {suggestions.items.map((s) => (
                <button
                  key={s.mediaId}
                  type="button"
                  onClick={() => onApplySuggestion(s)}
                  className="flex items-center gap-2 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/60 px-2 py-1.5 text-left text-[10px] hover:border-slate-400"
                >
                  <div className="h-10 w-14 overflow-hidden rounded bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.url} alt={s.alt || ""} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[rgb(var(--lp-text))]">
                      {s.filename || s.basename || s.mediaId.slice(-8)}
                    </p>
                    {s.alt ? <p className="line-clamp-2 text-[rgb(var(--lp-muted))]">{s.alt}</p> : null}
                    <p className="mt-0.5 text-[10px] text-[rgb(var(--lp-muted))]">{s.reason}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <label className="grid gap-1 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[rgb(var(--lp-muted))]">Tittel</span>
          {onGenerateTitle && (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50"
              disabled={aiBusy}
              onClick={onGenerateTitle}
            >
              {aiBusy ? "Kjører…" : "Generer bedre overskrift"}
            </button>
          )}
        </div>
        <input
          value={c.title}
          onChange={(e) =>
            onChange({
              ...block,
              contentData: { ...block.contentData, title: e.target.value },
            })
          }
          className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">Undertittel</span>
        <input
          value={c.subtitle || ""}
          onChange={(e) =>
            onChange({
              ...block,
              contentData: { ...block.contentData, subtitle: e.target.value },
            })
          }
          className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
        />
      </label>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[rgb(var(--lp-muted))]">CTA-tekst</span>
            {onGenerateCta && (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50"
                disabled={aiBusy}
                onClick={onGenerateCta}
              >
                {aiBusy ? "Kjører…" : "Generer CTA-idéer"}
              </button>
            )}
          </div>
          <input
            value={c.ctaLabel || ""}
            onChange={(e) =>
              onChange({
                ...block,
                contentData: { ...block.contentData, ctaLabel: e.target.value },
              })
            }
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">CTA-lenke</span>
          <input
            value={c.ctaHref || ""}
            onChange={(e) =>
              onChange({
                ...block,
                contentData: { ...block.contentData, ctaHref: e.target.value },
              })
            }
            placeholder="https://..."
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
      </div>
    </div>
  );
}
