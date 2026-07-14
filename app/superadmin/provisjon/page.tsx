// app/superadmin/provisjon/page.tsx — FASE 9: norsk kontrollflate for
// plattformprovisjon (5 % invoice-only oppgjør, INGEN Stripe).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { requireSuperadmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { listCommissionInvoices } from "@/lib/billing/commissionSettlement";
import { formatDateNO } from "@/lib/date/format";
import CommissionControlClient from "@/components/billing/CommissionControlClient";

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

const PERIOD_LABELS: Record<string, string> = {
  open: "Åpen",
  closing: "Lukkes",
  closed: "Lukket",
  invoiced: "Fakturert",
  paid: "Betalt",
  failed: "Feilet",
};

export default async function SuperadminCommissionPage() {
  await requireSuperadmin();

  const admin = supabaseAdmin() as any;
  const [invoices, { data: periods }, { data: failedDeliveries }, { data: orgs }] = await Promise.all([
    listCommissionInvoices(null),
    admin
      .from("commission_periods")
      .select("id, provider_id, period_start, period_end, currency, status, total_basis_amount_minor, rounded_commission_minor, closed_at")
      .order("period_start", { ascending: false })
      .limit(100),
    admin
      .from("invoice_deliveries")
      .select("id, invoice_id, recipient_email, delivery_status, failed_at, failed_reason")
      .in("delivery_status", ["failed", "bounced"])
      .order("failed_at", { ascending: false })
      .limit(50),
    admin.from("organization_billing_profiles").select("organization_id").limit(500),
  ]);

  const orgIds = [...new Set(((orgs ?? []) as any[]).map((o) => String(o.organization_id)))];
  const { data: providerRows } = orgIds.length
    ? await admin.from("providers").select("id, name").in("id", orgIds).order("name")
    : { data: [] };
  const providerOptions = ((providerRows ?? []) as any[]).map((p) => ({ id: String(p.id), name: String(p.name) }));
  const providerName = new Map(providerOptions.map((p) => [p.id, p.name]));

  const nf = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const minor = (v: number) => nf.format(Number(v || 0) / 100);
  const periodRows = (periods ?? []) as any[];
  const failed = (failedDeliveries ?? []) as any[];

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-[27px]">
      <h1 className="text-2xl font-semibold tracking-tight">Plattformprovisjon</h1>
      <p className="mt-2 text-sm text-neutral-600">
        5&nbsp;% av netto lunsjsalg ekskl. MVA for leverte ordre. Oppgjør uten Stripe: periode lukkes, faktura utstedes
        med forfall og sendes til leverandørens fakturaadresse. Betaling registreres manuelt (bank).
      </p>

      <CommissionControlClient providers={providerOptions} />

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Perioder</h2>
        {periodRows.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-neutral-50 px-4 py-6 text-sm text-neutral-600">Ingen lukkede perioder.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {periodRows.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm">
                <span className="font-semibold text-neutral-900">
                  {providerName.get(String(p.provider_id)) ?? String(p.provider_id).slice(0, 8)} · {formatDateNO(p.period_start)}–
                  {formatDateNO(p.period_end)}
                </span>
                <span className="text-neutral-600">
                  Grunnlag {minor(p.total_basis_amount_minor)} {p.currency} · provisjon {minor(p.rounded_commission_minor)} {p.currency} ·{" "}
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold">{PERIOD_LABELS[String(p.status)] ?? p.status}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Provisjonsfakturaer</h2>
        {invoices.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-neutral-50 px-4 py-6 text-sm text-neutral-600">Ingen fakturaer.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm">
                <span className="font-semibold text-neutral-900">
                  {inv.kind === "CREDIT" ? "KN" : "F"} {inv.invoice_number ?? "(ikke utstedt)"} ·{" "}
                  {providerName.get(String(inv.provider_id)) ?? String(inv.provider_id).slice(0, 8)}
                </span>
                <span className="text-neutral-600">
                  {minor(Number(inv.total_amount_minor))} {inv.currency} · betalt {minor(Number(inv.amount_paid_minor))}
                  {inv.due_date ? ` · forfall ${formatDateNO(inv.due_date)}` : ""} ·{" "}
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold">
                    {STATUS_LABELS[inv.payment_status] ?? inv.payment_status}
                  </span>{" "}
                  · <span className="font-mono text-xs">{inv.id}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Feilede leveranser</h2>
        {failed.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-neutral-50 px-4 py-6 text-sm text-neutral-600">Ingen feilede leveranser.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {failed.map((d) => (
              <li key={d.id} className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                {d.recipient_email} · faktura <span className="font-mono text-xs">{d.invoice_id}</span> · {d.failed_reason ?? d.delivery_status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
