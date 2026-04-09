"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { BackofficeCollectionToolbar } from "@/components/backoffice/BackofficeCollectionToolbar";
import { BackofficeWorkspaceHeader } from "@/components/backoffice/BackofficeWorkspaceSurface";
import { logEditorAiEvent } from "@/domain/backoffice/ai/metrics/logEditorAiEvent";
import type { MediaItem } from "@/lib/media";
import { getMediaDisplayName, parseMediaItemListFromApi, parseMediaItemFromApi } from "@/lib/media";
import {
  MEDIA_COLLECTION_STATUS_OPTIONS,
  SAFE_BULK_COPY_MEDIA_URLS,
  type MediaCollectionStatusFilter,
} from "@/lib/cms/backofficeCollectionViewModel";

type MediaListResponse =
  | { ok: true; rid: string; data: { items?: unknown } | unknown }
  | { ok: false; rid: string; error: string; message: string; status: number };

/** Library loads this many items so the list does not silently truncate (API max 100). */
const MEDIA_LIBRARY_LIST_LIMIT = 100;

/** Matches API and PATCH /api/backoffice/media/items/:id (ALT_MAX 180). */
const SUGGESTED_ALT_MAX = 180;

function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const [addDisplayName, setAddDisplayName] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAlt, setUploadAlt] = useState("");
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadDisplayName, setUploadDisplayName] = useState("");
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [captionDraftById, setCaptionDraftById] = useState<Record<string, string>>({});
  const [tagsDraftById, setTagsDraftById] = useState<Record<string, string[]>>({});
  const [savingMetaById, setSavingMetaById] = useState<Record<string, boolean>>({});
  const [displayNameDraftById, setDisplayNameDraftById] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<MediaCollectionStatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCopyHint, setBulkCopyHint] = useState<string | null>(null);

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
      setSelectedIds([]);
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
          ...(addDisplayName.trim() ? { displayName: addDisplayName.trim() } : {}),
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
      setAddDisplayName("");
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
      if (uploadDisplayName.trim()) form.append("displayName", uploadDisplayName.trim());
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
      setUploadDisplayName("");
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
    const row = items.find((i) => i.id === itemId);
    const metaDn =
      row?.metadata &&
      typeof row.metadata === "object" &&
      typeof (row.metadata as { displayName?: unknown }).displayName === "string"
        ? String((row.metadata as { displayName: string }).displayName)
        : "";
    const displayName = (displayNameDraftById[itemId] ?? metaDn).trim();
    const alt = (altDraftById[itemId] ?? row?.alt ?? "").trim();
    const caption = (captionDraftById[itemId] ?? row?.caption ?? "").trim() || null;
    const tags = tagsDraftById[itemId] ?? row?.tags ?? [];
    setSavingMetaById((prev) => ({ ...prev, [itemId]: true }));
    setAiErrorById((prev) => ({ ...prev, [itemId]: null }));
    try {
      const res = await fetch(`/api/backoffice/media/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ alt, caption, tags, displayName }),
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
      setDisplayNameDraftById((p) => {
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

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (statusFilter !== "all" && (it.status ?? "ready") !== statusFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        getMediaDisplayName(it).toLowerCase().includes(q) ||
        it.url.toLowerCase().includes(q) ||
        (it.alt && it.alt.toLowerCase().includes(q)) ||
        (it.caption && it.caption.toLowerCase().includes(q)) ||
        (Array.isArray(it.tags) && it.tags.some((t) => t.toLowerCase().includes(q)))
      );
    });
  }, [items, query, statusFilter]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((it) => selectedIds.includes(it.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visible = new Set(filtered.map((f) => f.id));
      setSelectedIds((prev) => prev.filter((id) => !visible.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filtered.map((f) => f.id)])));
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const copySelectedUrls = async () => {
    const urls = filtered.filter((i) => selectedIds.includes(i.id)).map((i) => i.url);
    if (!urls.length) {
      setBulkCopyHint("Ingen valgte.");
      setTimeout(() => setBulkCopyHint(null), 2500);
      return;
    }
    try {
      await navigator.clipboard.writeText(urls.join("\n"));
      setBulkCopyHint(`Kopiert ${urls.length} URL(er).`);
    } catch {
      setBulkCopyHint("Kunne ikke kopiere (nettleser).");
    }
    setTimeout(() => setBulkCopyHint(null), 3000);
  };

  const copyOneUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setBulkCopyHint("Kopiert én URL.");
      setTimeout(() => setBulkCopyHint(null), 2500);
    } catch {
      setBulkCopyHint("Kunne ikke kopiere.");
      setTimeout(() => setBulkCopyHint(null), 2500);
    }
  };

  return (
    <main
      data-workspace="media"
      className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-8 sm:px-6"
    >
      <BackofficeWorkspaceHeader
        workspaceId="media"
        title="Media"
        lead="Legg til, rediger metadata og gjenbruk bilder i innhold. Navn, alt, bildetekst og tags lagres når du trykker «Lagre endringer»."
        contextSummary={
          <>
            Objekt: <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">media_items</code> (Postgres). Lagring
            går via API — ingen direkte runtime ordre-/avtale-mutasjon her.
          </>
        }
        statusChips={[
          { label: "Metadata / assets", tone: "neutral" },
          { label: "Publish av sider: Content", tone: "muted" },
        ]}
        secondaryActions={
          <Link
            className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
            href="/backoffice/content"
          >
            Til Content-workspace
          </Link>
        }
      />

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
            <span className="text-[rgb(var(--lp-muted))]">Navn (valgfritt)</span>
            <input
              type="text"
              value={addDisplayName}
              onChange={(e) => setAddDisplayName(e.target.value)}
              placeholder="Kort navn i biblioteket"
              className="h-9 w-48 rounded border border-[rgb(var(--lp-border))] px-2 text-sm"
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
            <span className="text-[rgb(var(--lp-muted))]">Navn (valgfritt)</span>
            <input
              type="text"
              value={uploadDisplayName}
              onChange={(e) => setUploadDisplayName(e.target.value)}
              placeholder="Kort navn i biblioteket"
              className="h-9 w-48 rounded border border-[rgb(var(--lp-border))] px-2 text-sm"
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

      <section aria-label="Mediabibliotek — collection">
        <h2 className="sr-only">Mediabibliotek — collection</h2>
        <BackofficeCollectionToolbar
          ariaLabel="Mediabibliotek — filtrering og trygg bulk"
          searchPlaceholder="Søk etter navn, URL eller alt-tekst…"
          searchValue={query}
          onSearchChange={setQuery}
          resultHint={
            loading
              ? "Laster media…"
              : `Viser ${filtered.length} av ${items.length} · ${selectedIds.length} valgt`
          }
          statusFilter={{
            value: statusFilter,
            options: MEDIA_COLLECTION_STATUS_OPTIONS,
            onChange: (v) => setStatusFilter(v as MediaCollectionStatusFilter),
          }}
          bulkActions={
            <>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Velg synlige
              </label>
              <button
                type="button"
                onClick={() => void copySelectedUrls()}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-[11px] font-medium text-slate-900 hover:bg-slate-50"
              >
                {SAFE_BULK_COPY_MEDIA_URLS}
              </button>
            </>
          }
        />
        {bulkCopyHint ? (
          <p className="mt-2 text-[11px] font-medium text-emerald-800" role="status">
            {bulkCopyHint}
          </p>
        ) : null}
      </section>

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
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgb(var(--lp-border))] px-2 py-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[10px] font-medium text-[rgb(var(--lp-text))]">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggleSelected(item.id)}
                  className="h-4 w-4 rounded border-slate-300"
                  aria-label={`Velg ${getMediaDisplayName(item)} for bulk`}
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void copyOneUrl(item.url)}
                  className="min-h-11 rounded border border-[rgb(var(--lp-border))] bg-white px-3 text-[10px] font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))]"
                >
                  Kopier URL
                </button>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded border border-[rgb(var(--lp-border))] bg-white px-3 text-[10px] font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))]"
                >
                  Åpne
                </a>
              </div>
            </div>
            <div className="relative aspect-[4/3] w-full bg-slate-100">
              <MediaLibraryThumbnail url={item.url} alt={item.alt || ""} />
            </div>
            <div className="flex flex-1 flex-col px-2 py-1.5 text-[11px]">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate font-medium text-[rgb(var(--lp-text))]" title={item.url}>
                  {getMediaDisplayName(item)}
                </span>
                {item.status ? (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium text-[rgb(var(--lp-muted))] bg-[rgb(var(--lp-card))]">
                    {item.status}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[9px] text-[rgb(var(--lp-muted))]">
                {item.mime_type ?? "—"} · {formatBytes(item.bytes)} ·{" "}
                {item.width != null && item.height != null ? `${item.width}×${item.height}` : "—"}
              </p>
              <label className="mt-1 grid gap-0.5 text-[10px]">
                <span className="text-[rgb(var(--lp-muted))]">Navn (bibliotek)</span>
                <input
                  type="text"
                  className="rounded border border-[rgb(var(--lp-border))] px-2 py-1 text-[10px]"
                  value={displayNameDraftById[item.id] ?? (typeof item.metadata?.displayName === "string" ? item.metadata.displayName : "")}
                  onChange={(e) =>
                    setDisplayNameDraftById((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                  placeholder="Kort navn"
                />
              </label>
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

