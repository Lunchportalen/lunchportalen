"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import TripletexMobileRowCard from "@/components/superadmin/tripletex/TripletexMobileRowCard";
import TripletexStatusBadge from "@/components/superadmin/tripletex/TripletexStatusBadge";
import TripletexSubNav from "@/components/superadmin/tripletex/TripletexSubNav";
import { formatDateTimeNO } from "@/lib/date/format";
import type { TripletexOutboxRow } from "@/lib/superadmin/tripletexAdminData";

function fmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return formatDateTimeNO(iso);
  } catch {
    return "—";
  }
}

function canRetry(status: string) {
  return status === "PENDING" || status === "FAILED";
}

async function readJson(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export default function TripletexQueueClient({ rows, status }: { rows: TripletexOutboxRow[]; status: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const statusOptions = useMemo(() => ["ALL", "PENDING", "PROCESSING", "FAILED", "SENT"], []);

  function applyStatus(next: string) {
    const p = new URLSearchParams(searchParams?.toString() ?? "");
    if (next === "ALL") p.delete("status");
    else p.set("status", next);
    startTransition(() => router.push(`/superadmin/tripletex/queue?${p.toString()}`));
  }

  async function retryRow(id: string) {
    setErr("");
    setMsg("");
    setRetryingId(id);
    const res = await fetch("/api/superadmin/tripletex/outbox/retry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_id: id }),
    });
    const json = await readJson(res);
    setRetryingId(null);
    if (!res.ok) {
      setErr(String(json?.message ?? "Retry feilet."));
      return;
    }
    setMsg("Outbox-hendelse satt til PENDING.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="lp-select-text mx-auto max-w-6xl">
      <header className="text-center sm:text-left">
        <p className="text-xs text-[rgb(var(--lp-muted))]">Superadmin · Tripletex</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Outbox-kø</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Tripletex-relaterte outbox-hendelser.</p>
      </header>

      <div className="mt-6">
        <TripletexSubNav activePath="/superadmin/tripletex/queue" />
      </div>

      <div className="mt-6">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Status</span>
          <select
            className="min-h-[48px] max-w-xs rounded-2xl border bg-white px-3"
            value={status}
            onChange={(e) => applyStatus(e.target.value)}
            disabled={pending}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {msg ? <p className="mt-4 text-sm font-medium text-emerald-800">{msg}</p> : null}
      {err ? <p className="mt-4 text-sm font-medium text-red-800">{err}</p> : null}

      <div className="mt-6 hidden overflow-x-auto rounded-2xl border bg-white md:block">
        <table className="lp-table min-w-full text-sm">
          <thead>
            <tr>
              <th>Opprettet</th>
              <th>Event key</th>
              <th>Status</th>
              <th>Forsøk</th>
              <th>Feil</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{fmt(row.created_at)}</td>
                <td className="max-w-[280px] break-all font-mono text-xs">{row.event_key}</td>
                <td>
                  <TripletexStatusBadge status={row.status} />
                </td>
                <td>{row.attempts}</td>
                <td className="max-w-[200px] truncate text-xs text-red-800">{row.last_error ?? "—"}</td>
                <td className="text-right">
                  {canRetry(row.status) ? (
                    <button
                      type="button"
                      className="ds-btn ds-btn--secondary min-h-[48px]"
                      disabled={pending || retryingId === row.id}
                      onClick={() => retryRow(row.id)}
                    >
                      {retryingId === row.id ? "Retry…" : "Retry"}
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-3 md:hidden">
        {rows.map((row) => (
          <TripletexMobileRowCard
            key={row.id}
            title={row.event_key}
            badge={<TripletexStatusBadge status={row.status} />}
            meta={
              <>
                <p>Opprettet: {fmt(row.created_at)}</p>
                <p>Forsøk: {row.attempts}</p>
                {row.last_error ? <p className="text-red-800">{row.last_error}</p> : null}
              </>
            }
            actions={
              canRetry(row.status) ? (
                <button
                  type="button"
                  className="ds-btn ds-btn--primary min-h-[48px]"
                  disabled={pending || retryingId === row.id}
                  onClick={() => retryRow(row.id)}
                >
                  Retry
                </button>
              ) : null
            }
          />
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-[rgb(var(--lp-muted))]">Ingen Tripletex-outbox-rader for filteret.</p>
      ) : null}
    </div>
  );
}
