// components/superadmin/CompanyQuality.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTimeNO } from "@/lib/date/format";

type Severity = "info" | "warning" | "critical";
type Source = "company_admin" | "employee" | "system";

export type QualityMessageRow = {
  id: string;
  company_id: string;

  created_at: string; // ISO
  created_by_user_id: string | null;

  source: Source | string;
  severity: Severity | string;

  // structured fields (keeps it enterprise-friendly)
  category: string | null; // f.eks "for_lite_mat", "merking", "allergener"
  title: string | null;
  message: string;

  // optional context
  delivery_date: string | null; // YYYY-MM-DD
  delivery_slot: string | null;

  // workflow
  status: "open" | "in_progress" | "resolved" | "dismissed" | string;
  resolved_at: string | null;

  // display helpers (optional if API joins)
  author_name: string | null;
  author_email: string | null;
};

type ApiOk = { ok: true; rows: QualityMessageRow[] };
type ApiErr = { ok: false; error: string };

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function dateLabel(iso: string | null) {
  if (!iso) return "—";
  if (!isISODate(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function dtLabel(iso: string) {
  return formatDateTimeNO(iso);
}

function normalizeSeverity(v: string): Severity {
  const s = String(v || "").toLowerCase().trim();
  if (s === "critical") return "critical";
  if (s === "warning") return "warning";
  return "info";
}

function normalizeStatus(v: string) {
  const s = String(v || "").toLowerCase().trim();
  if (s === "resolved") return "resolved";
  if (s === "dismissed") return "dismissed";
  if (s === "in_progress" || s === "in-progress") return "in_progress";
  return "open";
}

function severityLabel(s: Severity) {
  if (s === "critical") return "Kritisk";
  if (s === "warning") return "Viktig";
  return "Info";
}

function severityChipClass(s: Severity) {
  if (s === "critical") return "lp-chip lp-chip-crit";
  if (s === "warning") return "lp-chip lp-chip-warn";
  return "lp-chip";
}

function statusLabel(s: string) {
  if (s === "open") return "Åpen";
  if (s === "in_progress") return "Pågår";
  if (s === "resolved") return "Løst";
  if (s === "dismissed") return "Lukket";
  return s || "—";
}

function statusChipClass(s: string) {
  if (s === "resolved") return "lp-chip";
  if (s === "dismissed") return "lp-chip lp-chip-crit";
  if (s === "in_progress") return "lp-chip lp-chip-warn";
  return "lp-chip";
}

function safeText(v: any, fallback = "—") {
  const s = String(v ?? "").trim();
  return s.length ? s : fallback;
}

export default function CompanyQuality({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<QualityMessageRow[]>([]);

  // filters
  const [range, setRange] = useState<"30d" | "90d" | "all">("90d");
  const [q, setQ] = useState("");
  const [sev, setSev] = useState<"all" | Severity>("all");
  const [st, setSt] = useState<"all" | "open" | "in_progress" | "resolved" | "dismissed">("all");

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(
          `/api/admin/quality?companyId=${encodeURIComponent(companyId)}&range=${encodeURIComponent(
            range
          )}`,
          { method: "GET", cache: "no-store" }
        );

        const json = (await res.json()) as ApiOk | ApiErr;

        if (!alive) return;

        if (!res.ok || ("ok" in json && json.ok === false)) {
          const msg = "error" in json ? json.error : "Kunne ikke hente kvalitetsmeldinger";
          throw new Error(msg);
        }

        const ok = json as ApiOk;
        setRows(ok.rows ?? []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Kunne ikke hente kvalitetsmeldinger");
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
        severity_norm: normalizeSeverity(String(r.severity)),
        status_norm: normalizeStatus(String(r.status)),
      }))
      .filter((r) => {
        if (sev !== "all" && r.severity_norm !== sev) return false;
        if (st !== "all" && r.status_norm !== st) return false;

        if (!needle) return true;

        const hay = [
          r.category,
          r.title,
          r.message,
          r.delivery_date,
          r.delivery_slot,
          r.author_name,
          r.author_email,
          r.source,
        ]
          .map((x) => String(x ?? "").toLowerCase())
          .join(" ");

        return hay.includes(needle);
      })
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [rows, q, sev, st]);

  const totals = useMemo(() => {
    const t = { all: 0, info: 0, warning: 0, critical: 0, open: 0, in_progress: 0, resolved: 0, dismissed: 0 };
    for (const r of rows) {
      const s = normalizeSeverity(String(r.severity));
      const st2 = normalizeStatus(String(r.status));
      t.all += 1;
      (t as any)[s] += 1;
      (t as any)[st2] += 1;
    }
    return t;
  }, [rows]);

  return (
    <div className="lp-card">
      <div className="lp-card-head flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="lp-h3">Kvalitet</h3>
            <p className="lp-muted">Strukturerte kvalitetsmeldinger knyttet til firma og leveranse.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="lp-chip">Totalt: {totals.all}</span>
            <span className={severityChipClass("info")}>Info: {totals.info}</span>
            <span className={severityChipClass("warning")}>Viktig: {totals.warning}</span>
            <span className={severityChipClass("critical")}>Kritisk: {totals.critical}</span>

            <span className={statusChipClass("open")}>Åpen: {totals.open}</span>
            <span className={statusChipClass("in_progress")}>Pågår: {totals.in_progress}</span>
            <span className={statusChipClass("resolved")}>Løst: {totals.resolved}</span>
            <span className={statusChipClass("dismissed")}>Lukket: {totals.dismissed}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              className={range === "30d" ? "lp-btn-primary" : "lp-btn"}
              onClick={() => setRange("30d")}
              disabled={loading}
              title="Siste 30 dager"
            >
              30 dager
            </button>
            <button
              className={range === "90d" ? "lp-btn-primary" : "lp-btn"}
              onClick={() => setRange("90d")}
              disabled={loading}
              title="Siste 90 dager"
            >
              90 dager
            </button>
            <button
              className={range === "all" ? "lp-btn-primary" : "lp-btn"}
              onClick={() => setRange("all")}
              disabled={loading}
              title="Alle meldinger"
            >
              Alle
            </button>

            <select
              className="lp-input"
              value={sev}
              onChange={(e) => setSev(e.target.value as any)}
              disabled={loading}
              title="Filter alvorlighet"
            >
              <option value="all">Alle alvorligheter</option>
              <option value="info">Info</option>
              <option value="warning">Viktig</option>
              <option value="critical">Kritisk</option>
            </select>

            <select
              className="lp-input"
              value={st}
              onChange={(e) => setSt(e.target.value as any)}
              disabled={loading}
              title="Filter status"
            >
              <option value="all">Alle statuser</option>
              <option value="open">Åpen</option>
              <option value="in_progress">Pågår</option>
              <option value="resolved">Løst</option>
              <option value="dismissed">Lukket</option>
            </select>
          </div>

          <div className="flex gap-2">
            <input
              className="lp-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk (kategori, tekst, dato, forfatter)…"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className="lp-card-body">
        {loading && <div className="lp-muted">Henter kvalitetsmeldinger…</div>}
        {!loading && err && <div className="text-sm text-red-700">{err}</div>}

        {!loading && !err && filtered.length === 0 && (
          <div className="lp-empty">Ingen kvalitetsmeldinger i valgt periode.</div>
        )}

        {!loading && !err && filtered.length > 0 && (
          <div className="grid gap-3">
            {filtered.map((r) => {
              const sev2 = normalizeSeverity(String(r.severity));
              const st2 = normalizeStatus(String(r.status));
              return (
                <div key={r.id} className="lp-card lp-card-sub">
                  <div className="lp-card-head flex items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={severityChipClass(sev2)}>{severityLabel(sev2)}</span>
                        <span className={statusChipClass(st2)}>{statusLabel(st2)}</span>

                        {r.category && <span className="lp-chip">{safeText(r.category)}</span>}

                        {r.delivery_date && (
                          <span className="lp-chip">
                            {dateLabel(r.delivery_date)}
                            {r.delivery_slot ? ` • ${safeText(r.delivery_slot)}` : ""}
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-semibold">
                        {safeText(r.title, "Kvalitetsmelding")}
                      </div>

                      <div className="lp-muted text-xs">
                        {dtLabel(r.created_at)}
                        {" • "}
                        {safeText(r.author_name, "Ukjent")}
                        {r.author_email ? ` (${r.author_email})` : ""}
                        {" • "}
                        Kilde: {safeText(r.source)}
                      </div>
                    </div>
                  </div>

                  <div className="lp-card-body">
                    <div className="text-sm whitespace-pre-wrap">{safeText(r.message, "")}</div>
                  </div>
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
