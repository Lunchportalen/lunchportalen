"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { socialPostRowToUi, type SocialPostRowDb } from "@/lib/social/socialPostUiModel";
import type { SocialPostStatus } from "@/lib/social/socialPostStatusCanonical";

type ApiEnvelope<T> = { ok: boolean; rid?: string; data?: T; message?: string; error?: string };

const LABELS: Record<string, string> = {
  draft: "Utkast",
  in_review: "Til gjennomgang",
  approved: "Godkjent",
  scheduled: "Planlagt",
  published: "Publisert",
  cancelled: "Avbrutt",
  failed: "Feilet",
};

function badgeClass(group: string): string {
  switch (group) {
    case "draft":
      return "border-neutral-300 bg-neutral-50 text-neutral-800";
    case "in_review":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "approved":
      return "border-sky-200 bg-sky-50 text-sky-950";
    case "scheduled":
      return "border-violet-200 bg-violet-50 text-violet-950";
    case "published":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "failed":
      return "border-red-200 bg-red-50 text-red-950";
    case "cancelled":
      return "border-neutral-200 bg-neutral-100 text-neutral-600";
    default:
      return "border-neutral-200 bg-white text-neutral-800";
  }
}

export default function SocialCalendarRuntimeClient() {
  const [rows, setRows] = useState<SocialPostRowDb[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [platform, setPlatform] = useState<"linkedin" | "facebook" | "instagram">("linkedin");
  const [scheduleLocal, setScheduleLocal] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setBanner(null);
    try {
      const res = await fetch("/api/social/posts", { credentials: "include", cache: "no-store" });
      const json = (await res.json()) as ApiEnvelope<SocialPostRowDb[]>;
      if (!res.ok || !json.ok) {
        setBanner(json.message ?? json.error ?? "Kunne ikke hente innlegg.");
        setRows([]);
        return;
      }
      const data = Array.isArray(json.data) ? json.data : [];
      setRows(data);
    } catch {
      setBanner("Nettverksfeil ved lasting.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (rows.length === 0) return;
    if (!selectedId || !rows.some((r) => r.id === selectedId)) {
      setSelectedId(rows[0]!.id);
    }
  }, [rows, selectedId]);

  const selectedRow = useMemo(
    () => (selectedId ? rows.find((r) => r.id === selectedId) ?? null : null),
    [rows, selectedId],
  );

  const ui = useMemo(() => (selectedRow ? socialPostRowToUi(selectedRow) : null), [selectedRow]);

  useEffect(() => {
    if (!ui) {
      setCaption("");
      setHashtags("");
      setImageUrl("");
      setPlatform("linkedin");
      setScheduleLocal("");
      return;
    }
    setCaption(ui.caption);
    setHashtags(ui.hashtags.join(" "));
    setImageUrl(ui.imageUrl ?? "");
    setPlatform(ui.platform as "linkedin" | "facebook" | "instagram");
    if (selectedRow?.scheduled_at) {
      const d = new Date(selectedRow.scheduled_at);
      const pad = (n: number) => String(n).padStart(2, "0");
      const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setScheduleLocal(local);
    } else {
      setScheduleLocal("");
    }
  }, [ui, selectedRow]);

  const patch = async (body: Record<string, unknown>) => {
    if (!selectedId) return;
    setSaving(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/social/posts/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiEnvelope<unknown>;
      if (!res.ok || !json.ok) {
        setBanner((json as { message?: string }).message ?? json.error ?? "Lagring feilet.");
        return;
      }
      await load();
    } catch {
      setBanner("Nettverksfeil ved lagring.");
    } finally {
      setSaving(false);
    }
  };

  const saveEdits = async () => {
    const tags = hashtags
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith("#") ? t : `#${t}`));
    await patch({
      caption,
      hashtags: tags,
      imageUrl: imageUrl.trim() || null,
      platform,
    });
  };

  const generateDraft = async () => {
    setSaving(true);
    setBanner(null);
    try {
      const res = await fetch("/api/social/ai/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "deterministic",
          persist: true,
          platform,
        }),
      });
      const json = (await res.json()) as ApiEnvelope<{ saved?: boolean; savedId?: string | null }>;
      if (!res.ok || !json.ok) {
        setBanner(json.message ?? json.error ?? "Generering feilet.");
        return;
      }
      const id = json.data && typeof json.data === "object" && json.data && "savedId" in json.data ? (json.data as { savedId?: string }).savedId : null;
      await load();
      if (id) setSelectedId(id);
      setBanner("Nytt utkast er generert og lagret.");
    } catch {
      setBanner("Nettverksfeil ved generering.");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: SocialPostStatus) => {
    const body: Record<string, unknown> = { status };
    if (status === "scheduled" && scheduleLocal) {
      body.scheduled_at = new Date(scheduleLocal).toISOString();
    }
    await patch(body);
  };

  const publish = async () => {
    if (!selectedId) return;
    setSaving(true);
    setBanner(null);
    try {
      const res = await fetch("/api/social/posts/publish", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId }),
      });
      const json = (await res.json()) as ApiEnvelope<{
        published?: boolean;
        reason?: string;
        message?: string;
      }>;
      if (!res.ok || !json.ok) {
        setBanner(json.message ?? json.error ?? "Publisering feilet.");
        return;
      }
      const payload = json.data;
      if (payload && payload.published === false) {
        setBanner(payload.message ?? "Publisering er ikke aktivert for denne kanalen (fail-closed).");
      } else {
        setBanner("Publisert.");
      }
      await load();
    } catch {
      setBanner("Nettverksfeil ved publisering.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-16 pt-4">
      {banner ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2 text-sm text-amber-950" role="status">
          {banner}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium text-[rgb(var(--lp-fg))] shadow-sm transition hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-hotpink)] focus-visible:ring-offset-2 disabled:opacity-50"
          disabled={saving}
          onClick={() => void generateDraft()}
        >
          Generer utkast
        </button>
        <button
          type="button"
          className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium text-[rgb(var(--lp-fg))] shadow-sm transition hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 disabled:opacity-50"
          disabled={saving || !selectedId}
          onClick={() => void saveEdits()}
        >
          Lagre tekst og bilde
        </button>
        <Link
          href="/backoffice/media"
          className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] px-4 text-sm font-medium text-[rgb(var(--lp-fg))] underline-offset-4 hover:underline"
        >
          Åpne mediebibliotek
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 p-4 shadow-sm">
          <h2 className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">Innlegg</h2>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Sortert etter sist opprettet.</p>
          <div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto">
            {loading ? <p className="text-sm text-[rgb(var(--lp-muted))]">Laster…</p> : null}
            {!loading && rows.length === 0 ? (
              <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen innlegg ennå. Bruk «Generer utkast».</p>
            ) : null}
            {rows.map((r) => {
              const u = socialPostRowToUi(r);
              const g = u.displayGroup;
              const active = r.id === selectedId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={`flex w-full flex-col items-start rounded-xl border px-3 py-2 text-left text-sm transition ${
                    active
                      ? "border-[var(--lp-hotpink)] bg-[var(--lp-hotpink)]/5 shadow-sm"
                      : "border-[rgb(var(--lp-border))] bg-white hover:shadow-sm"
                  }`}
                >
                  <span className="font-medium text-[rgb(var(--lp-fg))] line-clamp-2">{u.text.slice(0, 120) || "(tomt utkast)"}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(g)}`}>
                      {LABELS[g] ?? g}
                    </span>
                    <span className="text-xs text-[rgb(var(--lp-muted))]">{u.platform}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 p-4 shadow-sm">
          <h2 className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">Redigering og flyt</h2>
          {!ui ? (
            <p className="text-sm text-[rgb(var(--lp-muted))]">Velg et innlegg.</p>
          ) : (
            <>
              <div className="grid gap-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                  Tekst
                  <textarea
                    className="mt-1 min-h-[120px] w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm text-[rgb(var(--lp-fg))]"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                  Hashtags
                  <input
                    className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    placeholder="#lunchportalen"
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                  Bilde-URL (fra mediebibliotek)
                  <input
                    className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                  Kanal
                  <select
                    className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as "linkedin" | "facebook" | "instagram")}
                  >
                    <option value="linkedin">LinkedIn</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                  Planlagt tidspunkt (for «Planlagt»)
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
                    value={scheduleLocal}
                    onChange={(e) => setScheduleLocal(e.target.value)}
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-[rgb(var(--lp-border))] pt-4">
                <FlowButton
                  label="Send til gjennomgang"
                  disabled={saving || !["draft", "planned"].includes(ui.status)}
                  onClick={() => void setStatus("in_review")}
                />
                <FlowButton
                  label="Godkjenn"
                  disabled={saving || ui.displayGroup !== "in_review"}
                  onClick={() => void setStatus("approved")}
                />
                <FlowButton
                  label="Sett planlagt"
                  disabled={saving || ui.displayGroup !== "approved" || !scheduleLocal}
                  onClick={() => void setStatus("scheduled")}
                />
                <FlowButton
                  label="Publiser (fail-closed)"
                  disabled={
                    saving || !["scheduled", "approved", "ready"].includes(ui.status)
                  }
                  onClick={() => void publish()}
                />
                <FlowButton
                  label="Avbryt"
                  disabled={saving || ui.status === "published" || ui.status === "cancelled"}
                  onClick={() => void setStatus("cancelled")}
                />
                <FlowButton
                  label="Tilbake til utkast"
                  disabled={saving || ui.displayGroup !== "in_review"}
                  onClick={() => void setStatus("draft")}
                />
              </div>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Publisering krever trygg kanalintegrasjon. Ved stub/dry-run forblir status uendret — se banner etter forsøk.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function FlowButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-xs font-medium text-[rgb(var(--lp-fg))] shadow-sm transition hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-hotpink)] focus-visible:ring-offset-2 disabled:opacity-40"
    >
      {label}
    </button>
  );
}
