// app/superadmin/agreement-invoices/page.tsx — supportvisning (Fase 8, read-only).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { requireSuperadmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { invoiceStatusLabel } from "@/components/billing/InvoiceDocument";
import { formatDateNO } from "@/lib/date/format";

export default async function SuperadminAgreementInvoicesPage() {
  await requireSuperadmin();

  const admin = supabaseAdmin() as any;
  const { data: invoices } = await admin
    .from("agreement_invoices")
    .select("id, kind, status, invoice_number, provider_id, company_id, invoice_period_start, invoice_period_end, currency, amount_total, amount_paid, due_date, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (invoices ?? []) as any[];
  const providerIds = [...new Set(rows.map((r) => String(r.provider_id)))];
  const companyIds = [...new Set(rows.map((r) => String(r.company_id)))];
  const [{ data: providers }, { data: companies }] = await Promise.all([
    providerIds.length ? admin.from("providers").select("id, name").in("id", providerIds) : { data: [] },
    companyIds.length ? admin.from("companies").select("id, name").in("id", companyIds) : { data: [] },
  ]);
  const pName = new Map((providers ?? []).map((p: any) => [String(p.id), String(p.name)]));
  const cName = new Map((companies ?? []).map((c: any) => [String(c.id), String(c.name)]));
  const nf = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2 });

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-[27px]">
      <h1 className="text-2xl font-semibold tracking-tight">Leverandørfakturaer (support)</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Read-only supportvisning av provider→firma-fakturaer. Handlinger utføres i leverandørflaten.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-neutral-50 px-4 py-6 text-sm text-neutral-600">Ingen fakturaer.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {rows.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
            >
              <span className="font-semibold text-neutral-900">
                {inv.kind === "CREDIT_NOTE" ? "KN" : "F"} {inv.invoice_number ?? "(utkast)"} · {pName.get(String(inv.provider_id)) ?? "?"} →{" "}
                {cName.get(String(inv.company_id)) ?? "?"}
              </span>
              <span className="text-neutral-600">
                {formatDateNO(inv.invoice_period_start)}–{formatDateNO(inv.invoice_period_end)} · {nf.format(Number(inv.amount_total))}{" "}
                {inv.currency} · betalt {nf.format(Number(inv.amount_paid))} ·{" "}
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold">{invoiceStatusLabel(String(inv.status))}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
