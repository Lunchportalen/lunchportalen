"use client";

import { useEffect, useState } from "react";
import {
  workspaceHistoryStatusLabel,
  workspaceHistoryStatusTone,
  type WorkspaceHistoryStatus,
} from "@/lib/cms/backofficeWorkspaceContextModel";

type AuditItem = {
  id: string;
  action: string;
  actor_email: string | null;
  created_at: string | null;
  metadata?: Record<string, unknown>;
};

type AuditEnvelope = {
  items?: AuditItem[];
  degraded?: boolean;
  reason?: string;
  operatorMessage?: string;
  operatorAction?: string;
  source?: string;
  schemaHints?: { detail?: string; code?: string | null };
};

function formatAuditAction(action: string): string {
  const key = action.trim().toLowerCase();
  if (key === "update_content") return "Oppdatert innhold";
  if (key === "publish") return "Publisert";
  if (key === "unpublish") return "Satt til kladd";
  return action || "Ukjent handling";
}

function formatAuditTime(value: string | null): string {
  if (!value) return "Ukjent tidspunkt";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("nb-NO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContentWorkspaceAuditTimeline({
  pageId,
  historyStatus,
}: {
  pageId: string;
  historyStatus: WorkspaceHistoryStatus;
}) {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [surfaceMessage, setSurfaceMessage] = useState<string | null>(null);
  const [surfaceTone, setSurfaceTone] = useState<"neutral" | "warning" | "danger">("neutral");
  const [source, setSource] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [operatorAction, setOperatorAction] = useState<string | null>(null);
  const [technicalDetail, setTechnicalDetail] = useState<string | null>(null);
  const [technicalCode, setTechnicalCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSurfaceMessage(null);
    setSurfaceTone("neutral");
    setSource(null);
    setReason(null);
    setOperatorAction(null);
    setTechnicalDetail(null);
    setTechnicalCode(null);
    void fetch(`/api/backoffice/content/audit-log?limit=12&page_id=${encodeURIComponent(pageId)}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          message?: string;
          data?: AuditEnvelope;
        } | null;
        if (cancelled) return;
        if (!res.ok || json?.ok === false) {
          setSurfaceMessage(typeof json?.message === "string" ? json.message : `HTTP ${res.status}`);
          setSurfaceTone("danger");
          setItems([]);
          return;
        }
        const payload = json?.data ?? {};
        const nextItems = Array.isArray(payload.items) ? payload.items : [];
        setItems(nextItems);
        setSource(typeof payload.source === "string" ? payload.source : null);
        setReason(typeof payload.reason === "string" ? payload.reason : null);
        setOperatorAction(typeof payload.operatorAction === "string" ? payload.operatorAction : null);
        setTechnicalDetail(
          payload.schemaHints && typeof payload.schemaHints.detail === "string"
            ? payload.schemaHints.detail
            : null,
        );
        setTechnicalCode(
          payload.schemaHints && typeof payload.schemaHints.code === "string"
            ? payload.schemaHints.code
            : null,
        );
        if (payload.degraded) {
          setSurfaceMessage(payload.operatorMessage ?? "Audit-loggen er degradert. Viser kun det API-et kan hente nå.");
          setSurfaceTone("warning");
        } else if (payload.operatorMessage && nextItems.length === 0) {
          setSurfaceMessage(payload.operatorMessage);
          setSurfaceTone("neutral");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSurfaceMessage("Kunne ikke laste audit-logg.");
          setSurfaceTone("danger");
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  const historyChipClass =
    workspaceHistoryStatusTone(historyStatus) === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : workspaceHistoryStatusTone(historyStatus) === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-slate-200 bg-slate-50 text-slate-700";

  const surfaceMessageClass =
    surfaceTone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : surfaceTone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Audit og arbeidslogg</h2>
          <p className="mt-1 text-sm leading-relaxed text-[rgb(var(--lp-muted))]">
            Operatørvennlig tidslinje for denne siden. Degradert audit blir vist eksplisitt, ikke skjult bak generiske feil.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${historyChipClass}`}>
            {workspaceHistoryStatusLabel(historyStatus)}
          </span>
          {reason ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
              {reason}
            </span>
          ) : null}
        </div>
      </div>
      {surfaceMessage ? (
        <div className={`mt-3 rounded-xl border px-3 py-3 text-sm ${surfaceMessageClass}`}>
          <p>{surfaceMessage}</p>
          {source ? (
            <p className="mt-1 text-[11px] uppercase tracking-wide text-current/75">
              Kilde: {source}
            </p>
          ) : null}
          {operatorAction ? (
            <p className="mt-2 rounded-lg border border-current/15 bg-white/60 px-2.5 py-2 text-[11px] font-medium text-current/90">
              Neste steg: {operatorAction}
            </p>
          ) : null}
          {technicalDetail ? (
            <details className="mt-2 text-[11px] text-current/80">
              <summary className="cursor-pointer font-medium uppercase tracking-wide">
                Teknisk detalj
              </summary>
              {technicalCode ? (
                <p className="mt-1 break-words font-mono">Kode: {technicalCode}</p>
              ) : null}
              <p className="mt-1 break-words font-mono">{technicalDetail}</p>
            </details>
          ) : null}
        </div>
      ) : null}
      {loading ? <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">Laster audit-logg…</p> : null}
      {!loading && !surfaceMessage && items.length === 0 ? (
        <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">Ingen audit-rader tilgjengelig for denne siden.</p>
      ) : null}
      {items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-[rgb(var(--lp-border))]/80 bg-[rgb(var(--lp-card))]/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[rgb(var(--lp-text))]">{formatAuditAction(item.action)}</p>
                <p className="text-xs text-[rgb(var(--lp-muted))]">{formatAuditTime(item.created_at)}</p>
              </div>
              <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                {item.actor_email?.trim() ? item.actor_email : "System / ukjent aktør"}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
