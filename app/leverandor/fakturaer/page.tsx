// app/leverandor/fakturaer/page.tsx — provider-eid fakturaliste (Fase 8).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { listProviderInvoices, invoiceRpc } from "@/lib/billing/invoiceLifecycle";
import { invoiceStatusLabel } from "@/components/billing/InvoiceDocument";
import { formatDateNO } from "@/lib/date/format";
import { supabaseAdmin } from "@/lib/supabase/admin";
import BuildInvoiceDraftForm from "@/components/billing/BuildInvoiceDraftForm";

export default async function ProviderInvoicesPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Ffakturaer");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");
  const canView = await hasProviderRole(auth.user.id, provider.id, "provider_viewer");
  if (!canView) redirect("/leverandor");
  const canManage = await hasProviderRole(auth.user.id, provider.id, "provider_admin");

  await invoiceRpc.refreshOverdue(provider.id);
  const invoices = await listProviderInvoices(provider.id);

  const admin = supabaseAdmin() as any;
  const { data: companies } = await admin
    .from("companies")
    .select("id, name")
    .eq("provider_id", provider.id)
    .order("name");
  const companyName = new Map<string, string>((companies ?? []).map((c: any) => [String(c.id), String(c.name)]));

  const nf = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2 });

  return (
    <div className="ds-container mx-auto w-full max-w-[1100px] px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Fakturering</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Kundefakturaer</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Fakturagrunnlag = leverte ordre. Betaling via bankoverføring — ingen kortbetaling.
          </p>
        </div>
        {/* Fil-nedlasting (CSV-attachment fra API), ikke sidennavigasjon. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/provider/invoices/export"
          download
          className="inline-flex min-h-[44px] items-center rounded-full border border-neutral-200 bg-white px-4 text-sm font-semibold"
        >
          Regnskapseksport (CSV)
        </a>
      </header>

      {canManage ? (
        <BuildInvoiceDraftForm companies={(companies ?? []).map((c: any) => ({ id: String(c.id), name: String(c.name) }))} />
      ) : null}

      <section className="mt-6">
        {invoices.length === 0 ? (
          <p className="rounded-2xl bg-neutral-50 px-4 py-6 text-sm text-neutral-600">Ingen fakturaer ennå.</p>
        ) : (
          <ul className="space-y-2">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/leverandor/fakturaer/${inv.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm hover:border-neutral-400"
                >
                  <span className="font-semibold text-neutral-900">
                    {inv.kind === "CREDIT_NOTE" ? "Kreditnota" : "Faktura"} {inv.invoice_number ?? "(utkast)"} ·{" "}
                    {companyName.get(inv.company_id) ?? inv.company_id.slice(0, 8)}
                  </span>
                  <span className="text-neutral-600">
                    {formatDateNO(inv.invoice_period_start)}–{formatDateNO(inv.invoice_period_end)} · {nf.format(inv.amount_total)}{" "}
                    {inv.currency} ·{" "}
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold">
                      {invoiceStatusLabel(inv.status)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
