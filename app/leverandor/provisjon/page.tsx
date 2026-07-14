// app/leverandor/provisjon/page.tsx — FASE 9: provider read-only provisjonsvisning.
// Viser eget provisjonsgrunnlag (5 % av netto lunsjsalg ekskl. MVA) og egne
// provisjonsfakturaer fra Lunchportalen. Ingen handlinger — oppgjør styres av
// plattformen. Ansatte har aldri tilgang (provider_viewer-gate).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { listCommissionInvoices, providerCommissionSummary } from "@/lib/billing/commissionSettlement";
import { formatDateNO } from "@/lib/date/format";

const STATUS_LABELS: Record<string, string> = {
  draft: "Utkast",
  pending: "Utstedt",
  processing: "Under behandling",
  partially_paid: "Delvis betalt",
  paid: "Betalt",
  overdue: "Forfalt",
  credited: "Kreditert",
  failed: "Feilet",
  action_required: "Krever handling",
  void: "Annullert",
};

export default async function ProviderCommissionPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Fprovisjon");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");
  const canView = await hasProviderRole(auth.user.id, provider.id, "provider_viewer");
  if (!canView) redirect("/leverandor");

  const [summary, invoices] = await Promise.all([
    providerCommissionSummary(provider.id),
    listCommissionInvoices(provider.id),
  ]);

  const nf = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const minor = (v: number) => nf.format(v / 100);

  return (
    <div className="ds-container mx-auto w-full max-w-[1100px] px-4 py-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Plattformoppgjør</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Provisjon</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Lunchportalen beregner 5&nbsp;% av netto lunsjsalg ekskl. MVA for leverte ordre. Oppgjør skjer per måned via
          faktura til deres fakturaadresse — betaling via bankoverføring.
        </p>
      </header>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Grunnlag per måned</h2>
        {summary.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-neutral-50 px-4 py-6 text-sm text-neutral-600">
            Ingen provisjonsgrunnlag ennå. Grunnlag oppstår når ordre leveres.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {summary.map((row) => (
              <li
                key={`${row.period}-${row.currency}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <span className="font-semibold text-neutral-900">{row.period}</span>
                <span className="text-neutral-600">
                  Netto salg {minor(row.basisMinor)} {row.currency} · provisjon {minor(row.commissionMinor)} {row.currency} ·{" "}
                  {row.rows} posteringer
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Provisjonsfakturaer</h2>
        {invoices.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-neutral-50 px-4 py-6 text-sm text-neutral-600">Ingen fakturaer ennå.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <span className="font-semibold text-neutral-900">
                  {inv.kind === "CREDIT" ? "Kreditfaktura" : "Faktura"} {inv.invoice_number ?? "(ikke utstedt)"}
                </span>
                <span className="text-neutral-600">
                  {minor(Number(inv.total_amount_minor))} {inv.currency}
                  {inv.due_date ? ` · forfall ${formatDateNO(inv.due_date)}` : ""} ·{" "}
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold">
                    {STATUS_LABELS[inv.payment_status] ?? inv.payment_status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
