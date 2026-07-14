// app/admin/fakturaer/page.tsx — mottatte fakturaer for firmaadmin (Fase 8, read-only).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";

import { loadAdminContext, isAdminContextBlocked } from "@/lib/admin/loadAdminContext";
import AdminPageShell from "@/components/admin/AdminPageShell";
import BlockedState from "@/components/admin/BlockedState";
import { listCompanyInvoices } from "@/lib/billing/invoiceLifecycle";
import { invoiceStatusLabel } from "@/components/billing/InvoiceDocument";
import { formatDateNO } from "@/lib/date/format";

export default async function CompanyInvoicesPage() {
  const ctx = await loadAdminContext({
    nextPath: "/admin/fakturaer",
    enforceCompanyAdmin: true,
    returnBlockedState: true,
  });

  if (isAdminContextBlocked(ctx)) {
    return (
      <div className="lp-container py-8">
        <BlockedState level="followup" title="Ingen tilgang" body="Fakturaer er for firmaadmin med firmascope." nextSteps={ctx.nextSteps} />
      </div>
    );
  }

  const invoices = await listCompanyInvoices(ctx.companyId);
  const nf = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2 });

  return (
    <AdminPageShell title="Fakturaer" subtitle="Fakturaer fra leverandøren deres. Betaling via bankoverføring." actions={null}>
      {invoices.length === 0 ? (
        <p className="rounded-2xl bg-neutral-50 px-4 py-6 text-sm text-neutral-600">Ingen mottatte fakturaer ennå.</p>
      ) : (
        <ul className="space-y-2">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/admin/fakturaer/${inv.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm hover:border-neutral-400"
              >
                <span className="font-semibold text-neutral-900">
                  {inv.kind === "CREDIT_NOTE" ? "Kreditnota" : "Faktura"} {inv.invoice_number ?? ""}
                </span>
                <span className="text-neutral-600">
                  {formatDateNO(inv.invoice_period_start)}–{formatDateNO(inv.invoice_period_end)} · {nf.format(inv.amount_total)}{" "}
                  {inv.currency} ·{" "}
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold">{invoiceStatusLabel(inv.status)}</span>
                  {inv.due_date && inv.kind === "INVOICE" ? ` · forfall ${formatDateNO(inv.due_date)}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminPageShell>
  );
}
