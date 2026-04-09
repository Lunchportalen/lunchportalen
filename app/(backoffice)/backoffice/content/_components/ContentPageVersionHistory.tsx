"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/toast";
import { formatHumanTime, groupVersions } from "@/lib/utils/timeFormat";

export type RestoredPagePayload = {
  id: string;
  title: string;
  slug: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  body: unknown;
  variantId: string | null;
};

type VersionRow = {
  id: string;
  pageId: string;
  versionNumber: number;
  locale: string;
  environment: string;
  createdAt: string;
  createdBy: string | null;
  label: string;
  action: string;
  changedFields: string[];
  isActive: boolean;
};

export type HistoryPreviewPayload = {
  title: string;
  slug: string;
  body: unknown;
  versionLabel: string;
};

export type ContentPageVersionHistoryProps = {
  pageId: string;
  locale: string;
  environment: string;
  /** Server `content_pages.updated_at` for optimistic concurrency (rollback). */
  pageUpdatedAt: string | null;
  disabled?: boolean;
  onApplyRestoredPage?: (page: RestoredPagePayload) => void;
  /** Live preview only — does not persist. */
  onApplyHistoryPreview?: (payload: HistoryPreviewPayload) => void;
  onDialogOpenChange?: (open: boolean) => void;
};

export function ContentPageVersionHistory({
  pageId,
  locale,
  environment,
  pageUpdatedAt,
  disabled,
  onApplyRestoredPage,
  onApplyHistoryPreview,
  onDialogOpenChange,
}: ContentPageVersionHistoryProps) {
  const { push: pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [restoreBusyId, setRestoreBusyId] = useState<string | null>(null);
  const [previewBusyId, setPreviewBusyId] = useState<string | null>(null);
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null);
  const activeRowRef = useRef<HTMLLIElement | null>(null);
  const inFlightRef = useRef<Set<string>>(new Set());
  const expectedUpdatedAtRef = useRef<string | null>(null);

  useEffect(() => {
    expectedUpdatedAtRef.current = pageUpdatedAt;
  }, [pageUpdatedAt]);

  /** Anchor for grouping + human time (set when dialog opens — deterministic per session). */
  const [groupAnchor, setGroupAnchor] = useState(() => new Date());
  useEffect(() => {
    if (open) setGroupAnchor(new Date());
  }, [open]);

  const grouped = useMemo(() => groupVersions(versions, groupAnchor), [versions, groupAnchor]);

  const setOpenWrapped = useCallback(
    (next: boolean) => {
      setOpen(next);
      onDialogOpenChange?.(next);
    },
    [onDialogOpenChange]
  );

  const loadVersions = useCallback(async () => {
    if (!pageId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        pageId: pageId.trim(),
        locale,
        environment,
      }).toString();
      const res = await fetch(`/api/page/versions?${qs}`, { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: unknown;
        data?: { versions?: VersionRow[] };
        message?: string;
      };
      if (!res.ok || json.ok !== true) {
        setError(typeof json.message === "string" ? json.message : "Kunne ikke hente historikk.");
        setVersions([]);
        return;
      }
      const list = Array.isArray(json.data?.versions) ? json.data!.versions! : [];
      setVersions(list);
    } catch {
      setError("Nettverksfeil ved henting av historikk.");
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [pageId, locale, environment]);

  useEffect(() => {
    if (open) void loadVersions();
  }, [open, loadVersions]);

  useEffect(() => {
    if (!open || loading || versions.length === 0) return;
    const t = window.setTimeout(() => {
      activeRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 100);
    return () => clearTimeout(t);
  }, [open, loading, versions]);

  useEffect(() => {
    if (!pendingRestoreId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPendingRestoreId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingRestoreId]);

  async function restoreWithoutConfirm(versionId: string) {
    if (!pageId.trim()) return;
    if (inFlightRef.current.has(versionId)) return;
    inFlightRef.current.add(versionId);
    setRestoreBusyId(versionId);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        pageId: pageId.trim(),
        versionId,
      };
      const exp = expectedUpdatedAtRef.current;
      if (typeof exp === "string" && exp.trim().length > 0) {
        body.expectedUpdatedAt = exp.trim();
      }

      const res = await fetch("/api/page/rollback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: unknown;
        message?: string;
        status?: string;
        data?: { page?: RestoredPagePayload; backupVersionId?: string };
      };
      if (!res.ok || json.ok !== true) {
        const stale = res.status === 409 || json.status === "PAGE_STALE";
        setError(
          typeof json.message === "string"
            ? json.message
            : stale
              ? "Siden ble oppdatert. Last historikk på nytt."
              : "Gjenoppretting feilet.",
        );
        if (stale) void loadVersions();
        return;
      }
      const page = json.data?.page;
      if (!page || typeof page !== "object") {
        setError("Mangler side-data etter gjenoppretting.");
        return;
      }
      onApplyRestoredPage?.(page);
      if (typeof page.updated_at === "string" && page.updated_at.trim()) {
        expectedUpdatedAtRef.current = page.updated_at.trim();
      }
      setOpenWrapped(false);
      setPendingRestoreId(null);

      const backupId = json.data?.backupVersionId ?? null;
      pushToast({
        kind: "success",
        message: "Versjon gjenopprettet ✔",
        durationMs: backupId ? 9000 : 4000,
        ...(backupId
          ? {
              action: {
                label: "Angre",
                onClick: () => {
                  void restoreWithoutConfirm(backupId);
                },
              },
            }
          : {}),
      });
    } catch {
      setError("Nettverksfeil ved gjenoppretting.");
    } finally {
      inFlightRef.current.delete(versionId);
      setRestoreBusyId(null);
    }
  }

  function requestRestore(versionId: string) {
    setPendingRestoreId(versionId);
  }

  async function confirmPendingRestore() {
    const id = pendingRestoreId;
    if (!id) return;
    setPendingRestoreId(null);
    await restoreWithoutConfirm(id);
  }

  async function runPreview(versionId: string) {
    if (!pageId.trim() || !onApplyHistoryPreview) return;
    if (inFlightRef.current.has(`pv:${versionId}`)) return;
    inFlightRef.current.add(`pv:${versionId}`);
    setPreviewBusyId(versionId);
    setError(null);
    try {
      const res = await fetch(
        `/api/page/version/${encodeURIComponent(versionId)}?pageId=${encodeURIComponent(pageId.trim())}`,
        { credentials: "include" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        ok?: unknown;
        message?: string;
        data?: {
          preview?: { title: string; slug: string; body: unknown; label: string };
        };
      };
      if (!res.ok || json.ok !== true) {
        setError(typeof json.message === "string" ? json.message : "Kunne ikke laste forhåndsvisning.");
        return;
      }
      const p = json.data?.preview;
      if (!p || typeof p.body === "undefined") {
        setError("Mangler forhåndsvisningsdata.");
        return;
      }
      onApplyHistoryPreview({
        title: p.title,
        slug: p.slug,
        body: p.body,
        versionLabel: p.label,
      });
      setOpenWrapped(false);
    } catch {
      setError("Nettverksfeil ved forhåndsvisning.");
    } finally {
      inFlightRef.current.delete(`pv:${versionId}`);
      setPreviewBusyId(null);
    }
  }

  const busy = restoreBusyId !== null || previewBusyId !== null;

  function renderVersionRow(v: VersionRow) {
    return (
      <li
        key={v.id}
        id={`version-row-${v.id}`}
        ref={(el) => {
          if (v.isActive) activeRowRef.current = el;
        }}
        className={`flex flex-col gap-2 rounded-lg border px-3 py-3 transition-transform duration-150 ease-out sm:flex-row sm:items-center sm:justify-between ${
          v.isActive ? "border-emerald-500 bg-emerald-50/90 ring-1 ring-emerald-200" : "border-[rgb(var(--lp-border))] bg-white/80"
        }`}
      >
        <div className="min-w-0 flex-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[rgb(var(--lp-text))]">{v.label}</span>
            {v.isActive ? (
              <span className="rounded-full border border-emerald-600 bg-white px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-800">
                AKTIV
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">{formatHumanTime(v.createdAt, groupAnchor)}</div>
          <div className="mt-1 text-xs font-medium text-[rgb(var(--lp-text))]">v{v.versionNumber}</div>
          {v.changedFields.length > 0 ? (
            <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Endret: {v.changedFields.join(", ")}</div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row sm:items-center">
          {onApplyHistoryPreview ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={busy}
              aria-label={`Forhåndsvis versjon ${v.versionNumber}`}
              onClick={() => void runPreview(v.id)}
            >
              {previewBusyId === v.id ? (
                <span className="inline-flex items-center gap-2">
                  <Icon name="loading" size="sm" className="animate-spin" />
                  Laster …
                </span>
              ) : (
                "Forhåndsvis"
              )}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={busy}
            aria-label={`Gjenopprett versjon ${v.versionNumber}`}
            onClick={() => requestRestore(v.id)}
          >
            Gjenopprett
          </Button>
        </div>
      </li>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpenWrapped}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || !pageId.trim()}
        className="min-h-11"
        onClick={() => setOpenWrapped(true)}
        aria-label="Åpne versjonshistorikk"
      >
        Historikk
      </Button>
      <DialogContent
        title="Versjonshistorikk"
        description="Gruppert etter dag. «AKTIV» = samsvarer med lagret innhold. Forhåndsvis endrer ikke databasen."
        className="max-h-[85vh] max-w-lg overflow-hidden"
        variant="glass"
      >
        <div className="relative flex max-h-[min(70vh,560px)] flex-col overflow-hidden">
          {error ? (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
              {error}
            </div>
          ) : null}
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[rgb(var(--lp-muted))]" role="status" aria-busy="true">
              <Icon name="loading" size="sm" className="animate-spin shrink-0" />
              Laster …
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen historikk tilgjengelig</p>
          ) : (
            <div
              className={`min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 ${pendingRestoreId ? "pointer-events-none opacity-60" : ""}`}
              aria-busy={busy}
            >
              {grouped.today.length > 0 ? (
                <motion.section
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">I dag</h4>
                  <ul className="space-y-2">{grouped.today.map(renderVersionRow)}</ul>
                </motion.section>
              ) : null}
              {grouped.yesterday.length > 0 ? (
                <motion.section
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: 0.03 }}
                >
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">I går</h4>
                  <ul className="space-y-2">{grouped.yesterday.map(renderVersionRow)}</ul>
                </motion.section>
              ) : null}
              {grouped.older.length > 0 ? (
                <motion.section
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: 0.06 }}
                >
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Eldre</h4>
                  <ul className="space-y-2">{grouped.older.map(renderVersionRow)}</ul>
                </motion.section>
              ) : null}
            </div>
          )}

          {pendingRestoreId ? (
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="history-restore-confirm-title"
              aria-describedby="history-restore-confirm-desc"
              className="pointer-events-auto mt-3 shrink-0 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-lg"
            >
              <p id="history-restore-confirm-title" className="text-sm font-semibold text-[rgb(var(--lp-text))]">
                Vil du gjenopprette denne versjonen?
              </p>
              <p id="history-restore-confirm-desc" className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                Nåværende innhold lagres som ny rad i historikken først.
              </p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  autoFocus
                  aria-label="Avbryt gjenoppretting"
                  onClick={() => setPendingRestoreId(null)}
                >
                  Avbryt
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="min-h-11"
                  disabled={busy}
                  aria-label="Bekreft gjenoppretting"
                  onClick={() => void confirmPendingRestore()}
                >
                  {restoreBusyId === pendingRestoreId ? (
                    <span className="inline-flex items-center gap-2">
                      <Icon name="loading" size="sm" className="animate-spin" />
                      Gjenoppretter …
                    </span>
                  ) : (
                    "Gjenopprett"
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
