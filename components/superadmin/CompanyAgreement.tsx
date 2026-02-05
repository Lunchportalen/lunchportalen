// components/superadmin/CompanyAgreement.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateNO } from "@/lib/date/format";

type AgreementStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "DRAFT";

export type CompanyAgreementRow = {
  id: string;
  company_id: string;

  start_date: string | null; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD
  binding_months: number | null; // f.eks 12
  notice_months: number | null; // f.eks 3

  status: AgreementStatus | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ApiOk = { ok: true; agreement: CompanyAgreementRow | null };
type ApiErr = { ok: false; error: string };

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function toOsloDateLabel(iso: string | null) {
  if (!iso) return "—";
  if (!isISODate(iso)) return iso;
  return formatDateNO(iso);
}

function dateToISO(d: Date | null) {
  if (!d) return null;
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number) {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);

  // clamp (month rollover safety)
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function parseISODate(iso: string | null): Date | null {
  if (!iso) return null;
  if (!isISODate(iso)) return null;
  const [y, m, d] = iso.split("-").map((v) => Number(v));
  if (!y || !m || !d) return null;
  // use noon to avoid DST edgecases
  return new Date(y, m - 1, d, 12, 0, 0);
}

function daysBetween(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function statusLabel(s: AgreementStatus | null) {
  if (s === "ACTIVE") return "Aktiv";
  if (s === "CANCELLED") return "Kansellert";
  if (s === "EXPIRED") return "Utløpt";
  if (s === "DRAFT") return "Utkast";
  return "—";
}

function statusChipClass(s: AgreementStatus | null) {
  if (s === "ACTIVE") return "lp-chip";
  if (s === "DRAFT") return "lp-chip lp-chip-warn";
  if (s === "EXPIRED") return "lp-chip lp-chip-crit";
  if (s === "CANCELLED") return "lp-chip lp-chip-crit";
  return "lp-chip";
}

export default function CompanyAgreement({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [agreement, setAgreement] = useState<CompanyAgreementRow | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(`/api/admin/agreements?companyId=${encodeURIComponent(companyId)}`, {
          method: "GET",
          cache: "no-store",
        });

        const json = (await res.json()) as ApiOk | ApiErr;

        if (!alive) return;

        if (!res.ok || !("ok" in json) || json.ok === false) {
          const msg = "error" in json ? json.error : "Kunne ikke hente avtale";
          throw new Error(msg);
        }

        setAgreement(json.agreement ?? null);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Kunne ikke hente avtale");
        setAgreement(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [companyId]);

  const derived = useMemo(() => {
    const start = parseISODate(agreement?.start_date ?? null);
    const end = parseISODate(agreement?.end_date ?? null);

    const bindingMonths = agreement?.binding_months ?? 12;
    const noticeMonths = agreement?.notice_months ?? 3;

    // If end_date is missing: compute from start + binding
    const computedEnd =
      end ??
      (start ? addMonths(start, bindingMonths) : null);

    // Remaining binding
    const now = new Date();
    const remainingDays =
      computedEnd ? Math.max(0, daysBetween(now, computedEnd)) : null;

    // Notice deadline (latest cancellation date to end at computedEnd)
    const noticeDeadline =
      computedEnd ? addMonths(computedEnd, -noticeMonths) : null;

    return {
      start,
      end: computedEnd,
      bindingMonths,
      noticeMonths,
      remainingDays,
      noticeDeadline,
    };
  }, [agreement]);

  return (
    <div className="lp-card">
      <div className="lp-card-head flex items-start justify-between gap-3">
        <div>
          <h3 className="lp-h3">Avtale</h3>
          <p className="lp-muted">Firmakontroll (binding, oppsigelse, status)</p>
        </div>

        <div className={statusChipClass(agreement?.status ?? null)}>
          {statusLabel(agreement?.status ?? null)}
        </div>
      </div>

      <div className="lp-card-body">
        {loading && <div className="lp-muted">Henter avtale…</div>}

        {!loading && err && <div className="text-sm text-red-700">{err}</div>}

        {!loading && !err && !agreement && (
          <div className="lp-empty">
            Ingen avtale registrert for dette firmaet ennå.
          </div>
        )}

        {!loading && !err && agreement && (
          <div className="grid gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="lp-kv">
                <div className="lp-k">Startdato</div>
                <div className="lp-v">{toOsloDateLabel(agreement.start_date)}</div>
              </div>

              <div className="lp-kv">
                <div className="lp-k">Sluttdato</div>
                <div className="lp-v">{toOsloDateLabel(agreement.end_date ?? dateToISO(derived.end))}</div>
              </div>

              <div className="lp-kv">
                <div className="lp-k">Bindingstid</div>
                <div className="lp-v">{derived.bindingMonths} mnd</div>
              </div>

              <div className="lp-kv">
                <div className="lp-k">Oppsigelse</div>
                <div className="lp-v">{derived.noticeMonths} mnd</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="lp-kv">
                <div className="lp-k">Gjenstående bindingstid</div>
                <div className="lp-v">
                  {derived.remainingDays === null ? "—" : `${derived.remainingDays} dager`}
                </div>
              </div>

              <div className="lp-kv">
                <div className="lp-k">Siste frist for oppsigelse (for å treffe sluttdato)</div>
                <div className="lp-v">
                  {derived.noticeDeadline ? formatDateNO(dateToISO(derived.noticeDeadline) ?? "") : "—"}
                </div>
              </div>
            </div>

            <div className="lp-muted text-xs">
              CompanyId: {companyId} • AgreementId: {agreement.id}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
