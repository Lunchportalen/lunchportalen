"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";

import TripletexMobileRowCard from "@/components/superadmin/tripletex/TripletexMobileRowCard";
import TripletexStatusBadge from "@/components/superadmin/tripletex/TripletexStatusBadge";
import TripletexSubNav from "@/components/superadmin/tripletex/TripletexSubNav";
import type { ProviderInvoiceRow } from "@/lib/superadmin/tripletexAdminData";

function formatNok(amount: number) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK" }).format(amount);
}

export default function TripletexInvoicesClient({
  rows,
  status,
  period,
  tripletexLinks,
}: {
  rows: ProviderInvoiceRow[];
  status: string;
  period: string;
  tripletexLinks: Record<string, string | null>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const statusOptions = useMemo(() => ["ALL", "DRAFT", "SENT", "PAID", "OVERDUE", "VOID"], []);
  const periodOptions = useMemo(
    () => [
      { id: "current", label: "Inneværende måned" },
      { id: "3m", label: "Siste 3 måneder" },
    ],
    [],
  );

  function applyFilters(next: { status?: string; period?: string }) {
    const p = new URLSearchParams(searchParams?.toString() ?? "");
    if (next.status !== undefined) {
      if (next.status === "ALL") p.delete("status");
      else p.set("status", next.status);
    }
    if (next.period !== undefined) p.set("period", next.period);
    startTransition(() => router.push(`/superadmin/tripletex/invoices?${p.toString()}`));
  }

  return (
    <div className="lp-select-text mx-auto max-w-6xl">
      <header className="text-center sm:text-left">
        <p className="text-xs text-[rgb(var(--lp-muted))]">Superadmin · Tripletex</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">SaaS-fakturaer</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Provider_invoices (Flow A).</p>
      </header>

      <div className="mt-6">
        <TripletexSubNav activePath="/superadmin/tripletex/invoices" />
      </div>

      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap">
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
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Periode</span>
          <select
            className="min-h-[48px] rounded-2xl border bg-white px-3"
            value={period}
            onChange={(e) => applyFilters({ period: e.target.value })}
            disabled={pending}
          >
            {periodOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 hidden overflow-x-auto rounded-2xl border bg-white md:block">
        <table className="lp-table min-w-full text-sm">
          <thead>
            <tr>
              <th>Faktura</th>
              <th>Leverandør</th>
              <th>Periode</th>
              <th>Beløp</th>
              <th>Status</th>
              <th>Tripletex</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const ttUrl = tripletexLinks[row.id] ?? null;
              return (
                <tr key={row.id}>
                  <td className="font-medium">{row.invoice_number ?? row.id.slice(0, 8)}</td>
                  <td>
                    <Link href={`/superadmin/providers/${row.provider_id}/billing`} className="underline">
                      {row.provider_name}
                    </Link>
                  </td>
                  <td>{row.invoice_period}</td>
                  <td>{formatNok(row.amount_total)}</td>
                  <td>
                    <TripletexStatusBadge status={row.status} />
                  </td>
                  <td>
                    {ttUrl ? (
                      <a href={ttUrl} target="_blank" rel="noopener noreferrer" className="ds-btn ds-btn--secondary min-h-[48px]">
                        Åpne
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-3 md:hidden">
        {rows.map((row) => {
          const ttUrl = tripletexLinks[row.id] ?? null;
          return (
            <TripletexMobileRowCard
              key={row.id}
              title={row.invoice_number ?? "Faktura"}
              subtitle={row.provider_name}
              badge={<TripletexStatusBadge status={row.status} />}
              meta={
                <>
                  <p>Periode: {row.invoice_period}</p>
                  <p>{formatNok(row.amount_total)}</p>
                </>
              }
              actions={
                ttUrl ? (
                  <a href={ttUrl} target="_blank" rel="noopener noreferrer" className="ds-btn ds-btn--primary min-h-[48px]">
                    Tripletex
                  </a>
                ) : null
              }
            />
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-[rgb(var(--lp-muted))]">Ingen fakturaer for filteret.</p>
      ) : null}
    </div>
  );
}
