// app/superadmin/markeder/page.tsx — FASE 10: norsk kontrollflate for
// global skatte- og regnskapsberedskap (21 land, eierstyrt aktivering).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { requireSuperadmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { listMarketApprovals } from "@/lib/markets/marketApprovals";
import { describeAccountingCapability } from "@/lib/accounting/registry";
import { SUPPORTED_MARKETS } from "@/lib/markets/supportedMarkets";
import MarketApprovalClient, { marketApprovalStatusLabel } from "@/components/billing/MarketApprovalClient";

const TAX_STRATEGY_LABELS: Record<string, string> = {
  vat: "MVA/VAT",
  sales_tax: "Sales tax (per stat)",
  gst_hst: "GST/HST (per provins)",
};

export default async function SuperadminMarketsPage() {
  await requireSuperadmin();

  const admin = supabaseAdmin() as any;
  const [approvals, { data: marketRows }] = await Promise.all([
    listMarketApprovals(),
    admin
      .from("markets")
      .select(
        "country_code, locale, default_currency, vat_rate_food, tax_strategy, tax_id_validation, reverse_charge_supported, state_province_required, provider_timezone_required, postal_code_pattern, is_active",
      )
      .eq("is_active", true)
      .order("country_code"),
  ]);

  const approvalByCountry = new Map(approvals.map((a) => [a.country_code, a]));
  const marketByCountry = new Map<string, any>();
  for (const row of (marketRows ?? []) as any[]) {
    if (!marketByCountry.has(String(row.country_code))) marketByCountry.set(String(row.country_code), row);
  }
  const nameByCountry = new Map(SUPPORTED_MARKETS.map((m) => [m.countryCode, m.marketName]));

  const countries = [...marketByCountry.keys()].sort();
  const activeCount = approvals.filter((a) => a.status === "ACTIVE").length;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-[27px]">
      <h1 className="text-2xl font-semibold tracking-tight">Markeder og skatteberedskap</h1>
      <p className="mt-2 text-sm text-neutral-600">
        {countries.length} land konfigurert · {activeCount} kommersielt aktive. Et marked kan aldri fakturere uten
        eier-godkjent skatte- og juridisk gjennomgang (status «Aktiv»). Ikke-godkjente markeder feiler lukket.
      </p>

      <ul className="mt-6 space-y-2">
        {countries.map((cc) => {
          const m = marketByCountry.get(cc);
          const a = approvalByCountry.get(cc);
          const cap = describeAccountingCapability(cc);
          return (
            <li key={cc} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-neutral-900">
                  {cc} · {nameByCountry.get(cc as never) ?? cc}
                </span>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold">
                  {a ? marketApprovalStatusLabel(a.status) : "Mangler registeroppføring"}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-600">
                {m?.default_currency} · {TAX_STRATEGY_LABELS[String(m?.tax_strategy)] ?? m?.tax_strategy} · sats{" "}
                {Number(m?.vat_rate_food ?? 0).toFixed(2)} % · ID-validering {m?.tax_id_validation ?? "—"} ·{" "}
                {m?.reverse_charge_supported ? "reverse charge støttet" : "ingen reverse charge"}
                {m?.state_province_required ? " · stat/provins påkrevd" : ""}
                {m?.provider_timezone_required ? " · leverandør-tidssone påkrevd" : ""}
              </p>
              <p className="mt-1 text-xs text-neutral-500">Regnskap: {cap.label}</p>
              {a?.blocked_reason ? (
                <p className="mt-1 text-xs font-semibold text-red-700">Blokkert: {a.blocked_reason}</p>
              ) : null}
              {a ? (
                <div className="mt-2">
                  <MarketApprovalClient countryCode={cc} status={a.status} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
