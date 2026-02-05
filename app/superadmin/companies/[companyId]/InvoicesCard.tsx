"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateNO } from "@/lib/date/format";

type Invoice = {
  id: string;
  period_start: string;
  period_end: string;
  status: "draft" | "sent" | "paid" | "overdue";
  amount_ex_vat: number;
  amount_inc_vat: number;
  created_at: string;
};

type Props = {
  companyId: string;
};

function fmtDate(d?: string) {
  if (!d) return "â";
  return formatDateNO(d);
}

function fmtNOK(v: number) {
  try {
    return new Intl.NumberFormat("nb-NO", {
      style: "currency",
      currency: "NOK",
      maximumFractionDigits: 0,
    }).format(Number.isFinite(v) ? v : 0);
  } catch {
    return `${Math.round(Number.isFinite(v) ? v : 0)} kr`;
  }
}

function statusBadge(s: Invoice["status"]) {
  if (s === "paid") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (s === "sent") return "bg-blue-50 text-blue-800 ring-blue-200";
  if (s === "overdue") return "bg-rose-50 text-rose-800 ring-rose-200";
  return "bg-neutral-50 text-neutral-700 ring-neutral-200";
}

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; invoices: Invoice[] };

async function readJsonSafe(res: Response) {
  try {
    const t = await res.text();
    if (!t) return null;
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function normalizeInvoices(json: any): Invoice[] {
  // StÃ¸tt bÃ¥de:
  // - { ok:true, invoices:[...] }
  // - { ok:true, data:{ invoices:[...] } }
  const list = json?.invoices ?? json?.data?.invoices ?? [];
  return Array.isArray(list) ? (list as Invoice[]) : [];
}

export default function InvoicesCard({ companyId }: Props) {
  const [state, setState] = useState<LoadState>({ kind: "idle" });

  const url = useMemo(() => {
    const cid = encodeURIComponent(companyId || "");
    return `/api/superadmin/companies/invoices?companyId=${cid}`;
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setState({ kind: "error", message: "Mangler companyId." });
      return;
    }

    let alive = true;
    setState({ kind: "loading" });

    (async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const json = await readJsonSafe(res);

        if (!alive) return;

        if (!res.ok) {
          setState({ kind: "error", message: `Kunne ikke hente fakturahistorikk (HTTP ${res.status}).` });
          return;
        }

        if (!json?.ok) {
          setState({ kind: "error", message: "Kunne ikke hente fakturahistorikk." });
          return;
        }

        const invoices = normalizeInvoices(json);
        setState({ kind: "ready", invoices });
      } catch {
        if (!alive) return;
        setState({ kind: "error", message: "Uventet feil ved henting av fakturahistorikk." });
      }
    })();

    return () => {
      alive = false;
    };
  }, [companyId, url]);

  return (
    <div className="rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="text-sm font-semibold">Fakturaer</div>
      <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Historikk per avtaleperiode. Kun lesetilgang.</div>

      {state.kind === "loading" ? (
        <div className="mt-4 text-sm text-[rgb(var(--lp-muted))]">Henter fakturaerâ¦</div>
      ) : state.kind === "error" ? (
        <p className="mt-4 text-sm text-[rgb(var(--lp-muted))]">{state.message}</p>
      ) : state.kind === "ready" && state.invoices.length === 0 ? (
        <div className="mt-4 text-sm text-[rgb(var(--lp-muted))]">Ingen fakturaer ennÃ¥.</div>
      ) : state.kind === "ready" ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-[rgb(var(--lp-muted))]">
              <tr>
                <th className="py-2">Periode</th>
                <th className="py-2">Status</th>
                <th className="py-2">Eks. mva</th>
                <th className="py-2">Inkl. mva</th>
                <th className="py-2">Opprettet</th>
              </tr>
            </thead>
            <tbody>
              {state.invoices.map((i) => (
                <tr key={i.id} className="border-t border-[rgb(var(--lp-border))]">
                  <td className="py-2">
                    {fmtDate(i.period_start)} â {fmtDate(i.period_end)}
                  </td>
                  <td className="py-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs ring-1 ${statusBadge(i.status)}`}>
                      {String(i.status || "draft").toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2">{fmtNOK(i.amount_ex_vat)}</td>
                  <td className="py-2">{fmtNOK(i.amount_inc_vat)}</td>
                  <td className="py-2">{fmtDate(i.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 text-sm text-[rgb(var(--lp-muted))]">â</div>
      )}
    </div>
  );
}
