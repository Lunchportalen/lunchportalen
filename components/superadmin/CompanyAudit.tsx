// components/superadmin/CompanyAudit.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTimeNO } from "@/lib/date/format";

type AuditAction =
  | "company.status_changed"
  | "company.updated"
  | "invite.created"
  | "invite.revoked"
  | "user.activated"
  | "user.deactivated"
  | "user.role_changed"
  | "order.packed"
  | "order.unpacked"
  | "order.delivered"
  | "order.undelivered"
  | "quality.created"
  | "quality.updated"
  | "system";

export type AuditRow = {
  id: string;
  company_id: string;

  created_at: string; // ISO
  action: AuditAction | string;

  actor_user_id: string | null;
  actor_role: string | null;
  actor_email: string | null;

  // optional human readable
  title: string | null;
  detail: string | null;

  // optional structured payload (API may serialize JSON)
  meta: any;

  // optional join fields
  actor_name: string | null;
};

type ApiOk = { ok: true; rows: AuditRow[] };
type ApiErr = { ok: false; error: string };

function dtLabel(iso: string) {
  return formatDateTimeNO(iso);
}

function safeText(v: any, fallback = "—") {
  const s = String(v ?? "").trim();
  return s.length ? s : fallback;
}

function normalizeAction(a: string) {
  return String(a || "").trim();
}

function actionLabel(a: string) {
  const v = normalizeAction(a);
  if (v === "company.status_changed") return "Firma: status endret";
  if (v === "company.updated") return "Firma: oppdatert";
  if (v === "invite.created") return "Invitasjon: opprettet";
  if (v === "invite.revoked") return "Invitasjon: trukket tilbake";
  if (v === "user.activated") return "Bruker: aktivert";
  if (v === "user.deactivated") return "Bruker: deaktivert";
  if (v === "user.role_changed") return "Bruker: rolle endret";
  if (v === "order.packed") return "Ordre: pakket";
  if (v === "order.unpacked") return "Ordre: pakkestatus fjernet";
  if (v === "order.delivered") return "Ordre: levert";
  if (v === "order.undelivered") return "Ordre: leveringsstatus fjernet";
  if (v === "quality.created") return "Kvalitet: melding opprettet";
  if (v === "quality.updated") return "Kvalitet: melding oppdatert";
  return v || "—";
}

function chipClassForAction(a: string) {
  const v = normalizeAction(a);
  if (v.includes("deactivated") || v.includes("revoked") || v.includes("closed")) return "lp-chip lp-chip-crit";
  if (v.includes("status_changed") || v.includes("role_changed")) return "lp-chip lp-chip-warn";
  return "lp-chip";
}

function prettyJson(meta: any) {
  if (meta == null) return null;
  try {
    if (typeof meta === "string") {
      // try parse json string
      const t = meta.trim();
      if (t.startsWith("{") || t.startsWith("[")) return JSON.stringify(JSON.parse(t), null, 2);
      return meta;
    }
    return JSON.stringify(meta, null, 2);
  } catch {
    return String(meta);
  }
}

export default function CompanyAudit({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<AuditRow[]>([]);

  // filters
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [q, setQ] = useState("");
  const [action, setAction] = useState<"all" | string>("all");
  const [showMeta, setShowMeta] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(
          `/api/admin/audit?companyId=${encodeURIComponent(companyId)}&range=${encodeURIComponent(range)}`,
          { method: "GET", cache: "no-store" }
        );

        const json = (await res.json()) as ApiOk | ApiErr;

        if (!alive) return;

        if (!res.ok || ("ok" in json && json.ok === false)) {
          const msg = "error" in json ? json.error : "Kunne ikke hente audit";
          throw new Error(msg);
        }

        const ok = json as ApiOk;
        setRows(ok.rows ?? []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Kunne ikke hente audit");
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

  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(normalizeAction(String(r.action)));
    return Array.from(set.values()).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return rows
      .filter((r) => (action === "all" ? true : normalizeAction(String(r.action)) === action))
      .filter((r) => {
        if (!needle) return true;

        const metaStr = showMeta ? prettyJson(r.meta) : "";
        const hay = [
          r.action,
          r.title,
          r.detail,
          r.actor_email,
          r.actor_role,
          r.actor_name,
          metaStr,
        ]
          .map((x) => String(x ?? "").toLowerCase())
          .join(" ");

        return hay.includes(needle);
      })
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [rows, q, action, showMeta]);

  return (
    <div className="lp-card">
      <div className="lp-card-head flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="lp-h3">Firma-audit</h3>
            <p className="lp-muted">Hvem endret hva – og når (enterprise audit trail).</p>
          </div>

          <div className="lp-chip">Hendelser: {rows.length}</div>
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              className={range === "7d" ? "lp-btn-primary" : "lp-btn"}
              onClick={() => setRange("7d")}
              disabled={loading}
            >
              7 dager
            </button>
            <button
              className={range === "30d" ? "lp-btn-primary" : "lp-btn"}
              onClick={() => setRange("30d")}
              disabled={loading}
            >
              30 dager
            </button>
            <button
              className={range === "90d" ? "lp-btn-primary" : "lp-btn"}
              onClick={() => setRange("90d")}
              disabled={loading}
            >
              90 dager
            </button>

            <select
              className="lp-input"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              disabled={loading}
              title="Filter handling"
            >
              <option value="all">Alle handlinger</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {actionLabel(a)}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showMeta}
                onChange={(e) => setShowMeta(e.target.checked)}
                disabled={loading}
              />
              Vis meta
            </label>
          </div>

          <div className="flex gap-2">
            <input
              className="lp-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk (handling, bruker, tekst)…"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className="lp-card-body">
        {loading && <div className="lp-muted">Henter audit…</div>}
        {!loading && err && <div className="text-sm text-red-700">{err}</div>}

        {!loading && !err && filtered.length === 0 && (
          <div className="lp-empty">Ingen audit-hendelser i valgt periode.</div>
        )}

        {!loading && !err && filtered.length > 0 && (
          <div className="grid gap-3">
            {filtered.map((r) => {
              const metaText = showMeta ? prettyJson(r.meta) : null;

              return (
                <div key={r.id} className="lp-card lp-card-sub">
                  <div className="lp-card-head flex items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={chipClassForAction(String(r.action))}>
                          {actionLabel(String(r.action))}
                        </span>
                        <span className="lp-chip">{dtLabel(r.created_at)}</span>
                        {r.actor_role && <span className="lp-chip">{safeText(r.actor_role)}</span>}
                      </div>

                      <div className="lp-muted text-xs">
                        Utført av: {safeText(r.actor_name, "Ukjent")}
                        {r.actor_email ? ` (${r.actor_email})` : ""}
                      </div>

                      {(r.title || r.detail) && (
                        <div className="text-sm">
                          <div className="font-semibold">{safeText(r.title, "")}</div>
                          {r.detail && <div className="lp-muted">{safeText(r.detail, "")}</div>}
                        </div>
                      )}
                    </div>
                  </div>

                  {showMeta && metaText && (
                    <div className="lp-card-body">
                      <pre className="text-xs whitespace-pre-wrap">{metaText}</pre>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="lp-muted text-xs">CompanyId: {companyId}</div>
          </div>
        )}
      </div>
    </div>
  );
}
