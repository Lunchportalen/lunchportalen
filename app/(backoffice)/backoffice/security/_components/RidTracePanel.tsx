"use client";

import { useEffect } from "react";

import type { SecurityAuditEvent } from "@/lib/security/dashboardAudit";

type Props = {
  rid: string | null;
  events: SecurityAuditEvent[];
  onClose: () => void;
};

export function RidTracePanel({ rid, events, onClose }: Props) {
  useEffect(() => {
    if (!rid) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rid, onClose]);

  if (!rid) return null;

  const same = events.filter((e) => e.effectiveRid === rid);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rid-trace-title"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 id="rid-trace-title" className="text-sm font-semibold text-slate-900">
            RID-spor
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Lukk
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          <p className="font-mono text-xs text-slate-700">{rid}</p>
          <p className="mt-2 text-xs text-slate-500">
            {same.length} hendelse(r) med samme RID i gjeldende uttrekk (maks 100).
          </p>
          <ul className="mt-4 space-y-3">
            {same.map((ev) => (
              <li key={ev.id} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium text-slate-900">{ev.action ?? "—"}</span>
                  <time className="text-xs text-slate-500" dateTime={ev.created_at}>
                    {ev.created_at}
                  </time>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {ev.actor_role ?? "—"} · {ev.entity_type ?? "—"}
                </p>
                {ev.summary ? <p className="mt-1 text-xs text-slate-700">{ev.summary}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
