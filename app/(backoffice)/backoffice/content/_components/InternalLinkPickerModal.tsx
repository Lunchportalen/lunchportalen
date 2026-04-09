"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";

type PageRow = {
  id: string;
  title: string;
  slug: string;
  status?: string;
};

type PagesListResponse =
  | { ok: true; rid: string; data?: { items?: PageRow[] } & Record<string, unknown> }
  | { ok: false; rid: string; message?: string; error?: string };

function pageHrefFromSlug(slug: string): string {
  const s = slug.trim();
  if (!s || s === "home") return "/";
  return s.startsWith("/") ? s : `/${s}`;
}

type InternalLinkPickerModalProps = {
  open: boolean;
  onClose: () => void;
  onPick: (href: string) => void;
};

export function InternalLinkPickerModal({ open, onClose, onPick }: InternalLinkPickerModalProps) {
  const [items, setItems] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/backoffice/content/pages?${params}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as PagesListResponse | null;
      if (!res.ok || !json || json.ok === false) {
        const msg =
          (json as { message?: string })?.message ||
          (json as { error?: string })?.error ||
          `Kunne ikke hente sider (${res.status}).`;
        setError(String(msg));
        setItems([]);
        return;
      }
      const data = (json as { data?: { items?: PageRow[] } }).data;
      const raw = Array.isArray(data?.items) ? data!.items! : [];
      setItems(raw);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ukjent feil.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ("");
    void load("");
  }, [open, load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter(
      (p) =>
        p.title.toLowerCase().includes(t) ||
        p.slug.toLowerCase().includes(t) ||
        p.id.toLowerCase().includes(t)
    );
  }, [items, q]);

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
      className="fixed inset-0 z-[85] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Velg intern side"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="lp-motion-overlay lp-glass-overlay absolute inset-0" aria-hidden />
      <div
        className="lp-motion-card lp-glass-panel relative z-[86] flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[rgb(var(--lp-border))] px-4 py-3">
          <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Velg intern side</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-card))]"
            aria-label="Lukk"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
        <div className="border-b border-[rgb(var(--lp-border))] px-4 py-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrer titler og slug …"
            className="h-9 w-full rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load(q)}
              className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-[11px] font-medium hover:bg-[rgb(var(--lp-card))]"
            >
              Søk i CMS
            </button>
            {loading ? (
              <span className="flex items-center gap-1 text-[10px] text-[rgb(var(--lp-muted))]">
                <Icon name="loading" size="sm" className="animate-spin" />
                Laster…
              </span>
            ) : (
              <span className="text-[10px] text-[rgb(var(--lp-muted))]">{filtered.length} treff</span>
            )}
          </div>
        </div>
        {error ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">{error}</div>
        ) : null}
        <ul className="max-h-[50vh] overflow-auto p-2 text-sm">
          {filtered.map((p) => {
            const href = pageHrefFromSlug(p.slug);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(href);
                    onClose();
                  }}
                  className="flex w-full flex-col items-start rounded-lg border border-transparent px-3 py-2 text-left hover:border-[rgb(var(--lp-border))] hover:bg-[rgb(var(--lp-card))]"
                >
                  <span className="font-medium text-[rgb(var(--lp-text))]">{p.title || "(uten tittel)"}</span>
                  <span className="font-mono text-[11px] text-[rgb(var(--lp-muted))]">{href}</span>
                  {p.status ? (
                    <span className="mt-0.5 text-[10px] uppercase text-[rgb(var(--lp-muted))]">{p.status}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
          {!loading && filtered.length === 0 && !error ? (
            <li className="px-3 py-8 text-center text-sm text-[rgb(var(--lp-muted))]">Ingen sider funnet.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
