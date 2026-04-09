"use client";

import { useState } from "react";
import type { ImageBlock } from "../editorBlockTypes";

type ImageBlockEditorProps = {
  block: ImageBlock;
  onChange: (next: ImageBlock) => void;
  onOpenMediaPicker: () => void;
  /** Fetches alt from media archive. Returns result for honest error handling. */
  onFetchAltFromArchive?: (
    mediaItemId: string
  ) => Promise<{ ok: true; alt: string | null } | { ok: false; error: string }>;
};

export function ImageBlockEditor({
  block,
  onChange,
  onOpenMediaPicker,
  onFetchAltFromArchive,
}: ImageBlockEditorProps) {
  const [fetchAltLoading, setFetchAltLoading] = useState(false);
  const [fetchAltError, setFetchAltError] = useState<string | null>(null);

  const hasImageNoAlt = Boolean((block.imageId || "").trim() && !(block.alt || "").trim());
  const hasMediaRefNoPath = Boolean((block.mediaItemId ?? "").trim() && !(block.imageId ?? "").trim());

  async function handleFetchAltFromArchive() {
    if (!block.mediaItemId || !onFetchAltFromArchive) return;
    setFetchAltLoading(true);
    setFetchAltError(null);
    try {
      const result = await onFetchAltFromArchive(block.mediaItemId);
      if (result.ok === false) {
        setFetchAltError(result.error);
        return;
      }
      if (result.alt) onChange({ ...block, alt: result.alt });
      else setFetchAltError("Ingen alt-tekst i mediearkivet for dette bildet.");
    } catch (e) {
      setFetchAltError(e instanceof Error ? e.message : "Kunne ikke hente fra mediearkiv.");
    } finally {
      setFetchAltLoading(false);
    }
  }

  return (
    <div className="grid gap-2">
      {hasMediaRefNoPath ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800" role="status">
          Mediearkiv-referanse uten bilde-URL. Velg bilde på nytt fra mediearkiv eller skriv inn sti/URL.
        </p>
      ) : null}
      <label className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">Bilde (ID / URL)</span>
        <div className="flex gap-2">
          <input
            value={block.imageId || ""}
            onChange={(e) => onChange({ ...block, imageId: e.target.value })}
            placeholder="cms:*, media-ID, https://…"
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
      {hasImageNoAlt ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          Anbefalt: legg inn alt-tekst for tilgjengelighet. Ved valg fra mediearkiv fylles alt inn automatisk hvis det finnes.
        </p>
      ) : null}
      <label className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">Alt-tekst</span>
        <input
          value={block.alt || ""}
          onChange={(e) => onChange({ ...block, alt: e.target.value })}
          placeholder="Beskriv bildet for tilgjengelighet"
          className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
        />
        {block.mediaItemId && onFetchAltFromArchive ? (
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
      <label className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">Bildetekst (valgfritt)</span>
        <input
          value={block.caption || ""}
          onChange={(e) => onChange({ ...block, caption: e.target.value })}
          className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
        />
      </label>
    </div>
  );
}
