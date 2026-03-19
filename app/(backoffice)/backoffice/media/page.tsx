"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { logEditorAiEvent } from "@/domain/backoffice/ai/metrics/logEditorAiEvent";
import type { MediaItem } from "@/lib/media";
import { parseMediaItemListFromApi, parseMediaItemFromApi } from "@/lib/media";

type MediaListResponse =
  | { ok: true; rid: string; data: { items?: unknown } | unknown }
  | { ok: false; rid: string; error: string; message: string; status: number };

/** Library loads this many items so the list does not silently truncate (API max 100). */
const MEDIA_LIBRARY_LIST_LIMIT = 100;

/** Matches API and PATCH /api/backoffice/media/items/:id (ALT_MAX 180). */
const SUGGESTED_ALT_MAX = 180;

function normalizeSuggestedAlt(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (s.length > SUGGESTED_ALT_MAX) {
    s = s.slice(0, SUGGESTED_ALT_MAX - 1).trimEnd() + "…";
  }
  return s;
}

/** Renders thumbnail with safe fallback when image fails to load (404, CORS, etc.). */
function MediaLibraryThumbnail({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-slate-200 text-[10px] text-slate-500"
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
      className="h-full w-full object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function MediaLibraryPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [altDraftById, setAltDraftById] = useState<Record<string, string>>({});
  const [suggestedAltById, setSuggestedAltById] = useState<Record<string, string>>({});
  const [aiLoadingById, setAiLoadingById] = useState<Record<string, boolean>>({});
  const [aiErrorById, setAiErrorById] = useState<Record<string, string | null>>({});
  const [savingAltById, setSavingAltById] = useState<Record<string, boolean>>({});
  const [addUrl, setAddUrl] = useState("");
  const [addAlt, setAddAlt] = useState("");
  const [addCaption, setAddCaption] = useState("");
  const [addTags, setAddTags] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAlt, setUploadAlt] = useState("");
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [captionDraftById, setCaptionDraftById] = useState<Record<string, string>>({});
  const [tagsDraftById, setTagsDraftById] = useState<Record<string, string[]>>({});
  const [savingMetaById, setSavingMetaById] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/backoffice/media/items?limit=${MEDIA_LIBRARY_LIST_LIMIT}`;
      const res = await fetch(url, {
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
        setItems([]);
        return;
      }
      const data = (json as { data?: unknown }).data;
      const rawList = data != null && typeof data === "object" && !Array.isArray(data)
        ? (data as { items?: unknown }).items ?? []
        : Array.isArray(data)
          ? data
          : [];
      const next = parseMediaItemListFromApi(rawList);
      setItems(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ukjent feil ved henting av media.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleImproveAlt(item: MediaItem) {
    const id = item.id;
    setAiLoadingById((prev) => ({ ...prev, [id]: true }));
    setAiErrorById((prev) => ({ ...prev, [id]: null }));
    logEditorAiEvent({
      type: "ai_action_triggered",
      feature: "image_metadata",
      pageId: null,
      variantId: null,
      timestamp: new Date().toISOString(),
    });
    try {
      const res = await fetch("/api/backoffice/ai/image-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mediaItemId: id,
          url: item.url,
          locale: "nb",
          current: {
            alt: item.alt ?? "",
            caption: item.caption ?? null,
            tags: Array.isArray(item.tags) ? item.tags : [],
          },
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; data?: unknown; message?: string; error?: string }
        | null;
      if (!res.ok || !json || json.ok === false) {
        const msg = json?.message || json?.error || `Kunne ikke hente metadataforslag (status ${res.status}).`;
        setAiErrorById((prev) => ({ ...prev, [id]: String(msg) }));
        logEditorAiEvent({
          type: "ai_result_received",
          feature: "image_metadata",
          pageId: null,
          variantId: null,
          timestamp: new Date().toISOString(),
          patchPresent: false,
        });
        return;
      }
      const data = (json.data ?? {}) as Record<string, unknown>;
      const message = typeof data.message === "string" ? data.message : "";
      const alt = normalizeSuggestedAlt(data?.alt ?? data?.altText);
      if (!alt) {
        const noImprovement = /Ingen forbedringer|No metadata improvements/i.test(message);
        if (noImprovement) {
          logEditorAiEvent({
            type: "ai_result_received",
            feature: "image_metadata",
            pageId: null,
            variantId: null,
            timestamp: new Date().toISOString(),
            patchPresent: false,
          });
          return;
        }
        setAiErrorById((prev) => ({
          ...prev,
          [id]: "AI klarte ikke å foreslå en gyldig alt-tekst.",
        }));
        logEditorAiEvent({
          type: "ai_result_received",
          feature: "image_metadata",
          pageId: null,
          variantId: null,
          timestamp: new Date().toISOString(),
          patchPresent: false,
        });
        return;
      }
      setSuggestedAltById((prev) => ({ ...prev, [id]: alt }));
      logEditorAiEvent({
        type: "ai_result_received",
        feature: "image_metadata",
        pageId: null,
        variantId: null,
        timestamp: new Date().toISOString(),
        patchPresent: true,
      });
    } catch (e) {
      setAiErrorById((prev) => ({
        ...prev,
        [id]: e instanceof Error ? e.message : "Ukjent feil ved AI-metadata.",
      }));
      logEditorAiEvent({
        type: "ai_result_received",
        feature: "image_metadata",
        pageId: null,
        variantId: null,
        timestamp: new Date().toISOString(),
        patchPresent: false,
      });
    } finally {
      setAiLoadingById((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleApplyAlt(itemId: string) {
    const raw = altDraftById[itemId] ?? items.find((it) => it.id === itemId)?.alt ?? "";
    const alt = normalizeSuggestedAlt(raw);
    if (!alt) return;
    setSavingAltById((prev) => ({ ...prev, [itemId]: true }));
    setAiErrorById((prev) => ({ ...prev, [itemId]: null }));
    try {
      const res = await fetch(`/api/backoffice/media/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ alt }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.ok === false) {
        const msg = json?.message || json?.error || `Kunne ikke lagre alt-tekst (status ${res.status}).`;
        setAiErrorById((prev) => ({ ...prev, [itemId]: String(msg) }));
        return;
      }
      setAltDraftById((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      setSuggestedAltById((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      logEditorAiEvent({
        type: "ai_patch_applied",
        feature: "image_metadata",
        pageId: null,
        variantId: null,
        timestamp: new Date().toISOString(),
      });
      void load();
    } catch (e) {
      setAiErrorById((prev) => ({
        ...prev,
        [itemId]: e instanceof Error ? e.message : "Ukjent feil ved lagring av alt-tekst.",
      }));
    } finally {
      setSavingAltById((prev) => ({ ...prev, [itemId]: false }));
    }
  }

  async function handleAddItem(e: FormEvent) {
    e.preventDefault();
    const url = addUrl.trim();
    if (!url) return;
    setAddSubmitting(true);
    setAddError(null);
    try {
      const res = await fetch("/api/backoffice/media/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url,
          alt: addAlt.trim() || undefined,
          caption: addCaption.trim() || null,
          tags: addTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { item?: MediaItem }; message?: string } | null;
      if (!res.ok || !json?.ok) {
        setAddError(json?.message ?? `Feil ${res.status}`);
        return;
      }
      const created = parseMediaItemFromApi((json.data as { item?: unknown })?.item as Record<string, unknown>);
      if (created) setItems((prev) => [created, ...prev]);
      setAddUrl("");
      setAddAlt("");
      setAddCaption("");
      setAddTags("");
      void load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Kunne ikke legge til bilde.");
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handleUploadFile(e: FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;
    setUploadSubmitting(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", uploadFile);
      if (uploadAlt.trim()) form.append("alt", uploadAlt.trim());
      if (uploadCaption.trim()) form.append("caption", uploadCaption.trim());
      if (uploadTags.trim()) form.append("tags", uploadTags.trim());

      const res = await fetch("/api/backoffice/media/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; data?: { item?: MediaItem }; message?: string; error?: string }
        | null;
      if (!res.ok || !json || json.ok === false) {
        const msg = json?.message ?? json?.error ?? `Feil ${res.status}`;
        setUploadError(String(msg));
        return;
      }
      const created = parseMediaItemFromApi((json.data as { item?: unknown })?.item as Record<string, unknown>);
      if (created) setItems((prev) => [created, ...prev]);
      setUploadFile(null);
      setUploadAlt("");
      setUploadCaption("");
      setUploadTags("");
      const input = document.getElementById("media-upload-file") as HTMLInputElement | null;
      if (input && input.value) {
        input.value = "";
      }
      void load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Kunne ikke laste opp fil.");
    } finally {
      setUploadSubmitting(false);
    }
  }

  async function handleSaveMetadata(itemId: string) {
    const alt = (altDraftById[itemId] ?? items.find((i) => i.id === itemId)?.alt ?? "").trim();
    const caption = (captionDraftById[itemId] ?? items.find((i) => i.id === itemId)?.caption ?? "").trim() || null;
    const tags = tagsDraftById[itemId] ?? items.find((i) => i.id === itemId)?.tags ?? [];
    setSavingMetaById((prev) => ({ ...prev, [itemId]: true }));
    setAiErrorById((prev) => ({ ...prev, [itemId]: null }));
    try {
      const res = await fetch(`/api/backoffice/media/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ alt, caption, tags }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!res.ok || !json?.ok) {
        setAiErrorById((prev) => ({ ...prev, [itemId]: json?.message ?? `Feil ${res.status}` }));
        return;
      }
      setAltDraftById((p) => {
        const next = { ...p };
        delete next[itemId];
        return next;
      });
      setCaptionDraftById((p) => {
        const next = { ...p };
        delete next[itemId];
        return next;
      });
      setTagsDraftById((p) => {
        const next = { ...p };
        delete next[itemId];
        return next;
      });
      void load();
    } catch (err) {
      setAiErrorById((prev) => ({ ...prev, [itemId]: err instanceof Error ? err.message : "Kunne ikke lagre." }));
    } finally {
      setSavingMetaById((prev) => ({ ...prev, [itemId]: false }));
    }
  }

  async function handleDelete(itemId: string) {
    setDeletingId(itemId);
    try {
      const res = await fetch(`/api/backoffice/media/items/${encodeURIComponent(itemId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { message?: string } | null;
        setAiErrorById((prev) => ({ ...prev, [itemId]: json?.message ?? `Feil ${res.status}` }));
        return;
      }
      setDeleteConfirmId(null);
      void load();
    } catch (err) {
      setAiErrorById((prev) => ({ ...prev, [itemId]: err instanceof Error ? err.message : "Kunne ikke slette." }));
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = items.filter((it) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      it.url.toLowerCase().includes(q) ||
      (it.alt && it.alt.toLowerCase().includes(q)) ||
      (it.caption && it.caption.toLowerCase().includes(q)) ||
      (Array.isArray(it.tags) && it.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-2 border-b border-[rgb(var(--lp-border))] pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[rgb(var(--lp-text))]">Mediearkiv</h1>
          <p className="text-sm text-[rgb(var(--lp-muted))]">
            Legg til, rediger metadata og gjenbruk bilder i innhold. Alt, bildetekst og tags lagres når du trykker «Lagre endringer».
          </p>
        </div>
      </header>

      <section className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-4">
        <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Legg til bilde via URL</h2>
        <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
          Angi URL til bildet (f.eks. fra CDN eller opplastingstjeneste). Valgfritt: alt-tekst, bildetekst og tags (kommaseparert).
        </p>
        <form onSubmit={handleAddItem} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs">
            <span className="text-[rgb(var(--lp-muted))]">URL *</span>
            <input
              type="url"
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              placeholder="https://..."
              className="h-9 w-64 rounded border border-[rgb(var(--lp-border))] px-2 text-sm"
              required
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-[rgb(var(--lp-muted))]">Alt-tekst</span>
            <input
              type="text"
              value={addAlt}
              onChange={(e) => setAddAlt(e.target.value)}
              placeholder="Beskrivelse for tilgjengelighet"
              className="h-9 w-48 rounded border border-[rgb(var(--lp-border))] px-2 text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-[rgb(var(--lp-muted))]">Bildetekst</span>
            <input
              type="text"
              value={addCaption}
              onChange={(e) => setAddCaption(e.target.value)}
              placeholder="Valgfri bildetekst"
              className="h-9 w-48 rounded border border-[rgb(var(--lp-border))] px-2 text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-[rgb(var(--lp-muted))]">Tags (kommaseparert)</span>
            <input
              type="text"
              value={addTags}
              onChange={(e) => setAddTags(e.target.value)}
              placeholder="hero, forside"
              className="h-9 w-40 rounded border border-[rgb(var(--lp-border))] px-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={addSubmitting || !addUrl.trim()}
            className="h-9 rounded border border-[rgb(var(--lp-border))] bg-white px-3 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] disabled:opacity-50"
          >
            {addSubmitting ? "Legger til…" : "Legg til bilde"}
          </button>
        </form>
        {addError ? (
          <p className="mt-2 text-xs text-red-600">{addError}</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-4">
        <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Last opp bildefil</h2>
        <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
          Velg en bildefil fra maskinen din. Filen lastes opp til medielagring og registreres i mediearkivet.
        </p>
        <form onSubmit={handleUploadFile} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs">
            <span className="text-[rgb(var(--lp-muted))]">Fil *</span>
            <input
              id="media-upload-file"
              type="file"
              accept="image/*"
              onChange={(e) => setUploadFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
              className="h-9 w-64 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
              required
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-[rgb(var(--lp-muted))]">Alt-tekst</span>
            <input
              type="text"
              value={uploadAlt}
              onChange={(e) => setUploadAlt(e.target.value)}
              placeholder="Beskrivelse for tilgjengelighet"
              className="h-9 w-48 rounded border border-[rgb(var(--lp-border))] px-2 text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-[rgb(var(--lp-muted))]">Bildetekst</span>
            <input
              type="text"
              value={uploadCaption}
              onChange={(e) => setUploadCaption(e.target.value)}
              placeholder="Valgfri bildetekst"
              className="h-9 w-48 rounded border border-[rgb(var(--lp-border))] px-2 text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-[rgb(var(--lp-muted))]">Tags (kommaseparert)</span>
            <input
              type="text"
              value={uploadTags}
              onChange={(e) => setUploadTags(e.target.value)}
              placeholder="hero, forside"
              className="h-9 w-40 rounded border border-[rgb(var(--lp-border))] px-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={uploadSubmitting || !uploadFile}
            className="h-9 rounded border border-[rgb(var(--lp-border))] bg-white px-3 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] disabled:opacity-50"
          >
            {uploadSubmitting ? "Laster opp…" : "Last opp bilde"}
          </button>
        </form>
        {uploadError ? (
          <p className="mt-2 text-xs text-red-600">{uploadError}</p>
        ) : null}
      </section>

      <div className="flex items-center justify-between gap-2 text-xs">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søk etter filnavn eller alt-tekst…"
          className="h-8 w-full max-w-xs rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
        />
        {loading ? (
          <span className="text-[10px] text-[rgb(var(--lp-muted))]">Laster media…</span>
        ) : (
          <span className="text-[10px] text-[rgb(var(--lp-muted))]">
            Viser {filtered.length} av {items.length} elementer
          </span>
        )}
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="shrink-0 rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Prøv igjen
          </button>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {filtered.map((item) => (
          <article
            key={item.id}
            className="flex flex-col overflow-hidden rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]"
          >
            <div className="relative aspect-[4/3] w-full bg-slate-100">
              <MediaLibraryThumbnail url={item.url} alt={item.alt || ""} />
            </div>
            <div className="flex flex-1 flex-col px-2 py-1.5 text-[11px]">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate font-medium text-[rgb(var(--lp-text))]">
                  {item.url.split("/").pop() || item.id}
                </span>
                {item.status ? (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium text-[rgb(var(--lp-muted))] bg-[rgb(var(--lp-card))]">
                    {item.status}
                  </span>
                ) : null}
              </div>
              <label className="mt-1 grid gap-0.5 text-[10px]">
                <span className="text-[rgb(var(--lp-muted))]">Alt-tekst</span>
                <textarea
                  className="min-h-10 rounded border border-[rgb(var(--lp-border))] px-2 py-1 text-[10px]"
                  value={altDraftById[item.id] ?? item.alt ?? ""}
                  onChange={(e) =>
                    setAltDraftById((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                  placeholder="Beskriv bildet for tilgjengelighet"
                />
              </label>
              <label className="mt-1 grid gap-0.5 text-[10px]">
                <span className="text-[rgb(var(--lp-muted))]">Bildetekst</span>
                <input
                  type="text"
                  className="rounded border border-[rgb(var(--lp-border))] px-2 py-1 text-[10px]"
                  value={captionDraftById[item.id] ?? item.caption ?? ""}
                  onChange={(e) =>
                    setCaptionDraftById((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                  placeholder="Valgfri bildetekst"
                />
              </label>
              <label className="mt-1 grid gap-0.5 text-[10px]">
                <span className="text-[rgb(var(--lp-muted))]">Tags</span>
                <input
                  type="text"
                  className="rounded border border-[rgb(var(--lp-border))] px-2 py-1 text-[10px]"
                  value={(tagsDraftById[item.id] ?? item.tags ?? []).join(", ")}
                  onChange={(e) =>
                    setTagsDraftById((prev) => ({
                      ...prev,
                      [item.id]: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                    }))
                  }
                  placeholder="hero, forside"
                />
              </label>
              {item.created_at ? (
                <span className="mt-0.5 text-[10px] text-[rgb(var(--lp-muted))]">
                  {new Date(item.created_at).toLocaleString("nb-NO")}
                </span>
              ) : null}
              <div className="mt-2 space-y-1">
                {aiErrorById[item.id] ? (
                  <p className="text-[10px] text-red-600">{aiErrorById[item.id]}</p>
                ) : null}
                <button
                  type="button"
                  className="w-full rounded border border-[rgb(var(--lp-border))] px-2 py-1 text-[10px] font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 disabled:opacity-60"
                  onClick={() => void handleImproveAlt(item)}
                  disabled={aiLoadingById[item.id]}
                >
                  {aiLoadingById[item.id] ? "Kjører…" : "Forbedre alt-tekst med AI"}
                </button>
                {suggestedAltById[item.id] ? (
                  <div className="space-y-0.5 rounded border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/60 px-2 py-1">
                    <p className="text-[10px] font-semibold text-[rgb(var(--lp-text))]">AI-forslag</p>
                    <p className="text-[10px] text-[rgb(var(--lp-muted))]">{suggestedAltById[item.id]}</p>
                    <button
                      type="button"
                      className="mt-1 w-full rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-[10px] font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50"
                      onClick={() =>
                        setAltDraftById((prev) => ({ ...prev, [item.id]: suggestedAltById[item.id] }))
                      }
                    >
                      Bruk forslag i feltet
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="w-full rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-[10px] font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 disabled:opacity-60"
                  onClick={() => void handleSaveMetadata(item.id)}
                  disabled={savingMetaById[item.id]}
                >
                  {savingMetaById[item.id] ? "Lagrer…" : "Lagre endringer"}
                </button>
                <button
                  type="button"
                  className="w-full rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                  onClick={() => setDeleteConfirmId(item.id)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id ? "Sletter…" : "Slett"}
                </button>
              </div>
            </div>
          </article>
        ))}
        {!loading && filtered.length === 0 && !error ? (
          <div className="col-span-full rounded border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-6 text-center text-xs text-[rgb(var(--lp-muted))]" role="status">
            {items.length === 0
              ? "Ingen bilder i mediearkivet. Legg til et bilde med skjemaet over."
              : "Ingen media matcher søket. Prøv et annet søk eller legg til et bilde med skjemaet over."}
          </div>
        ) : null}
      </section>

      {deleteConfirmId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div
            className="lp-motion-overlay lp-glass-overlay absolute inset-0"
            aria-hidden
            onClick={() => setDeleteConfirmId(null)}
          />
          <div className="lp-motion-overlay lp-glass-panel relative z-10 w-full max-w-sm rounded-lg p-4">
            <h2 id="delete-confirm-title" className="text-sm font-semibold text-[rgb(var(--lp-text))]">
              Slette bilde fra mediearkivet?
            </h2>
            <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
              Dette fjerner bare oppføringen i mediearkivet. Sider som bruker bildet vil fortsatt vise URL-en inntil du oppdaterer innholdet.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="rounded border border-[rgb(var(--lp-border))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))]"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                disabled={deletingId === deleteConfirmId}
                className="rounded border border-red-300 bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId === deleteConfirmId ? "Sletter…" : "Slett"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

