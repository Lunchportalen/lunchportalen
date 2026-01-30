"use client";

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
  if (!d) return "—";
  return new Date(d).toLocaleDateString("nb-NO");
}

function fmtNOK(v: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(v);
}

function statusBadge(s: Invoice["status"]) {
  if (s === "paid") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (s === "sent") return "bg-blue-50 text-blue-800 ring-blue-200";
  if (s === "overdue") return "bg-rose-50 text-rose-800 ring-rose-200";
  return "bg-neutral-50 text-neutral-700 ring-neutral-200";
}

export default async function InvoicesCard({ companyId }: Props) {
  const res = await fetch(
    `/api/superadmin/companies/invoices?companyId=${encodeURIComponent(companyId)}`,
    { cache: "no-store" }
  );

  const json = await res.json();
  if (!json?.ok) {
    return (
      <div className="rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-semibold">Fakturaer</div>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Kunne ikke hente fakturahistorikk.</p>
      </div>
    );
  }

  const invoices: Invoice[] = json.invoices ?? [];

  return (
    <div className="rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="text-sm font-semibold">Fakturaer</div>
      <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
        Historikk per avtaleperiode. Kun lesetilgang.
      </div>

      {invoices.length === 0 ? (
        <div className="mt-4 text-sm text-[rgb(var(--lp-muted))]">Ingen fakturaer ennå.</div>
      ) : (
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
              {invoices.map((i) => (
                <tr key={i.id} className="border-t border-[rgb(var(--lp-border))]">
                  <td className="py-2">
                    {fmtDate(i.period_start)} – {fmtDate(i.period_end)}
                  </td>
                  <td className="py-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs ring-1 ${statusBadge(
                        i.status
                      )}`}
                    >
                      {i.status.toUpperCase()}
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
      )}
    </div>
  );
}
