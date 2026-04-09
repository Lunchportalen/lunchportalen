// STATUS: KEEP

// components/superadmin/CompanyDeliveries.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type DeliveryStatus = "queued" | "packed" | "delivered" | "cancelled";

export type CompanyDeliveryRow = {
  order_id: string;
  created_at: string;

  delivery_date: string; // YYYY-MM-DD
  delivery_slot: string; // window label/slot

  full_name: string;
  department: string | null;

  note: string | null;
  status: DeliveryStatus | string;

  location_id: string | null;
  location_name: string | null;
};

type ApiOk = { ok: true; rows: CompanyDeliveryRow[] };
type ApiErr = { ok: false; error: string };

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function dateLabel(iso: string) {
  if (!isISODate(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function normalizeStatus(s: string): DeliveryStatus {
  const v = String(s || "").toLowerCase().trim();
  if (v === "packed") return "packed";
  if (v === "delivered") return "delivered";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  return "queued";
}

function statusLabel(s: DeliveryStatus) {
  if (s === "queued") return "Kø";
  if (s === "packed") return "Pakket";
  if (s === "delivered") return "Levert";
  if (s === "cancelled") return "Avbestilt";
  return "Kø";
}

function statusChipClass(s: DeliveryStatus) {
  if (s === "delivered") return "lp-chip";
  if (s === "packed") return "lp-chip lp-chip-warn";
  if (s === "cancelled") return "lp-chip lp-chip-crit";
  return "lp-chip";
}

function safeText(v: any, fallback = "—") {
  const s = String(v ?? "").trim();
  return s.length ? s : fallback;
}

export default function CompanyDeliveries({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<CompanyDeliveryRow[]>([]);

  // filters
  const [range, setRange] = useState<"7d" | "14d" | "30d">("14d");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | DeliveryStatus>("all");

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(
          `/api/admin/orders?companyId=${encodeURIComponent(companyId)}&range=${encodeURIComponent(
            range
          )}`,
          { method: "GET", cache: "no-store" }
        );

        const json = (await res.json()) as ApiOk | ApiErr;

        if (!alive) return;

        if (!res.ok || ("ok" in json && json.ok === false)) {
          const msg = "error" in json ? json.error : "Kunne ikke hente leveranser";
          throw new Error(msg);
        }

        const ok = json as ApiOk;
        setRows(ok.rows ?? []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Kunne ikke hente leveranser");
        setRows([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [companyId, range]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return rows
      .map((r) => ({
        ...r,
        status_norm: normalizeStatus(String(r.status)),
      }))
      .filter((r) => {
        if (status !== "all" && r.status_norm !== status) return false;

        if (!needle) return true;

        const hay = [
          r.delivery_date,
          r.delivery_slot,
          r.full_name,
          r.department,
          r.location_name,
          r.note,
        ]
          .map((x) => String(x ?? "").toLowerCase())
          .join(" ");

        return hay.includes(needle);
      })
      .sort((a, b) => {
        // newest first
        if (a.delivery_date !== b.delivery_date) return a.delivery_date < b.delivery_date ? 1 : -1;
        if (a.delivery_slot !== b.delivery_slot) return a.delivery_slot < b.delivery_slot ? 1 : -1;
        return a.created_at < b.created_at ? 1 : -1;
      });
  }, [rows, q, status]);

  const totals = useMemo(() => {
    const t = { queued: 0, packed: 0, delivered: 0, cancelled: 0, all: 0 };
    for (const r of rows) {
      const s = normalizeStatus(String(r.status));
      t[s] += 1;
      t.all += 1;
    }
    return t;
  }, [rows]);

  return (
    <div className="lp-card">
      <div className="lp-card-head flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="lp-h3">Leveranser</h3>
            <p className="lp-muted">Oversikt per ordre for valgt periode (superadmin).</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="lp-chip">Totalt: {totals.all}</span>
            <span className={statusChipClass("queued")}>Kø: {totals.queued}</span>
            <span className={statusChipClass("packed")}>Pakket: {totals.packed}</span>
            <span className={statusChipClass("delivered")}>Levert: {totals.delivered}</span>
            <span className={statusChipClass("cancelled")}>Avbestilt: {totals.cancelled}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              className={range === "7d" ? "lp-btn-primary" : "lp-btn"}
              onClick={() => setRange("7d")}
              disabled={loading}
              title="Siste 7 dager"
            >
              7 dager
            </button>
            <button
              className={range === "14d" ? "lp-btn-primary" : "lp-btn"}
              onClick={() => setRange("14d")}
              disabled={loading}
              title="Siste 14 dager"
            >
              14 dager
            </button>
            <button
              className={range === "30d" ? "lp-btn-primary" : "lp-btn"}
              onClick={() => setRange("30d")}
              disabled={loading}
              title="Siste 30 dager"
            >
              30 dager
            </button>

            <select
              className="lp-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              disabled={loading}
              title="Filtrer status"
            >
              <option value="all">Alle statuser</option>
              <option value="queued">Kø</option>
              <option value="packed">Pakket</option>
              <option value="delivered">Levert</option>
              <option value="cancelled">Avbestilt</option>
            </select>
          </div>

          <div className="flex gap-2">
            <input
              className="lp-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk (navn, avd, notat, dato, slot…)…"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className="lp-card-body">
        {loading && <div className="lp-muted">Henter leveranser…</div>}
        {!loading && err && <div className="text-sm text-red-700">{err}</div>}

        {!loading && !err && filtered.length === 0 && (
          <div className="lp-empty">Ingen leveranser i valgt periode.</div>
        )}

        {!loading && !err && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="lp-table">
              <thead>
                <tr>
                  <th>Dato</th>
                  <th>Vindu</th>
                  <th>Lokasjon</th>
                  <th>Navn</th>
                  <th>Avdeling</th>
                  <th>Notat</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((r) => {
                  const s = normalizeStatus(String(r.status));
                  return (
                    <tr key={r.order_id}>
                      <td className="whitespace-nowrap">{dateLabel(r.delivery_date)}</td>
                      <td className="whitespace-nowrap">{safeText(r.delivery_slot)}</td>
                      <td className="whitespace-nowrap">{safeText(r.location_name)}</td>
                      <td className="whitespace-nowrap">{safeText(r.full_name)}</td>
                      <td className="whitespace-nowrap">{safeText(r.department)}</td>
                      <td className="min-w-[260px]">{safeText(r.note, "")}</td>
                      <td className="whitespace-nowrap">
                        <span className={statusChipClass(s)}>{statusLabel(s)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="lp-muted text-xs mt-3">CompanyId: {companyId}</div>
          </div>
        )}
      </div>
    </div>
  );
}
