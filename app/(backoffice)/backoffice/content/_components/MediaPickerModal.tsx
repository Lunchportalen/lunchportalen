"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";
import { logEditorAiEvent } from "@/domain/backoffice/ai/metrics/logEditorAiEvent";
import type { MediaItem } from "@/lib/media";
import { parseMediaItemListFromApi } from "@/lib/media";
import { hasValidSelectionUrl } from "./useMediaPicker";

type MediaPickerModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  onSelect: (item: { url: string; alt?: string; caption?: string; id?: string } | string) => void;
};

type MediaListResponse =
  | { ok: true; rid: string; data: unknown }
  | { ok: false; rid: string; error: string; message: string; status: number };

const PICKER_PAGE_SIZE = 24;

/** Thumbnail with fail-closed onError so deleted/broken media never appears as valid. */
function PickerThumbnail({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-t-lg bg-slate-200 text-[10px] text-slate-500"
        role="img"
        aria-label={alt || "Bilde ikke tilgjengelig"}
      >
        Bilde ikke tilgjengelig
      </div>
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={url}
      alt={alt || ""}
      className="h-full w-full rounded-t-lg object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function parseItemsFromResponse(json: MediaListResponse | null): MediaItem[] {
  const data = (json as { data?: unknown })?.data;
  const raw = Array.isArray(data) ? data : (data as { items?: unknown })?.items ?? [];
  return parseMediaItemListFromApi(raw);
}

export function MediaPickerModal({ open, title, onClose, onSelect }: MediaPickerModalProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async (append = false) => {
    const from = append ? offset : 0;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PICKER_PAGE_SIZE),
        offset: String(from),
        status: "ready",
      });
      const res = await fetch(`/api/backoffice/media/items?${params}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as MediaListResponse | null;
      if (!res.ok || !json || (json as { ok?: boolean }).ok === false) {
        const msg =
          (json as { message?: string })?.message ||
          (json as { error?: string })?.error ||
          `Kunne ikke hente media (status ${res.status}).`;
        setError(String(msg));
        if (!append) setItems([]);
        logEditorAiEvent({ type: "media_error", pageId: null, timestamp: new Date().toISOString(), message: msg, kind: "fetch" });
        return;
      }
      const next = parseItemsFromResponse(json);
      if (append) setItems((prev) => (next.length ? [...prev, ...next] : prev));
      else setItems(next);
      setOffset(from + next.length);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ukjent feil ved henting av media.";
      setError(msg);
      if (!append) setItems([]);
      logEditorAiEvent({ type: "media_error", pageId: null, timestamp: new Date().toISOString(), message: msg, kind: "fetch" });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [offset]);

  useEffect(() => {
    if (!open) return;
    setOffset(0);
    void load(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- load on open only

  // Reset state when modal closes so next open never shows stale list, error, or offset
  useEffect(() => {
    if (!open) {
      setError(null);
      setItems([]);
      setOffset(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="lp-motion-overlay lp-glass-overlay absolute inset-0"
        aria-hidden="true"
      />
      <div
        className="lp-motion-card lp-glass-panel relative z-[81] flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[rgb(var(--lp-border))] px-4 py-3">
          <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-card))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
            aria-label="Lukk"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 border-b border-[rgb(var(--lp-border))] px-4 py-2 text-xs">
          <div className="flex items-center gap-2 text-[10px] text-[rgb(var(--lp-muted))]">
            Velg et eksisterende bilde fra mediearkivet.
          </div>
          {loading ? (
            <span className="flex items-center gap-1.5 text-[10px] text-[rgb(var(--lp-muted))]">
              <Icon name="loading" size="sm" className="animate-spin" />
              Laster media…
            </span>
          ) : (
            <span className="text-[10px] text-[rgb(var(--lp-muted))]">
              {items.length} elementer
            </span>
          )}
        </div>
        {error ? (
          <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-3">
            <Icon name="warning" size="sm" className="text-red-600" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-red-800">Media API-feil</p>
              <p className="mt-0.5 text-[11px] text-red-700">{error}</p>
              <p className="mt-1 text-[10px] text-red-600">Sjekk at medietjenesten er tilgjengelig, eller prøv igjen.</p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
            >
              Prøv igjen
            </button>
          </div>
        ) : null}
        <div className="grid flex-1 grid-cols-2 gap-2 overflow-auto p-4 md:grid-cols-4">
          {items.map((item) => {
            const selection = { url: item.url, alt: item.alt, caption: item.caption ?? undefined, id: item.id };
            const valid = hasValidSelectionUrl(selection);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!valid) return;
                  onSelect(selection);
                  onClose();
                }}
                className="lp-motion-card flex flex-col rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-left text-[11px] hover:border-slate-400"
              >
                <div className="relative aspect-[4/3] w-full rounded-t-lg bg-slate-100">
                  <PickerThumbnail url={item.url} alt={item.alt || ""} />
                </div>
              <div className="flex flex-1 flex-col px-2 py-1.5">
                <span className="truncate text-[10px] font-medium text-[rgb(var(--lp-text))]">
                  {item.url.split("/").pop() || item.id}
                </span>
                {item.alt ? (
                  <span className="line-clamp-2 text-[10px] text-[rgb(var(--lp-muted))]">
                    {item.alt}
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600">Mangler alt-tekst</span>
                )}
                {item.caption ? (
                  <span className="line-clamp-1 text-[10px] text-[rgb(var(--lp-muted))]/80">
                    {item.caption}
                  </span>
                ) : null}
              </div>
              </button>
            );
          })}
          {!loading && items.length > 0 && items.length % PICKER_PAGE_SIZE === 0 ? (
            <div className="col-span-full flex justify-center py-2">
              <button
                type="button"
                onClick={() => void load(true)}
                disabled={loadingMore}
                className="rounded border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] disabled:opacity-50"
              >
                {loadingMore ? "Laster…" : "Last flere"}
              </button>
            </div>
          ) : null}
          {!loading && items.length === 0 && !error ? (
            <div className="col-span-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50 px-6 py-12 text-center">
              <Icon name="media" size="lg" className="mb-3 text-[rgb(var(--lp-muted))]/70" />
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Ingen bilder i mediearkivet</p>
              <p className="mt-1 max-w-xs text-xs text-[rgb(var(--lp-muted))]">
                Legg til bilder fra Mediearkiv-siden eller via AI-forslag i editoren. Bildene kan brukes i hero- og bildeblokker.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

