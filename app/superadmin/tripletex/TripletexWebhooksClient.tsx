"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import TripletexMobileRowCard from "@/components/superadmin/tripletex/TripletexMobileRowCard";
import TripletexStatusBadge from "@/components/superadmin/tripletex/TripletexStatusBadge";
import TripletexSubNav from "@/components/superadmin/tripletex/TripletexSubNav";
import { formatDateTimeNO } from "@/lib/date/format";
import type { WebhookEventRow } from "@/lib/superadmin/tripletexAdminData";

function fmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return formatDateTimeNO(iso);
  } catch {
    return "—";
  }
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

export default function TripletexWebhooksClient({
  rows,
  status,
  eventType,
}: {
  rows: WebhookEventRow[];
  status: string;
  eventType: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const statusOptions = useMemo(() => ["ALL", "PENDING", "PROCESSED", "FAILED", "IGNORED"], []);

  function applyFilters(next: { status?: string; event_type?: string }) {
    const p = new URLSearchParams(searchParams?.toString() ?? "");
    if (next.status !== undefined) {
      if (next.status === "ALL") p.delete("status");
      else p.set("status", next.status);
    }
    if (next.event_type !== undefined) {
      if (!next.event_type.trim()) p.delete("event_type");
      else p.set("event_type", next.event_type.trim());
    }
    startTransition(() => router.push(`/superadmin/tripletex/webhooks?${p.toString()}`));
  }

  async function retryRow(id: string) {
    setErr("");
    setMsg("");
    setRetryingId(id);
    const res = await fetch("/api/superadmin/tripletex/webhooks/retry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await readJson(res);
    setRetryingId(null);
    if (!res.ok) {
      setErr(String(json?.message ?? "Retry feilet."));
      return;
    }
    setMsg("Webhook reprosessert.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="lp-select-text mx-auto max-w-6xl">
      <header className="text-center sm:text-left">
        <p className="text-xs text-[rgb(var(--lp-muted))]">Superadmin · Tripletex</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Webhook-innsyn</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Innkommende Tripletex-callbacks (revisjon).</p>
      </header>

      <div className="mt-6">
        <TripletexSubNav activePath="/superadmin/tripletex/webhooks" />
      </div>

      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Status</span>
          <select
            className="min-h-[48px] rounded-2xl border bg-white px-3"
            value={status}
            onChange={(e) => applyFilters({ status: e.target.value })}
            disabled={pending}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <form
          className="grid flex-1 gap-1 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            applyFilters({ event_type: String(fd.get("event_type") ?? "") });
          }}
        >
          <span className="font-medium">Event type</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              name="event_type"
              className="min-h-[48px] w-full flex-1 rounded-2xl border bg-white px-3"
              defaultValue={eventType}
              placeholder="f.eks. invoice.charged"
              disabled={pending}
            />
            <button type="submit" className="ds-btn ds-btn--secondary min-h-[48px]" disabled={pending}>
              Filtrer
            </button>
          </div>
        </form>
      </div>

      {msg ? <p className="mt-4 text-sm font-medium text-emerald-800">{msg}</p> : null}
      {err ? <p className="mt-4 text-sm font-medium text-red-800">{err}</p> : null}

      <div className="mt-6 hidden overflow-x-auto rounded-2xl border bg-white md:block">
        <table className="lp-table min-w-full text-sm">
          <thead>
            <tr>
              <th>Mottatt</th>
              <th>Event</th>
              <th>Status</th>
              <th>Prosessert</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{fmt(row.received_at)}</td>
                <td className="max-w-[240px] break-all font-mono text-xs">{row.event_type}</td>
                <td>
                  <TripletexStatusBadge status={row.status} />
                </td>
                <td>{fmt(row.processed_at)}</td>
                <td className="text-right">
                  {row.status === "FAILED" ? (
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
            title={row.event_type}
            subtitle={row.event_id}
            badge={<TripletexStatusBadge status={row.status} />}
            meta={
              <>
                <p>Mottatt: {fmt(row.received_at)}</p>
                <p>Prosessert: {fmt(row.processed_at)}</p>
                {row.error_detail ? <p className="text-red-800">{row.error_detail}</p> : null}
              </>
            }
            actions={
              row.status === "FAILED" ? (
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
        <p className="mt-8 text-center text-sm text-[rgb(var(--lp-muted))]">Ingen webhook-hendelser for filteret.</p>
      ) : null}
    </div>
  );
}
