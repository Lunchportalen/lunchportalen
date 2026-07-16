// app/superadmin/provider-registrations/page.tsx — cateringfirma-søknader (norsk).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { formatDateTimeNO } from "@/lib/date/format";
import { requireSuperadmin } from "@/lib/superadmin/auth";
import ProviderRegistrationDecision from "./ProviderRegistrationDecision";

type Row = {
  id: string;
  status: string;
  company_name: string;
  org_number: string | null;
  country_code: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  operating_language: string;
  invoice_language: string;
  currency: string;
  timezone: string | null;
  tax_registration: string | null;
  coverage_wish: string | null;
  provider_id: string | null;
  created_at: string;
};

function statusLabel(s: string) {
  const u = s.toUpperCase();
  if (u === "PENDING") return "Venter";
  if (u === "APPROVED") return "Godkjent";
  if (u === "REJECTED") return "Avslått";
  return u;
}

export default async function ProviderRegistrationsPage() {
  const { supabase } = await requireSuperadmin();

  const { data, error } = await (supabase as any)
    .from("provider_registrations")
    .select(
      "id, status, company_name, org_number, country_code, contact_name, contact_email, contact_phone, operating_language, invoice_language, currency, timezone, tax_registration, coverage_wish, provider_id, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (Array.isArray(data) ? data : []) as unknown as Row[];
  const pending = rows.filter((r) => r.status === "PENDING");
  const handled = rows.filter((r) => r.status !== "PENDING");

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-[27px]">
      <h1 className="text-2xl font-semibold tracking-tight">Leverandørsøknader</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Nye cateringfirma-søknader. Godkjenning oppretter leverandøren og sender invitasjon til
        administrator. Ingen leverandør blir kunde av seg selv.
      </p>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Kunne ikke hente søknader: {error.message}
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Venter på behandling ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Ingen ventende søknader.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {pending.map((r) => (
              <li key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-neutral-900">{r.company_name}</p>
                    <p className="mt-1 text-sm text-neutral-600">
                      {r.country_code} · {r.currency} · drift {r.operating_language} · faktura {r.invoice_language}
                      {r.timezone ? ` · ${r.timezone}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-neutral-600">
                      {r.contact_name} · {r.contact_email}
                      {r.contact_phone ? ` · ${r.contact_phone}` : ""}
                    </p>
                    {r.org_number ? <p className="mt-1 text-xs text-neutral-500">Org.nr: {r.org_number}</p> : null}
                    {r.tax_registration ? <p className="mt-1 text-xs text-neutral-500">MVA: {r.tax_registration}</p> : null}
                    {r.coverage_wish ? <p className="mt-1 text-xs text-neutral-500">Dekning: {r.coverage_wish}</p> : null}
                    <p className="mt-1 text-xs text-neutral-400">Mottatt {formatDateTimeNO(r.created_at)}</p>
                  </div>
                  <ProviderRegistrationDecision registrationId={r.id} companyName={r.company_name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Behandlet ({handled.length})</h2>
        {handled.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Ingen behandlede søknader.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {handled.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-100 bg-white px-4 py-3 text-sm">
                <span className="font-medium text-neutral-800">{r.company_name}</span>
                <span className="text-neutral-500">
                  {r.country_code} · {statusLabel(r.status)}
                  {r.provider_id ? " · opprettet" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
