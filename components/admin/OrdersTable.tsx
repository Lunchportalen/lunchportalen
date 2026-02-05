"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { formatDateNO, formatTimeNO } from "@/lib/date/format";

type OrderRow = {
  id: string;
  user_id: string;
  note: string | null;
  created_at: string;
  updated_at?: string | null;
  company_id: string;
  location_id: string | null;
  slot: string | null;
  date: string; // ISO (YYYY-MM-DD) fra API
  status: string;
  companies?: { id: string; name: string } | null;
  company_locations?: {
    id: string;
    name: string | null;
    label: string | null;
    address: string | null;
    address_line1: string | null;
    postal_code: string | null;
    city: string | null;
    delivery_json?: any;
  } | null;
};

type Api = {
  ok: boolean;
  rid?: string;

  dateISO?: string;
  dateNO?: string; // DD-MM-YYYY
  date?: string; // fallback hvis du bruker "date"

  status?: string;
  count?: number;
  orders?: OrderRow[];

  error?: string;
  detail?: any;
  message?: string;
};

function isoTodayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoToNO(iso: string) {
  return formatDateNO(iso);
}

function safeString(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

async function fetchAdminOrders(dateISO: string, status: string) {
  const u = new URL("/api/admin/orders", window.location.origin);
  u.searchParams.set("date", dateISO);
  if (status) u.searchParams.set("status", status);

  const r = await fetch(u.pathname + u.search, { cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as Api;

  if (!r.ok || !j?.ok) {
    const msg =
      j?.message ||
      j?.error ||
      (typeof j?.detail === "string" ? j.detail : null) ||
      "Kunne ikke hente ordrer";
    throw new Error(msg);
  }
  return j;
}

function downloadCsv(dateISO: string, status: string) {
  const u = new URL("/api/admin/orders/export", window.location.origin);
  u.searchParams.set("date", dateISO);
  if (status) u.searchParams.set("status", status);

  window.location.href = u.pathname + u.search;
}

function fmtTime(ts: string | null | undefined) {
  if (!ts) return "—";
  const t = formatTimeNO(ts);
  return t || "—";
}

export default function OrdersTable() {
  const [dateISO, setDateISO] = useState<string>(isoTodayLocal());
  const [status, setStatus] = useState<string>("ACTIVE");

  const [data, setData] = useState<Api | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Dashboard counts for selected date (ACTIVE + CANCELLED)
  const [countActive, setCountActive] = useState<number>(0);
  const [countCancelled, setCountCancelled] = useState<number>(0);

  const dateLabel = useMemo(() => {
    const fromApi = data?.dateNO || (data?.dateISO ? isoToNO(data.dateISO) : null);
    return fromApi || isoToNO(dateISO);
  }, [data, dateISO]);

  const orders = data?.orders ?? [];
  const count = data?.count ?? orders.length;

  const subtitle = useMemo(() => {
    const rid = data?.rid ? ` · rid: ${data.rid}` : "";
    return `${count} ordre${rid}`;
  }, [count, data?.rid]);

  function load() {
    startTransition(async () => {
      try {
        setErr(null);

        // Table = selected status
        const tableP = fetchAdminOrders(dateISO, status);

        // Dashboard cards = always ACTIVE + CANCELLED on same date
        const activeP = fetchAdminOrders(dateISO, "ACTIVE").then((r) => Number(r.count ?? (r.orders?.length ?? 0)));
        const cancelledP = fetchAdminOrders(dateISO, "CANCELLED").then((r) =>
          Number(r.count ?? (r.orders?.length ?? 0))
        );

        const [tableRes, a, c] = await Promise.all([tableP, activeP, cancelledP]);

        setData(tableRes);
        setCountActive(a);
        setCountCancelled(c);
      } catch (e: any) {
        setErr(e?.message || "Feil ved henting");
        setData(null);
        setCountActive(0);
        setCountCancelled(0);
      }
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO, status]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ordrer</h2>
          <p className="text-sm text-muted-foreground">
            Dato: <span className="font-medium">{dateLabel}</span>
            <span className="text-muted-foreground">{subtitle ? ` · ${subtitle}` : ""}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-muted-foreground">Dato</label>
            <input
              type="date"
              value={dateISO}
              onChange={(e) => setDateISO(e.target.value)}
              className="h-9 rounded-md border px-3 text-sm"
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-xs text-muted-foreground">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-md border px-3 text-sm"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="DELETED">DELETED</option>
            </select>
          </div>

          <button
            onClick={load}
            disabled={isPending}
            className="h-9 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-50"
          >
            Oppdater
          </button>

          <button
            onClick={() => downloadCsv(dateISO, status)}
            disabled={isPending}
            className="h-9 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-50"
            title="Last ned CSV for valgt dato og status"
          >
            Last ned CSV
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      )}

      {/* Dashboard cards (øverst) */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-muted-foreground">ACTIVE (dag)</div>
          <div className="mt-1 text-2xl font-semibold">{countActive}</div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-muted-foreground">CANCELLED (dag)</div>
          <div className="mt-1 text-2xl font-semibold">{countCancelled}</div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-muted-foreground">Totalt (dag)</div>
          <div className="mt-1 text-2xl font-semibold">{countActive + countCancelled}</div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-muted-foreground">Cut-off</div>
          <div className="mt-1 text-2xl font-semibold">08:00</div>
          <div className="mt-1 text-xs text-muted-foreground">Europe/Oslo · Ingen unntak</div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          Viser <span className="font-mono">{safeString(status)}</span>: {count} ordre
          {data?.rid ? <span className="text-muted-foreground">{` · rid: ${data.rid}`}</span> : null}
        </div>
        <div>Ingen unntak</div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="px-3 py-2">Tid</th>
              <th className="px-3 py-2">Firma</th>
              <th className="px-3 py-2">Lokasjon</th>
              <th className="px-3 py-2">Slot</th>
              <th className="px-3 py-2">Notat</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">OrderId</th>
            </tr>
          </thead>
          <tbody>
            {!data && !err && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Laster …
                </td>
              </tr>
            )}

            {orders.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-3 py-2">{fmtTime(o.created_at)}</td>
                <td className="px-3 py-2">{o.companies?.name || "—"}</td>
                <td className="px-3 py-2">{o.company_locations?.label || o.company_locations?.name || "—"}</td>
                <td className="px-3 py-2">{o.slot || "—"}</td>
                <td className="px-3 py-2">{o.note || "—"}</td>
                <td className="px-3 py-2">
                  <span className="rounded bg-gray-200 px-2 py-0.5 text-xs">{safeString(o.status)}</span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">{o.id}</td>
              </tr>
            ))}

            {data && orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Ingen ordrer for valgt dato/status.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer hint */}
      <div className="text-xs text-muted-foreground">
        Eksporten inkluderer valgt dato (<span className="font-mono">{dateISO}</span>) og status (
        <span className="font-mono">{status}</span>).
      </div>
    </div>
  );
}
