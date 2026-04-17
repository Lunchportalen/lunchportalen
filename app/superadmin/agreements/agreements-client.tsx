"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

type AgreementRow = {
  id: string;
  company_id: string;
  company_name: string;
  company_status?: string | null;
  location_id: string | null;
  status: string;
  tier: string;
  delivery_days: string[];
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string | null;
  updated_at: string | null;
  activated_at?: string | null;
  rejection_reason?: string | null;
  ledger_pending_agreement_id?: string | null;
  ledger_active_agreement_id?: string | null;
  pipeline_stage_label?: string;
  next_label?: string;
  next_href?: string;
};

type Initial =
  | { ok: true; agreements: AgreementRow[] }
  | { ok: false; message?: string; agreements: AgreementRow[] };

type ApiEnvelope<T> = {
  ok?: boolean;
  rid?: string;
  message?: string;
  status?: number;
  error?: string | { code?: string };
  data?: T;
};

type ListData = {
  agreements?: AgreementRow[];
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function statusLabel(status: string) {
  const s = safeStr(status).toUpperCase();
  if (s === "PENDING") return "Venter";
  if (s === "ACTIVE") return "Aktiv";
  if (s === "REJECTED") return "Avslått";
  if (s === "PAUSED") return "Pause";
  if (s === "TERMINATED") return "Avsluttet";
  return s || "Ukjent";
}

function companyStatusLabel(raw: string | null | undefined) {
  const s = safeStr(raw).toUpperCase();
  if (s === "ACTIVE") return "Aktiv";
  if (s === "PENDING") return "Venter";
  if (s === "PAUSED") return "Pauset";
  if (s === "CLOSED") return "Stengt";
  return s || "—";
}

function companyStatusPillClass(raw: string | null | undefined) {
  const s = safeStr(raw).toUpperCase();
  if (s === "ACTIVE") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
  if (s === "PENDING") return "bg-neutral-50 text-neutral-800 ring-1 ring-neutral-200";
  if (s === "PAUSED") return "bg-yellow-50 text-yellow-900 ring-1 ring-yellow-200";
  if (s === "CLOSED") return "bg-red-50 text-red-900 ring-1 ring-red-200";
  return "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200";
}

function formatTs(v: string | null) {
  if (!v) return "-";
  return v.replace("T", " ").replace("Z", "");
}

type StatusFilter = "PENDING" | "ACTIVE" | "REJECTED" | "PAUSED" | "ALL";

export default function AgreementsClient({ initial }: { initial: Initial }) {
  const [rows, setRows] = useState<AgreementRow[]>(initial.agreements ?? []);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("PENDING");

  const initialMessage = "message" in initial && typeof initial.message === "string" ? initial.message : "";
  const [msg, setMsg] = useState<string>(initial.ok ? "" : initialMessage);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      const s = safeStr(r.status).toUpperCase();
      const matchStatus =
        status === "ALL"
          ? true
          : status === "REJECTED"
            ? s === "REJECTED" || s === "TERMINATED"
            : s === status;

      const matchQ =
        !qq ||
        safeStr(r.company_name).toLowerCase().includes(qq) ||
        safeStr(r.company_id).toLowerCase().includes(qq) ||
        safeStr(r.id).toLowerCase().includes(qq);

      return matchStatus && matchQ;
    });
  }, [rows, q, status]);

  const loadRows = useCallback((forStatus: StatusFilter) => {
    setMsg("");
    startTransition(async () => {
      try {
        const sp = new URLSearchParams();
        sp.set("limit", "200");
        if (forStatus !== "ALL") {
          sp.set("status", forStatus === "REJECTED" ? "REJECTED" : forStatus);
        }

        const res = await fetch(`/api/superadmin/agreements/list?${sp.toString()}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ApiEnvelope<ListData> | null;

        if (!res.ok || !json?.ok) {
          setMsg(json?.message || "Kunne ikke hente avtaler.");
          return;
        }

        const list = Array.isArray(json.data?.agreements) ? json.data!.agreements! : [];
        setRows(list as AgreementRow[]);
      } catch {
        setMsg("Kunne ikke hente avtaler.");
      }
    });
  }, []);

  const skipStatusEffect = useRef(true);
  useEffect(() => {
    if (skipStatusEffect.current) {
      skipStatusEffect.current = false;
      return;
    }
    loadRows(status);
  }, [status, loadRows]);

  function refresh() {
    loadRows(status);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-amber-50 text-amber-950 ring-1 ring-amber-200/80 px-4 py-3 text-sm space-y-1">
        <p>Superadmin: godkjenn eller avslå PENDING, pause ACTIVE — alt server-side på <span className="font-mono">public.agreements</span>.</p>
        <p className="text-xs text-amber-950/90">
          Avtalestatus er adskilt fra <span className="font-mono">companies.status</span>. Ledger PAUSED har ingen definert resume-RPC i migrasjonene.
        </p>
      </div>

      <section className="lp-card lp-card--elevated">
        <div className="lp-card-pad space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Avtaler til gjennomgang</div>
              <div className="mt-1 text-sm lp-muted">{isPending ? "Oppdaterer..." : `${filtered.length} avtaler vises`}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Søk firma eller avtale"
                className="h-10 w-[240px] max-w-full rounded-xl px-3 text-sm ring-1 ring-black/10 bg-white/70"
              />

              <select
                value={status}
                onChange={(e) => {
                  const v = (e.target.value as StatusFilter) || "PENDING";
                  setStatus(v);
                }}
                className="h-10 rounded-xl px-3 text-sm ring-1 ring-black/10 bg-white/70"
              >
                <option value="PENDING">Venter</option>
                <option value="ACTIVE">Aktiv</option>
                <option value="REJECTED">Avslått / avsluttet</option>
                <option value="PAUSED">Pause</option>
                <option value="ALL">Alle</option>
              </select>

              <button type="button" onClick={refresh} disabled={isPending} className="lp-btn lp-btn--secondary">
                Oppdater
              </button>
            </div>
          </div>

          {msg ? (
            <div className="rounded-2xl bg-rose-50 text-rose-900 ring-1 ring-rose-200 p-3 text-sm">{msg}</div>
          ) : null}

          <div className="overflow-x-auto max-w-full">
            <table className="min-w-[1040px] w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-neutral-600">
                  <th className="py-2 pr-3">Avtale</th>
                  <th className="py-2 pr-3">Firma</th>
                  <th className="py-2 pr-3">Firmastatus</th>
                  <th className="py-2 pr-3">Avtalestatus</th>
                  <th className="py-2 pr-3">Start / slutt</th>
                  <th className="py-2 pr-3 max-w-[220px]">Operativ fase</th>
                  <th className="py-2 pr-3 max-w-[200px]">Neste steg</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3">Leveringsdager</th>
                  <th className="py-2 pr-3">Opprettet</th>
                  <th className="py-2 pr-3">Detaljer</th>
                </tr>
              </thead>

              <tbody className="align-top">
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-black/5">
                    <td className="py-3 pr-3">
                      <div className="font-mono text-xs text-neutral-800">{r.id}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-neutral-900">{r.company_name}</div>
                      <div className="mt-1 text-xs lp-muted break-all">{r.company_id}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={["inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", companyStatusPillClass(r.company_status)].join(
                          " "
                        )}
                      >
                        {companyStatusLabel(r.company_status)}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-black/10 bg-white/70">
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap text-xs">
                      <div>{formatTs(r.starts_at ?? null)}</div>
                      <div className="mt-0.5 lp-muted">→ {formatTs(r.ends_at ?? null)}</div>
                    </td>
                    <td className="max-w-[220px] py-3 pr-3 text-xs leading-snug text-neutral-800">
                      {safeStr(r.pipeline_stage_label) || "—"}
                    </td>
                    <td className="max-w-[200px] py-3 pr-3 text-xs">
                      <div className="text-neutral-800">{safeStr(r.next_label) || "Åpne"}</div>
                      <div className="mt-2">
                        <Link
                          href={safeStr(r.next_href) || `/superadmin/agreements/${encodeURIComponent(r.id)}`}
                          className="inline-flex rounded-xl border bg-white px-2 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                        >
                          Gå til handling →
                        </Link>
                      </div>
                    </td>

                    <td className="py-3 pr-3">{safeStr(r.tier) || "-"}</td>
                    <td className="py-3 pr-3">
                      {Array.isArray(r.delivery_days) && r.delivery_days.length > 0 ? r.delivery_days.join(", ") : "-"}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">{formatTs(r.created_at)}</td>

                    <td className="py-3 pr-3">
                      <Link href={`/superadmin/agreements/${r.id}`} className="lp-btn lp-btn--secondary inline-flex">
                        Åpne
                      </Link>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-6 text-sm lp-muted">
                      Ingen treff.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
